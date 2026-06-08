require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
const { db, assignUniqueCode } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ===== Auth helper =====
function getUser(req) {
  const token = req.cookies.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  } catch { return null; }
}
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
    const { answers } = req.body;
    const prompt = `你是一位專業的調酒師與品酒顧問。根據用戶的品味測驗，分析他的飲酒人格並推薦 3 款酒。

用戶答案：${JSON.stringify(answers)}

請以 JSON 回覆，格式：
{
  "profile": "一段 2-3 句話描述用戶的飲酒人格與偏好",
  "recommendations": [
    { "name": "酒名（中文）", "category": "類別", "match_score": 95,
      "flavor_tags": ["標籤1","標籤2","標籤3"], "reason": "1-2 句", "serving_tip": "品飲建議" }
  ]
}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
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
    const { preferences } = req.body;
    const prompt = `你是世界級的創意調酒師。根據用戶的偏好，創造一款獨一無二的調酒。

用戶偏好：${JSON.stringify(preferences)}

請以 JSON 回覆：
{
  "cocktail_name": "創意酒名", "tagline": "一句英文標語", "glass": "建議杯型",
  "color": "酒液顏色描述", "story": "故事或靈感（2-3 句）",
  "flavor_profile": { "sweet": 3, "sour": 2, "bitter": 1, "strong": 4 },
  "ingredients": [{"name":"材料","amount":"份量"}],
  "steps": ["步驟1","步驟2"], "garnish": "裝飾"
}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    const result = JSON.parse(completion.choices[0].message.content);

    let history_id = null;
    const u = getUser(req);
    if (u) {
      const info = db.prepare('INSERT INTO cocktail_history (user_id, preferences, result) VALUES (?, ?, ?)')
        .run(u.id, JSON.stringify(preferences), JSON.stringify(result));
      history_id = info.lastInsertRowid;
    }
    res.json({ ...result, history_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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

app.get('/api/match', requireAuth, async (req, res) => {
  try {
    const myLatest = db.prepare(
      'SELECT answers FROM quiz_history WHERE user_id = ? ORDER BY id DESC LIMIT 1'
    ).get(req.user.id);
    if (!myLatest) {
      return res.status(400).json({ error: '請先完成一次品味測驗，AI 才能為你配對酒友' });
    }
    const myAns = JSON.parse(myLatest.answers);

    const others = db.prepare(`
      SELECT u.id, u.name, u.picture, u.unique_code, u.bio,
        (SELECT answers FROM quiz_history WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS latest_ans
      FROM users u
      WHERE u.id != ?
        AND EXISTS (SELECT 1 FROM quiz_history WHERE user_id = u.id)
    `).all(req.user.id);

    if (others.length === 0) {
      return res.json({ matches: [], message: '目前還沒有其他做過測驗的用戶，邀請朋友加入吧！' });
    }

    const scored = others
      .map(o => ({ ...o, score: quizSimilarity(myAns, o.latest_ans ? JSON.parse(o.latest_ans) : null) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const prompt = `你是 PourMatch 的 AI 飲酒配對顧問。根據兩人的品味測驗答案，用 1 句溫暖、有趣、像詩的中文描述他們為什麼合得來。

我的答案：${JSON.stringify(myAns)}

請為以下 ${scored.length} 位候選人，分別給出一句配對評語（不要超過 30 字，每句獨特）：
${scored.map((s, i) => `${i + 1}. ${s.name}（答案：${s.latest_ans}）`).join('\n')}

回覆 JSON：{ "comments": ["第一位的評語", "第二位的評語", "..."] }`;

    let comments = [];
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      comments = JSON.parse(completion.choices[0].message.content).comments || [];
    } catch (e) { console.error('match AI error', e.message); }

    const matches = scored.map((s, i) => ({
      user: { id: s.id, name: s.name, picture: s.picture, unique_code: s.unique_code, bio: s.bio || '' },
      match_score: s.score,
      comment: comments[i] || '你們的味蕾頻率剛剛好對上了。',
    }));
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PourMatch API on ${PORT}`);
});
