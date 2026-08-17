// ===== 品味測驗邏輯 =====
const QUESTIONS = [
  {
    id: 'taste',
    title: '你最受哪種風味吸引？',
    type: 'single',
    options: [
      { value: 'sweet', emoji: '🍯', label: '甜美豐潤', desc: '蜂蜜、焦糖、熟果' },
      { value: 'bitter', emoji: '☕', label: '苦韻深沉', desc: '黑咖啡、可可、藥草' },
      { value: 'smoky', emoji: '🔥', label: '煙燻濃烈', desc: '泥煤、橡木、皮革' },
      { value: 'fresh', emoji: '🌿', label: '清新草本', desc: '柑橘、薄荷、青草' },
    ],
  },
  {
    id: 'aroma',
    title: '哪些香氣會讓你想多聞兩下？',
    subtitle: '可以複選，選越多我們越懂你',
    type: 'multi',
    options: [
      { value: 'citrus', emoji: '🍊', label: '柑橘皮油', desc: '檸檬、葡萄柚、橙皮' },
      { value: 'floral', emoji: '🌸', label: '花香調', desc: '接骨木、玫瑰、洋甘菊' },
      { value: 'spice', emoji: '🌶️', label: '辛香料', desc: '肉桂、丁香、黑胡椒' },
      { value: 'wood', emoji: '🪵', label: '木質陳年', desc: '橡木桶、香草、雪茄盒' },
      { value: 'tropical', emoji: '🥭', label: '熱帶果香', desc: '芒果、百香果、鳳梨' },
      { value: 'herbal', emoji: '🌿', label: '草本藥草', desc: '迷迭香、羅勒、苦艾' },
      { value: 'roast', emoji: '☕', label: '烘焙焦香', desc: '咖啡、可可、堅果' },
      { value: 'mineral', emoji: '🧂', label: '礦石鹹感', desc: '海風、燧石、鹽花' },
    ],
  },
  {
    id: 'texture',
    title: '入口的口感，你偏好哪一種？',
    type: 'single',
    options: [
      { value: 'sparkling', emoji: '🫧', label: '氣泡跳躍', desc: '刺刺的、有生命力' },
      { value: 'silky', emoji: '🥛', label: '絲滑綿密', desc: '像天鵝絨滑過舌尖' },
      { value: 'crisp', emoji: '❄️', label: '清爽俐落', desc: '乾淨、不留餘韻' },
      { value: 'viscous', emoji: '🍯', label: '濃稠厚重', desc: '掛杯、口感飽滿' },
    ],
  },
  {
    id: 'strength',
    title: '你喜歡多強烈的酒精感？',
    type: 'slider',
    min: 1, max: 5, default: 3,
    labels: ['入口即化', '微醺怡人', '均衡有感', '烈火燒心', '直球強勁'],
  },
  {
    id: 'sourness',
    title: '對酸度的接受程度呢？',
    type: 'slider',
    min: 1, max: 5, default: 3,
    labels: ['完全不要酸', '一點點就好', '酸甜平衡', '喜歡明亮酸感', '越酸越開心'],
  },
  {
    id: 'base',
    title: '有偏愛的基酒嗎？',
    subtitle: '可以複選，沒有特別偏好就選「都想試試」',
    type: 'multi',
    options: [
      { value: 'gin', emoji: '🌲', label: '琴酒', desc: '杜松子與植物香' },
      { value: 'whisky', emoji: '🥃', label: '威士忌', desc: '穀物與桶陳' },
      { value: 'rum', emoji: '🏝️', label: '蘭姆酒', desc: '甘蔗與焦糖' },
      { value: 'tequila', emoji: '🌵', label: '龍舌蘭', desc: '青草與土地味' },
      { value: 'vodka', emoji: '💎', label: '伏特加', desc: '乾淨中性' },
      { value: 'brandy', emoji: '🍇', label: '白蘭地', desc: '果實蒸餾陳年' },
      { value: 'sake', emoji: '🍶', label: '清酒 / 燒酎', desc: '米香與東方調' },
      { value: 'any', emoji: '🎲', label: '都想試試', desc: '交給 AI 決定' },
    ],
  },
  {
    id: 'mood',
    title: '今晚想要什麼氛圍？',
    type: 'single',
    options: [
      { value: 'chill', emoji: '🌙', label: '獨處放空', desc: '沉澱一天的思緒' },
      { value: 'romantic', emoji: '💞', label: '浪漫約會', desc: '與心動的人共飲' },
      { value: 'party', emoji: '🎉', label: '派對狂歡', desc: '燃燒整個夜晚' },
      { value: 'deep', emoji: '🗣️', label: '深度交談', desc: '老友一杯徹夜聊' },
    ],
  },
  {
    id: 'occasion',
    title: '你通常在哪裡喝酒？',
    type: 'single',
    options: [
      { value: 'home', emoji: '🛋️', label: '家中獨酌', desc: '舒服的沙發配音樂' },
      { value: 'bar', emoji: '🍸', label: '精品酒吧', desc: '吧台前看調酒師表演' },
      { value: 'restaurant', emoji: '🍽️', label: '餐酒搭配', desc: '與美食共舞' },
      { value: 'outdoor', emoji: '🌌', label: '戶外露營', desc: '星空下的微醺' },
    ],
  },
  {
    id: 'timing',
    title: '最想來一杯的時刻是？',
    type: 'single',
    options: [
      { value: 'aperitif', emoji: '🌇', label: '傍晚開胃', desc: '下班後的第一杯' },
      { value: 'dinner', emoji: '🍽️', label: '佐餐時光', desc: '配著菜一起慢慢喝' },
      { value: 'late', emoji: '🌃', label: '深夜獨飲', desc: '城市安靜下來之後' },
      { value: 'brunch', emoji: '☀️', label: '週末白天', desc: '陽光下的微醺' },
    ],
  },
  {
    id: 'adventure',
    title: '你有多想嘗試沒喝過的東西？',
    type: 'slider',
    min: 1, max: 5, default: 3,
    labels: ['只喝我熟悉的', '偶爾換換口味', '一半經典一半新奇', '想被推坑', '越沒聽過越好'],
  },
  {
    id: 'personality',
    title: '用一個詞形容你自己？',
    type: 'single',
    options: [
      { value: 'bold', emoji: '⚡', label: '大膽冒險', desc: '總是敢於嘗試新事物' },
      { value: 'elegant', emoji: '🎭', label: '優雅內斂', desc: '講究細節與品味' },
      { value: 'cozy', emoji: '🧸', label: '溫柔療癒', desc: '喜歡讓人放鬆的氛圍' },
      { value: 'mysterious', emoji: '🌑', label: '神秘深沉', desc: '有故事的人' },
    ],
  },
  {
    id: 'avoid',
    title: '有什麼口感你絕對無法接受？',
    type: 'single',
    options: [
      { value: 'too_sweet', emoji: '🚫', label: '太甜膩' },
      { value: 'too_bitter', emoji: '😖', label: '太苦澀' },
      { value: 'too_strong', emoji: '🥵', label: '酒精太嗆' },
      { value: 'no_limit', emoji: '🆗', label: '我都能接受' },
    ],
  },
];

// 判斷某題是否已作答（多選要看陣列長度，滑桿永遠算已答）
function isAnswered(q) {
  if (q.type === 'slider') return true;
  const a = answers[q.id];
  if (q.type === 'multi') return Array.isArray(a) && a.length > 0;
  return Boolean(a);
}

let currentIdx = 0;
const answers = {};

const container = document.getElementById('quizContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressPct = document.getElementById('progressPct');

function renderQuestion() {
  const q = QUESTIONS[currentIdx];
  const total = QUESTIONS.length;
  const pct = ((currentIdx + 1) / total) * 100;

  progressText.textContent = `第 ${currentIdx + 1} / ${total} 題`;
  progressPct.textContent = `${Math.round(pct)}%`;
  progressFill.style.width = pct + '%';

  let html = `
    <div class="question-card">
      <div class="question-num">Q${String(currentIdx + 1).padStart(2, '0')}</div>
      <h2 class="question-title">${q.title}</h2>
      ${q.subtitle ? `<p class="question-subtitle">${q.subtitle}</p>` : ''}
  `;

  if (q.type === 'single' || q.type === 'multi') {
    const picked = q.type === 'multi' ? (answers[q.id] || []) : answers[q.id];
    html += `<div class="options-grid">`;
    q.options.forEach(opt => {
      const selected = q.type === 'multi'
        ? (picked.includes(opt.value) ? 'selected' : '')
        : (picked === opt.value ? 'selected' : '');
      html += `
        <button class="option-card ${selected}" data-value="${opt.value}">
          <div class="option-emoji">${opt.emoji}</div>
          <div class="option-body">
            <div class="option-label">${opt.label}</div>
            ${opt.desc ? `<div class="option-desc">${opt.desc}</div>` : ''}
          </div>
        </button>
      `;
    });
    html += `</div>`;
  } else if (q.type === 'slider') {
    const val = answers[q.id] ?? q.default;
    html += `
      <div class="slider-question">
        <div class="slider-row">
          <span><strong>${q.labels[0]}</strong></span>
          <span><strong>${q.labels[q.labels.length - 1]}</strong></span>
        </div>
        <input type="range" class="custom-slider" min="${q.min}" max="${q.max}" value="${val}" id="sliderInput" />
        <div class="slider-value" id="sliderVal">${q.labels[val - 1]}</div>
      </div>
    `;
  }

  html += `
      <div class="quiz-controls">
        <button class="btn-back" id="btnBack" ${currentIdx === 0 ? 'disabled' : ''}>← 上一題</button>
        <button class="btn-next" id="btnNext" ${isAnswered(q) ? '' : 'disabled'}>
          ${currentIdx === total - 1 ? '開始 AI 分析 ✨' : '下一題 →'}
        </button>
      </div>
    </div>
  `;
  container.innerHTML = html;

  // 綁定事件
  container.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      const val = card.dataset.value;
      if (q.type === 'multi') {
        const arr = answers[q.id] || (answers[q.id] = []);
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        card.classList.toggle('selected');
      } else {
        answers[q.id] = val;
        container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
      document.getElementById('btnNext').disabled = !isAnswered(q);
    });
  });

  if (q.type === 'slider') {
    const slider = document.getElementById('sliderInput');
    const sliderVal = document.getElementById('sliderVal');
    answers[q.id] = answers[q.id] ?? q.default;
    slider.addEventListener('input', e => {
      const v = Number(e.target.value);
      answers[q.id] = v;
      sliderVal.textContent = q.labels[v - 1];
    });
  }

  document.getElementById('btnBack').addEventListener('click', () => {
    if (currentIdx > 0) { currentIdx--; renderQuestion(); }
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    if (currentIdx < QUESTIONS.length - 1) { currentIdx++; renderQuestion(); }
    else submitQuiz();
  });
}

async function submitQuiz() {
  container.style.display = 'none';
  document.querySelector('.progress-wrap').style.display = 'none';
  const loading = document.getElementById('loadingScreen');
  loading.style.display = 'block';

  // 循環提示文字
  const tips = [
    '讀取你的風味 DNA...',
    '比對 480 款精選酒譜...',
    '計算情境匹配度...',
    '生成專屬推薦...',
  ];
  let tipIdx = 0;
  const tipInterval = setInterval(() => {
    tipIdx = (tipIdx + 1) % tips.length;
    document.getElementById('loadingSub').textContent = tips[tipIdx];
  }, 1800);

  try {
    const resp = await fetch('/api/taste-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const data = await resp.json();
    clearInterval(tipInterval);
    if (data.error) throw new Error(data.error);
    renderResult(data);
  } catch (err) {
    clearInterval(tipInterval);
    loading.innerHTML = `
      <div style="padding:60px 20px;text-align:center;">
        <h2 style="color:#FF4D8D;margin-bottom:12px;">分析失敗 😢</h2>
        <p style="color:var(--text-dim);margin-bottom:24px;">${err.message}</p>
        <button class="btn-primary" onclick="location.reload()">重試</button>
      </div>
    `;
  }
}

let lastQuizData = null;

function renderResult(data) {
  document.getElementById('loadingScreen').style.display = 'none';
  const result = document.getElementById('resultScreen');
  result.style.display = 'block';
  document.getElementById('profileText').textContent = data.profile || '';

  const nickEl = document.getElementById('profileNickname');
  if (nickEl) {
    nickEl.textContent = data.nickname || '';
    nickEl.style.display = data.nickname ? '' : 'none';
  }

  const traitsEl = document.getElementById('profileTraits');
  if (traitsEl) {
    traitsEl.innerHTML = (data.traits || []).map(t => `<span class="trait-chip">${t}</span>`).join('');
  }

  const recs = data.recommendations || [];
  const countEl = document.getElementById('recCount');
  if (countEl) countEl.textContent = `${recs.length} 款推薦`;

  const grid = document.getElementById('recGrid');
  grid.innerHTML = recs.map(r => `
    <div class="rec-card">
      <div class="rec-score">
        <span class="rec-score-num">${r.match_score || '--'}</span>
        <span class="rec-score-label">MATCH</span>
      </div>
      <div class="rec-name">${r.name}</div>
      <div class="rec-category">${r.category || ''}</div>
      ${r.origin ? `<div class="rec-origin">📍 ${r.origin}</div>` : ''}
      <div class="rec-tags">
        ${(r.flavor_tags || []).map(t => `<span class="rec-tag">${t}</span>`).join('')}
      </div>
      <div class="rec-reason">${r.reason || ''}</div>
      <div class="rec-tip"><strong>品飲建議：</strong>${r.serving_tip || ''}</div>
      ${r.food_pairing ? `<div class="rec-tip"><strong>餐搭：</strong>${r.food_pairing}</div>` : ''}
    </div>
  `).join('');

  lastQuizData = data;
  injectPublishRow('quiz', data.history_id);
}

window.addEventListener('pourmatch:authchange', () => {
  if (lastQuizData) injectPublishRow('quiz', lastQuizData.history_id);
});

function injectPublishRow(type, historyId) {
  const container = document.querySelector('.result-screen') || document.getElementById('resultScreen');
  if (!container) return;
  const old = container.querySelector('.publish-card');
  if (old) old.remove();

  const card = document.createElement('div');
  card.className = 'publish-card';

  if (!window.currentUser) {
    card.innerHTML = `
      <div class="publish-glow"></div>
      <div class="publish-locked">
        <div class="publish-lock-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#lockg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <defs>
              <linearGradient id="lockg" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stop-color="#FFB547"/><stop offset="50%" stop-color="#FF4D8D"/><stop offset="100%" stop-color="#7B5CFF"/>
              </linearGradient>
            </defs>
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="publish-lock-title">登入後即可發布到社群</div>
        <div class="publish-lock-sub">用 Google 一鍵登入 · 登入完成會自動回到這個結果頁<br/>讓其他酒友看見你的風味 DNA</div>
        <button class="btn-publish-hero btn-publish-login">
          <span class="bp-spark"></span>
          <span class="bp-text">🚀 登入並發布到社群</span>
        </button>
      </div>
    `;
    insertPublishCard(container, card);
    card.querySelector('.btn-publish-login').onclick = () => window.triggerLogin?.();
    return;
  }

  card.innerHTML = `
    <div class="publish-glow"></div>
    <div class="publish-header">
      <div class="publish-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14.5 8.5L21 9.27L16 13.97L17.18 20.5L12 17.27L6.82 20.5L8 13.97L3 9.27L9.5 8.5L12 2Z"
            stroke="url(#pubg)" stroke-width="1.5" stroke-linejoin="round" fill="url(#pubg)" fill-opacity="0.15"/>
          <defs>
            <linearGradient id="pubg" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stop-color="#FFB547"/>
              <stop offset="50%" stop-color="#FF4D8D"/>
              <stop offset="100%" stop-color="#7B5CFF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div>
        <div class="publish-title">把這份結果發布到社群</div>
        <div class="publish-sub">讓其他酒友看見你的風味 DNA · AI 也許會把你和他們配對</div>
      </div>
    </div>
    <textarea class="publish-caption" maxlength="280" placeholder="想對其他酒友說什麼？（選填）"></textarea>
    <button class="btn-publish-hero">
      <span class="bp-spark"></span>
      <span class="bp-text">📢 發布到 PourMatch 社群</span>
    </button>
  `;
  insertPublishCard(container, card);

  card.querySelector('.btn-publish-hero').onclick = async () => {
    const caption = card.querySelector('.publish-caption').value;
    const btn = card.querySelector('.btn-publish-hero');
    btn.disabled = true;
    btn.querySelector('.bp-text').textContent = '發布中…';

    let hid = historyId;
    try {
      if (!hid && lastQuizData) {
        const sr = await fetch('/api/save-result', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'quiz',
            payload: { answers, result: lastQuizData },
          }),
        });
        const sd = await sr.json();
        hid = sd.history_id;
        if (hid && lastQuizData) lastQuizData.history_id = hid;
      }
      if (!hid) throw new Error('無法儲存結果');

      const r = await fetch('/api/posts', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, history_id: hid, caption }),
      });
      if (r.status === 401) throw new Error('請先登入才能發布');
      const data = await r.json();
      if (data.id) {
        btn.querySelector('.bp-text').textContent = '✅ 已發布！前往社群查看 →';
        btn.onclick = () => location.href = 'community.html';
        btn.disabled = false;
      } else {
        throw new Error(data.error || '發布失敗');
      }
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.querySelector('.bp-text').textContent = '📢 發布到 PourMatch 社群';
    }
  };
}

function insertPublishCard(container, card) {
  const actions = container.querySelector('.result-actions');
  if (actions) container.insertBefore(card, actions);
  else container.appendChild(card);
}

renderQuestion();
