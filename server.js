require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
const { db, assignUniqueCode } = require('./db');
const { tasteSimilarity } = require('./taste');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ===== AI 產出多樣性 =====
// 每次請求隨機挑一個切入視角，避免相同答案永遠得到同一批推薦
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const QUIZ_ANGLES = [
  '從產地與風土出發，強調每款酒背後的土地與氣候',
  '從調製手法出發，關注攪拌、搖盪、澄清、浸漬等技法差異',
  '從歷史與時代背景出發，挑選有故事的酒款',
  '從季節與氣溫出發，考量此刻適合入口的溫度與濃度',
  '從香氣結構出發，拆解前中後段的層次變化',
  '從餐酒搭配出發，優先考慮與食物的互動',
  '從酒吧文化出發，挑選在不同城市酒吧會遇見的招牌',
  '從原料的稀有度出發，介紹少見的基酒或利口酒',
  '從情緒療癒出發，挑選能對應他當下心境的酒',
  '從反差實驗出發，刻意推薦與他既有偏好互補的選擇',
];

const COCKTAIL_ANGLES = [
  '以一個具體的城市街景為靈感',
  '以某個季節的天氣與光線為靈感',
  '以一種情緒或記憶為靈感',
  '以一道料理的風味結構為靈感',
  '以某種音樂類型的節奏感為靈感',
  '以一個自然場景（海、森林、沙漠、雪地）為靈感',
  '以經典調酒的變奏改編為靈感',
  '以一種東方食材或茶飲為靈感',
];

// 回覆語言：前端把介面語言一起送上來，AI 產出才不會跟介面對不上
const LANG_RULE = {
  zh: '整份回覆請使用繁體中文。',
  en: 'Write the entire response in natural, idiomatic English — including drink names, '
    + 'categories, origins and every label. Use the name each drink is known by in English. '
    + 'Do not output Chinese characters anywhere.',
};
const langRule = l => LANG_RULE[l === 'en' ? 'en' : 'zh'];

// ===== Auth helper =====
function getUser(req) {
  const token = req.cookies.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  } catch { return null; }
}
const ONLINE_WINDOW = 5 * 60; // 5 分鐘內有動作視為在線

// 記錄活躍時間。每 60 秒最多寫一次，避免每個請求都打資料庫
const lastSeenCache = new Map();
function touchLastSeen(userId) {
  const now = Math.floor(Date.now() / 1000);
  if (now - (lastSeenCache.get(userId) || 0) < 60) return;
  lastSeenCache.set(userId, now);
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
}

app.use((req, res, next) => {
  const u = getUser(req);
  if (u) touchLastSeen(u.id);
  next();
});

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: '請先登入' });
  req.user = user;
  next();
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    picture: u.picture,
    unique_code: u.unique_code,
    bio: u.bio || '',
  };
}
function requireOpenAIClient(res) {
  if (openai) return openai;
  res.status(503).json({ error: 'OPENAI_API_KEY 尚未設定，請先檢查後端環境變數' });
  return null;
}

// ===== Auth =====
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();

    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(p.sub);
    if (!user) {
      const info = db.prepare(
        'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)'
      ).run(p.sub, p.email, p.name, p.picture);
      assignUniqueCode(info.lastInsertRowid);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      db.prepare('UPDATE users SET name = ?, picture = ? WHERE id = ?').run(p.name, p.picture, user.id);
      if (!user.unique_code) assignUniqueCode(user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({
      id: user.id, email: user.email, name: user.name, picture: user.picture,
      unique_code: user.unique_code, bio: user.bio || '',
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Google 驗證失敗' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ user: null });
  const stats = {
    quiz_count: db.prepare('SELECT COUNT(*) c FROM quiz_history WHERE user_id = ?').get(u.id).c,
    cocktail_count: db.prepare('SELECT COUNT(*) c FROM cocktail_history WHERE user_id = ?').get(u.id).c,
    friends_count: db.prepare('SELECT COUNT(*) c FROM friendships WHERE user_id = ?').get(u.id).c,
    posts_count: db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ?').get(u.id).c,
  };
  res.json({ user: { ...publicUser(u), email: u.email, stats } });
});

// ===== Profile =====
app.patch('/api/profile', requireAuth, (req, res) => {
  const { bio } = req.body;
  if (typeof bio === 'string') {
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio.slice(0, 280), req.user.id);
  }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(publicUser(u));
});

app.get('/api/users/:code', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE unique_code = ?').get(req.user?.code || req.params.code);
  if (!u) return res.status(404).json({ error: '用戶不存在' });
  res.json(publicUser(u));
});

// ===== Taste quiz =====
app.post('/api/taste-quiz', async (req, res) => {
  try {
    const ai = requireOpenAIClient(res);
    if (!ai) return;

    const { answers, lang } = req.body;
    const angle = pick(QUIZ_ANGLES);
    const prompt = `你是一位專業的調酒師與品酒顧問。根據用戶的品味測驗，分析他的飲酒人格並推薦 4 款酒。

${langRule(lang)}

用戶答案：${JSON.stringify(answers)}

本次分析的切入視角：${angle}
（這個視角只影響你挑酒與敘述的角度，不要在輸出中直接提到「視角」這個詞。）

四款推薦必須各自扮演不同角色，順序如下：
1. 舒適圈：最貼近他答案的安全選擇
2. 進階款：在他偏好的方向上再推一步，稍微挑戰他
3. 冷門驚喜：小眾、少見、他很可能沒喝過的
4. 情境特調：專門配合他選的場合與時段

多樣性要求（很重要）：
- 四款的基酒、產地、調製手法盡量不重複
- 避免無條件端出莫吉托、瑪格麗特、Old Fashioned、Negroni、Gin Tonic 這類爛大街的答案；最多只能出現一款，而且必須是他的答案強烈指向它
- match_score 之間要有差距，不要四款都給 90 幾分
- 如果他的冒險程度高，就大膽一點；如果低，就以熟悉度為優先

請以 JSON 回覆，格式：
{
  "nickname": "a short, vivid title for their drinking persona (4-8 characters in Chinese, or 2-4 words in English)",
  "profile": "一段 2-3 句話描述用戶的飲酒人格與偏好",
  "traits": ["3-5 short tags describing their taste, a couple of words each"],
  "recommendations": [
    { "name": "drink name, written in the reply language", "category": "category", "origin": "where it comes from",
      "match_score": 95, "flavor_tags": ["標籤1","標籤2","標籤3"],
      "reason": "為什麼推薦給他，1-2 句，要對應他的具體答案",
      "serving_tip": "品飲建議", "food_pairing": "適合搭配的食物" }
  ]
}`;
    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 1.05,
      top_p: 0.95,
      presence_penalty: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });
    const result = JSON.parse(completion.choices[0].message.content);

    let history_id = null;
    const u = getUser(req);
    if (u) {
      const info = db.prepare('INSERT INTO quiz_history (user_id, answers, result) VALUES (?, ?, ?)')
        .run(u.id, JSON.stringify(answers), JSON.stringify(result));
      history_id = info.lastInsertRowid;
    }
    res.json({ ...result, history_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Cocktail generator =====
app.post('/api/cocktail-generator', async (req, res) => {
  try {
    const ai = requireOpenAIClient(res);
    if (!ai) return;

    const { preferences, advanced, lang } = req.body;
    const angle = pick(COCKTAIL_ANGLES);

    // 進階模式：附上額外偏好，並要求更完整的配方規格
    const advancedBlock = advanced ? `

使用者另外開啟了「進階模式」，以下是他的細節要求，請嚴格遵守：
${JSON.stringify(advanced)}

進階欄位對照：
- texture 口感質地 / ice 冰與溫度 / glass 指定杯型 / complexity 配方複雜度
- technique 希望使用的調製技法 / inspiration 靈感來源類型 / color 期望酒液顏色
- diet 飲食與材料限制（mocktail=需要無酒精版本、low_cal=低糖低卡、no_dairy=不含乳製品、
  no_egg=不含蛋、vegan=全素、common=只用一般家庭或超市買得到的材料）
- naming 命名風格 / sour 酸度 1-5 / bitter 苦韻 1-5

若 diet 含 mocktail，mocktail_version 欄位必填；
若指定了 glass 或 color，輸出必須與其一致；
若 complexity 為 simple，材料不得超過 3 種。

進階模式的輸出必須包含 JSON 範本中 technique 之後的所有欄位，一個都不能省略。` : '';

    // 進階欄位要寫進 JSON 範本本身，只放在說明區塊模型會忽略
    const advSchema = advanced ? `,
  "technique": "主要調製技法",
  "difficulty": "one of: beginner / intermediate / pro — written in the reply language",
  "prep_time": "estimated time, e.g. about 5 minutes, in the reply language",
  "abv_estimate": "estimated strength, e.g. around 18% ABV",
  "pro_tips": ["2-3 個讓成品更好的實作要訣"],
  "variations": [{"name":"變化版名稱","description":"改動了什麼，一句話"}],
  "mocktail_version": "無酒精版本要怎麼調（沒有這個需求時給空字串）"` : '';

    const prompt = `你是世界級的創意調酒師。根據用戶的偏好，創造一款獨一無二的調酒。

${langRule(lang)}

用戶偏好：${JSON.stringify(preferences)}

本次創作的靈感方向：${angle}
（這只是你發想的起點，不要在輸出中直接提到「靈感方向」這個詞。）

創作要求：
- 酒譜要具體可執行，份量用 ml 或 oz 標示清楚
- 不要每次都端出雷同的配方，避免落入固定套路
- story 要能呼應使用者填的心情與自由文字${advancedBlock}

請以 JSON 回覆：
{
  "cocktail_name": "創意酒名", "tagline": "一句英文標語", "glass": "建議杯型",
  "color": "酒液顏色描述", "story": "故事或靈感（2-3 句）",
  "flavor_profile": { "sweet": 3, "sour": 2, "bitter": 1, "strong": 4 },
  "ingredients": [{"name":"材料","amount":"份量"}],
  "steps": ["步驟1","步驟2"], "garnish": "裝飾"${advSchema}
}`;
    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 1.1,
      top_p: 0.95,
      presence_penalty: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });
    const result = JSON.parse(completion.choices[0].message.content);

    let history_id = null;
    const u = getUser(req);
    if (u) {
      const info = db.prepare('INSERT INTO cocktail_history (user_id, preferences, result) VALUES (?, ?, ?)')
        .run(u.id, JSON.stringify({ ...preferences, advanced }), JSON.stringify(result));
      history_id = info.lastInsertRowid;
    }
    res.json({ ...result, history_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 健康檢查 =====
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    openai_ready: Boolean(openai),
    server_time: new Date().toISOString(),
  });
});

// ===== Save existing result (for users who logged in after generating) =====
app.post('/api/save-result', requireAuth, (req, res) => {
  try {
    const { type, payload } = req.body || {};
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'invalid payload' });
    }
    if (type === 'quiz') {
      const info = db.prepare('INSERT INTO quiz_history (user_id, answers, result) VALUES (?, ?, ?)')
        .run(req.user.id, JSON.stringify(payload.answers || {}), JSON.stringify(payload.result || {}));
      return res.json({ history_id: info.lastInsertRowid });
    }
    if (type === 'cocktail') {
      const info = db.prepare('INSERT INTO cocktail_history (user_id, preferences, result) VALUES (?, ?, ?)')
        .run(req.user.id, JSON.stringify(payload.preferences || {}), JSON.stringify(payload.result || {}));
      return res.json({ history_id: info.lastInsertRowid });
    }
    return res.status(400).json({ error: 'invalid type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== History =====
app.get('/api/history/quiz', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, answers, result, created_at FROM quiz_history WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id, created_at: r.created_at,
    answers: JSON.parse(r.answers), result: JSON.parse(r.result),
  })));
});
app.get('/api/history/cocktail', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, preferences, result, created_at FROM cocktail_history WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id, created_at: r.created_at,
    preferences: JSON.parse(r.preferences), result: JSON.parse(r.result),
  })));
});

// ===== Posts / Feed =====
app.post('/api/posts', requireAuth, (req, res) => {
  const { type, history_id, caption = '' } = req.body;
  if (!['quiz', 'cocktail'].includes(type)) return res.status(400).json({ error: '類型錯誤' });
  const table = type === 'quiz' ? 'quiz_history' : 'cocktail_history';
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(history_id, req.user.id);
  if (!row) return res.status(404).json({ error: '紀錄不存在' });

  const content = type === 'quiz'
    ? { result: JSON.parse(row.result) }
    : { result: JSON.parse(row.result) };

  const info = db.prepare('INSERT INTO posts (user_id, type, content, caption) VALUES (?, ?, ?, ?)')
    .run(req.user.id, type, JSON.stringify(content), String(caption).slice(0, 280));
  res.json({ id: info.lastInsertRowid });
});

function postRow(row, viewerId) {
  const liked = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(viewerId, row.id)
    : false;
  const comments_count = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(row.id).c;
  return {
    id: row.id,
    type: row.type,
    content: JSON.parse(row.content),
    caption: row.caption,
    likes_count: row.likes_count,
    comments_count,
    created_at: row.created_at,
    liked,
    is_owner: viewerId ? viewerId === row.uid : false,
    user: { id: row.uid, name: row.uname, picture: row.upic, unique_code: row.ucode },
  };
}

app.get('/api/feed', (req, res) => {
  const viewer = getUser(req);
  const scope = req.query.scope === 'friends' ? 'friends' : 'all';
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const offset = Number(req.query.offset) || 0;

  let rows;
  if (scope === 'friends' && viewer) {
    rows = db.prepare(`
      SELECT p.*, u.id uid, u.name uname, u.picture upic, u.unique_code ucode
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.user_id IN (SELECT friend_id FROM friendships WHERE user_id = ?) OR p.user_id = ?
      ORDER BY p.id DESC LIMIT ? OFFSET ?
    `).all(viewer.id, viewer.id, limit, offset);
  } else {
    rows = db.prepare(`
      SELECT p.*, u.id uid, u.name uname, u.picture upic, u.unique_code ucode
      FROM posts p JOIN users u ON u.id = p.user_id
      ORDER BY p.id DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
  res.json(rows.map(r => postRow(r, viewer?.id)));
});

app.get('/api/share/:id', (req, res) => {
  const row = db.prepare(`
    SELECT p.*, u.id uid, u.name uname, u.picture upic, u.unique_code ucode
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: '貼文不存在' });
  res.json(postRow(row, null));
});

// 刪除自己的貼文（CASCADE 會帶走 likes/comments）
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const pid = Number(req.params.id);
  const p = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(pid);
  if (!p) return res.status(404).json({ error: '貼文不存在' });
  if (p.user_id !== req.user.id) return res.status(403).json({ error: '不能刪除他人貼文' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(pid);
  res.json({ ok: true });
});

// 留言：列表（公開）/ 新增（需登入）/ 刪除自己留言
app.get('/api/posts/:id/comments', (req, res) => {
  const viewer = getUser(req);
  const rows = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id,
           u.name uname, u.picture upic, u.unique_code ucode
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.id ASC
  `).all(req.params.id);
  res.json(rows.map(r => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    is_owner: viewer ? viewer.id === r.user_id : false,
    user: { id: r.user_id, name: r.uname, picture: r.upic, unique_code: r.ucode },
  })));
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const postId = Number(req.params.id);
  const body = String(req.body.body || '').trim().slice(0, 500);
  if (!body) return res.status(400).json({ error: '留言不能為空' });
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: '貼文不存在' });
  const info = db.prepare('INSERT INTO comments (user_id, post_id, body) VALUES (?, ?, ?)')
    .run(req.user.id, postId, body);
  const created = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id,
           u.name uname, u.picture upic, u.unique_code ucode
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(info.lastInsertRowid);
  res.json({
    id: created.id,
    body: created.body,
    created_at: created.created_at,
    is_owner: true,
    user: { id: created.user_id, name: created.uname, picture: created.upic, unique_code: created.ucode },
  });
});

app.delete('/api/comments/:id', requireAuth, (req, res) => {
  const cid = Number(req.params.id);
  const c = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(cid);
  if (!c) return res.status(404).json({ error: '留言不存在' });
  if (c.user_id !== req.user.id) return res.status(403).json({ error: '不能刪除他人留言' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(cid);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const postId = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);
  if (exists) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
    db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
    return res.json({ liked: false });
  }
  db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, postId);
  db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
  res.json({ liked: true });
});

// ===== Friends =====
app.post('/api/friends/add', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '請輸入代碼' });
  const target = db.prepare('SELECT * FROM users WHERE unique_code = ?').get(String(code).toUpperCase());
  if (!target) return res.status(404).json({ error: '找不到此代碼的用戶' });
  if (target.id === req.user.id) return res.status(400).json({ error: '不能加自己為好友' });

  try {
    db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(req.user.id, target.id);
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(target.id, req.user.id);
  } catch (e) {
    return res.status(409).json({ error: '已經是好友了' });
  }
  res.json(publicUser(target));
});

app.delete('/api/friends/:friendId', requireAuth, (req, res) => {
  const fid = Number(req.params.friendId);
  db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(req.user.id, fid);
  db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(fid, req.user.id);
  res.json({ ok: true });
});

app.get('/api/friends', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? ORDER BY f.id DESC
  `).all(req.user.id);
  res.json(rows.map(publicUser));
});

// ===== AI Match (酒友配對) =====
function quizSimilarity(a, b) {
  if (!a || !b) return 0;
  let score = 0;
  for (const k of Object.keys(a)) {
    if (a[k] === b[k]) score += 20;
    else if (typeof a[k] === 'number' && typeof b[k] === 'number') {
      score += Math.max(0, 20 - Math.abs(a[k] - b[k]) * 5);
    }
  }
  return Math.min(100, Math.round(score));
}

// ===== 配對 =====
const now = () => Math.floor(Date.now() / 1000);
const isOnline = u => (u.last_seen || 0) >= now() - ONLINE_WINDOW;

// 一對一房間的鍵：固定小 id 在前，同一組人永遠只會有一間房
const directKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function latestAnswers(userId) {
  const row = db.prepare(
    'SELECT answers FROM quiz_history WHERE user_id = ? ORDER BY id DESC LIMIT 1'
  ).get(userId);
  if (!row) return null;
  try { return JSON.parse(row.answers); } catch { return null; }
}

// 撈出還沒表態過的人並依相似度排序
function rankCandidates(me, myAns, { mode = 'all', limit = 20 } = {}) {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.picture, u.unique_code, u.bio, u.last_seen,
      (SELECT answers FROM quiz_history WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS latest_ans
    FROM users u
    WHERE u.id != ?
      AND EXISTS (SELECT 1 FROM quiz_history WHERE user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM match_actions WHERE from_user = ? AND to_user = u.id)
  `).all(me.id, me.id);

  const scored = rows.map(r => {
    let ans = null;
    try { ans = r.latest_ans ? JSON.parse(r.latest_ans) : null; } catch { ans = null; }
    const sim = tasteSimilarity(myAns, ans);
    return {
      user: { ...publicUser(r), online: isOnline(r), last_seen: r.last_seen || 0 },
      match_percent: sim.percent,
      score: sim.score,
      shared: sim.shared,
      breakdown: sim.breakdown,
    };
  });

  // 「在線」不是獨立的池子，是同一份清單的篩選；空的時候退回最近活躍
  let list = scored;
  let fallback = false;
  if (mode === 'online') {
    const onlineOnly = scored.filter(c => c.user.online);
    if (onlineOnly.length > 0) {
      list = onlineOnly;
    } else {
      fallback = true;
      list = scored.slice().sort((a, b) => b.user.last_seen - a.user.last_seen).slice(0, limit);
      return { list, fallback };
    }
  }
  list = list.slice().sort((a, b) => b.score - a.score).slice(0, limit);
  return { list, fallback };
}

app.get('/api/match/candidates', requireAuth, (req, res) => {
  try {
    const myAns = latestAnswers(req.user.id);
    if (!myAns) return res.status(400).json({ error: '請先完成一次品味測驗，才能開始配對' });

    const mode = req.query.mode === 'online' ? 'online' : 'all';
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { list, fallback } = rankCandidates(req.user, myAns, { mode, limit });

    res.json({
      mode,
      fallback,
      message: fallback ? '目前沒有人在線，這幾位最近上線過' : undefined,
      candidates: list,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 表態。雙方都 like 就開房間，整段包在交易裡避免同時按下時開出兩間
const applyAction = db.transaction((fromId, toId, action) => {
  db.prepare(`
    INSERT INTO match_actions (from_user, to_user, action, created_at)
    VALUES (?, ?, ?, strftime('%s','now'))
    ON CONFLICT(from_user, to_user) DO UPDATE SET action = excluded.action, created_at = excluded.created_at
  `).run(fromId, toId, action);

  if (action !== 'like') return { matched: false, room_id: null };

  const reciprocal = db.prepare(
    `SELECT 1 FROM match_actions WHERE from_user = ? AND to_user = ? AND action = 'like'`
  ).get(toId, fromId);
  if (!reciprocal) return { matched: false, room_id: null };

  const key = directKey(fromId, toId);
  const existing = db.prepare('SELECT id FROM rooms WHERE direct_key = ?').get(key);
  if (existing) return { matched: true, room_id: existing.id };

  const info = db.prepare(
    `INSERT INTO rooms (kind, direct_key, created_at) VALUES ('direct', ?, strftime('%s','now'))`
  ).run(key);
  const roomId = info.lastInsertRowid;
  const addMember = db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)');
  addMember.run(roomId, fromId);
  addMember.run(roomId, toId);
  return { matched: true, room_id: roomId };
});

app.post('/api/match/action', requireAuth, (req, res) => {
  try {
    const toId = Number(req.body.to_user);
    const action = req.body.action;
    if (!['like', 'pass'].includes(action)) return res.status(400).json({ error: 'action 只能是 like 或 pass' });
    if (!Number.isInteger(toId) || toId === req.user.id) return res.status(400).json({ error: '對象不正確' });
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(toId);
    if (!target) return res.status(404).json({ error: '對象不存在' });

    const out = applyAction(req.user.id, toId, action);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 誰喜歡了我（我還沒回應的）
app.get('/api/match/likes-me', requireAuth, (req, res) => {
  const myAns = latestAnswers(req.user.id);
  const rows = db.prepare(`
    SELECT u.id, u.name, u.picture, u.unique_code, u.bio, u.last_seen, a.created_at,
      (SELECT answers FROM quiz_history WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS latest_ans
    FROM match_actions a
    JOIN users u ON u.id = a.from_user
    WHERE a.to_user = ? AND a.action = 'like'
      AND NOT EXISTS (SELECT 1 FROM match_actions m WHERE m.from_user = ? AND m.to_user = a.from_user)
    ORDER BY a.created_at DESC
  `).all(req.user.id, req.user.id);

  res.json({
    likes: rows.map(r => {
      let ans = null;
      try { ans = r.latest_ans ? JSON.parse(r.latest_ans) : null; } catch {}
      const sim = tasteSimilarity(myAns, ans);
      return {
        user: { ...publicUser(r), online: isOnline(r) },
        match_percent: sim.percent,
        shared: sim.shared,
        liked_at: r.created_at,
      };
    }),
  });
});

// 舊端點保留給現有的 match.html，改用新的相似度
app.get('/api/match', requireAuth, async (req, res) => {
  try {
    const myAns = latestAnswers(req.user.id);
    if (!myAns) {
      return res.status(400).json({ error: '請先完成一次品味測驗，AI 才能為你配對酒友' });
    }
    const { list } = rankCandidates(req.user, myAns, { mode: 'all', limit: 3 });
    if (list.length === 0) {
      return res.json({ matches: [], message: '目前還沒有其他做過測驗的用戶，邀請朋友加入吧！' });
    }

    let comments = [];
    if (openai) {
      const prompt = `你是 PourMatch 的 AI 飲酒配對顧問。根據兩人的品味測驗答案，用 1 句溫暖、有趣、像詩的話描述他們為什麼合得來。

${langRule(req.query.lang)}

我的答案：${JSON.stringify(myAns)}

請為以下 ${list.length} 位候選人，分別給出一句配對評語（不要超過 30 字，每句獨特）：
${list.map((c, i) => `${i + 1}. ${c.user.name}（一致面向：${c.shared.join('、') || '無'}，相似度 ${c.match_percent}%）`).join('\n')}

回覆 JSON：{ "comments": ["第一位的評語", "第二位的評語", "..."] }`;
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        });
        comments = JSON.parse(completion.choices[0].message.content).comments || [];
      } catch (e) { console.error('match AI error', e.message); }
    }

    res.json({
      matches: list.map((c, i) => ({
        user: c.user,
        match_score: c.match_percent,
        shared: c.shared,
        comment: comments[i] || '你們的味蕾頻率剛剛好對上了。',
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 聊天室（一對一與群組共用）=====
function requireMember(req, res) {
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) { res.status(400).json({ error: '房間不正確' }); return null; }
  const member = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(roomId, req.user.id);
  // 不是成員一律回 404，不要洩漏房間是否存在
  if (!member) { res.status(404).json({ error: '找不到房間' }); return null; }
  return roomId;
}

app.get('/api/rooms', requireAuth, (req, res) => {
  const rooms = db.prepare(`
    SELECT r.id, r.kind, r.title, r.created_at, rm.last_read_id
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
    ORDER BY r.id DESC
  `).all(req.user.id);

  const others = db.prepare(`
    SELECT u.id, u.name, u.picture, u.unique_code, u.bio, u.last_seen
    FROM room_members rm JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ? AND rm.user_id != ?
  `);
  const lastMsg = db.prepare(
    'SELECT id, sender_id, body, created_at FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT 1'
  );
  const unread = db.prepare(
    'SELECT COUNT(*) c FROM messages WHERE room_id = ? AND id > ? AND sender_id != ?'
  );

  res.json({
    rooms: rooms.map(r => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      created_at: r.created_at,
      members: others.all(r.id, req.user.id).map(u => ({ ...publicUser(u), online: isOnline(u) })),
      last_message: lastMsg.get(r.id) || null,
      unread: unread.get(r.id, r.last_read_id || 0, req.user.id).c,
    })),
  });
});

// 前端輪詢用：帶 after 只取新訊息
app.get('/api/rooms/:id/messages', requireAuth, (req, res) => {
  const roomId = requireMember(req, res);
  if (roomId === null) return;
  const after = Number(req.query.after) || 0;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const rows = after > 0
    ? db.prepare('SELECT * FROM messages WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
        .all(roomId, after, limit)
    : db.prepare('SELECT * FROM (SELECT * FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC')
        .all(roomId, limit);

  res.json({
    messages: rows.map(m => ({
      id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at,
      mine: m.sender_id === req.user.id,
    })),
  });
});

app.post('/api/rooms/:id/messages', requireAuth, (req, res) => {
  const roomId = requireMember(req, res);
  if (roomId === null) return;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: '訊息不能是空的' });
  if (body.length > 1000) return res.status(400).json({ error: '訊息過長' });

  const info = db.prepare(
    `INSERT INTO messages (room_id, sender_id, body, created_at) VALUES (?, ?, ?, strftime('%s','now'))`
  ).run(roomId, req.user.id, body);
  // 自己送出的訊息直接算已讀
  db.prepare('UPDATE room_members SET last_read_id = ? WHERE room_id = ? AND user_id = ?')
    .run(info.lastInsertRowid, roomId, req.user.id);

  res.json({ id: info.lastInsertRowid, body, created_at: now(), mine: true });
});

app.post('/api/rooms/:id/read', requireAuth, (req, res) => {
  const roomId = requireMember(req, res);
  if (roomId === null) return;
  const upTo = Number(req.body.up_to) || 0;
  db.prepare('UPDATE room_members SET last_read_id = MAX(last_read_id, ?) WHERE room_id = ? AND user_id = ?')
    .run(upTo, roomId, req.user.id);
  res.json({ ok: true });
});

// 退出房間。一對一退出等於結束這段對話
app.delete('/api/rooms/:id', requireAuth, (req, res) => {
  const roomId = requireMember(req, res);
  if (roomId === null) return;
  db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, req.user.id);
  const left = db.prepare('SELECT COUNT(*) c FROM room_members WHERE room_id = ?').get(roomId).c;
  if (left === 0) db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  res.json({ ok: true });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PourMatch API on ${PORT}`);
});
