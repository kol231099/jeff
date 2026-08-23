// ===== 品味測驗邏輯 =====
// 題目文字全部放在 i18n.js，這裡只留結構；切換語言時重新渲染即可
const QUESTIONS = [
  {
    id: 'taste',
    type: 'single',
    options: [
      { value: 'sweet', emoji: '🍯' },
      { value: 'bitter', emoji: '☕' },
      { value: 'smoky', emoji: '🔥' },
      { value: 'fresh', emoji: '🌿' },
    ],
  },
  {
    id: 'aroma',
    type: 'multi',
    hasSubtitle: true,
    options: [
      { value: 'citrus', emoji: '🍊' },
      { value: 'floral', emoji: '🌸' },
      { value: 'spice', emoji: '🌶️' },
      { value: 'wood', emoji: '🪵' },
      { value: 'tropical', emoji: '🥭' },
      { value: 'herbal', emoji: '🌿' },
      { value: 'roast', emoji: '☕' },
      { value: 'mineral', emoji: '🧂' },
    ],
  },
  {
    id: 'texture',
    type: 'single',
    options: [
      { value: 'sparkling', emoji: '🫧' },
      { value: 'silky', emoji: '🥛' },
      { value: 'crisp', emoji: '❄️' },
      { value: 'viscous', emoji: '🍯' },
    ],
  },
  {
    id: 'strength',
    type: 'slider',
    min: 1, max: 5, default: 3,
  },
  {
    id: 'sourness',
    type: 'slider',
    min: 1, max: 5, default: 3,
  },
  {
    id: 'base',
    type: 'multi',
    hasSubtitle: true,
    options: [
      { value: 'gin', emoji: '🌲' },
      { value: 'whisky', emoji: '🥃' },
      { value: 'rum', emoji: '🏝️' },
      { value: 'tequila', emoji: '🌵' },
      { value: 'vodka', emoji: '💎' },
      { value: 'brandy', emoji: '🍇' },
      { value: 'sake', emoji: '🍶' },
      { value: 'any', emoji: '🎲' },
    ],
  },
  {
    id: 'mood',
    type: 'single',
    options: [
      { value: 'chill', emoji: '🌙' },
      { value: 'romantic', emoji: '💞' },
      { value: 'party', emoji: '🎉' },
      { value: 'deep', emoji: '🗣️' },
    ],
  },
  {
    id: 'occasion',
    type: 'single',
    options: [
      { value: 'home', emoji: '🛋️' },
      { value: 'bar', emoji: '🍸' },
      { value: 'restaurant', emoji: '🍽️' },
      { value: 'outdoor', emoji: '🌌' },
    ],
  },
  {
    id: 'timing',
    type: 'single',
    options: [
      { value: 'aperitif', emoji: '🌇' },
      { value: 'dinner', emoji: '🍽️' },
      { value: 'late', emoji: '🌃' },
      { value: 'brunch', emoji: '☀️' },
    ],
  },
  {
    id: 'adventure',
    type: 'slider',
    min: 1, max: 5, default: 3,
  },
  {
    id: 'personality',
    type: 'single',
    options: [
      { value: 'bold', emoji: '⚡' },
      { value: 'elegant', emoji: '🎭' },
      { value: 'cozy', emoji: '🧸' },
      { value: 'mysterious', emoji: '🌑' },
    ],
  },
  {
    id: 'avoid',
    type: 'single',
    options: [
      { value: 'too_sweet', emoji: '🚫' },
      { value: 'too_bitter', emoji: '😖' },
      { value: 'too_strong', emoji: '🥵' },
      { value: 'no_limit', emoji: '🆗' },
    ],
  },
];

// 題目與選項文字都用組合出來的鍵查字典
const qTitle = q => t(`q.${q.id}.t`);
const qSub = q => (q.hasSubtitle ? t(`q.${q.id}.s`) : '');
const oLabel = (q, v) => t(`o.${q.id}.${v}`);
const oDesc = (q, v) => { const k = `o.${q.id}.${v}.d`; const s = t(k); return s === k ? '' : s; };
const slLabel = (q, i) => t(`sl.${q.id}.${i}`);

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

  progressText.textContent = t('quiz.progress', { n: currentIdx + 1, total });
  progressPct.textContent = `${Math.round(pct)}%`;
  progressFill.style.width = pct + '%';

  let html = `
    <div class="question-card">
      <div class="question-num">Q${String(currentIdx + 1).padStart(2, '0')}</div>
      <h2 class="question-title">${qTitle(q)}</h2>
      ${q.hasSubtitle ? `<p class="question-subtitle">${qSub(q)}</p>` : ''}
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
            <div class="option-label">${oLabel(q, opt.value)}</div>
            ${oDesc(q, opt.value) ? `<div class="option-desc">${oDesc(q, opt.value)}</div>` : ''}
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
          <span><strong>${slLabel(q, 1)}</strong></span>
          <span><strong>${slLabel(q, q.max)}</strong></span>
        </div>
        <input type="range" class="custom-slider" min="${q.min}" max="${q.max}" value="${val}" id="sliderInput" />
        <div class="slider-value" id="sliderVal">${slLabel(q, val)}</div>
      </div>
    `;
  }

  html += `
      <div class="quiz-controls">
        <button class="btn-back" id="btnBack" ${currentIdx === 0 ? 'disabled' : ''}>${t('quiz.back')}</button>
        <button class="btn-next" id="btnNext" ${isAnswered(q) ? '' : 'disabled'}>
          ${currentIdx === total - 1 ? t('quiz.analyse') : t('quiz.next')}
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
      sliderVal.textContent = slLabel(q, v);
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
  const tips = [t('quiz.tip1'), t('quiz.tip2'), t('quiz.tip3'), t('quiz.tip4')];
  let tipIdx = 0;
  const tipInterval = setInterval(() => {
    tipIdx = (tipIdx + 1) % tips.length;
    document.getElementById('loadingSub').textContent = tips[tipIdx];
  }, 1800);

  try {
    const resp = await fetch('/api/taste-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, lang: getLang() }),
    });
    const data = await resp.json();
    clearInterval(tipInterval);
    if (data.error) throw new Error(data.error);
    renderResult(data);
  } catch (err) {
    clearInterval(tipInterval);
    loading.innerHTML = `
      <div style="padding:60px 20px;text-align:center;">
        <h2 style="color:#FF4D8D;margin-bottom:12px;">${t('quiz.failed')}</h2>
        <p style="color:var(--text-dim);margin-bottom:24px;">${err.message}</p>
        <button class="btn-primary" onclick="location.reload()">${t('common.retry')}</button>
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
  if (countEl) countEl.textContent = t('quiz.rec_count', { n: recs.length });

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
      <div class="rec-tip"><strong>${t('quiz.serving')}</strong>${r.serving_tip || ''}</div>
      ${r.food_pairing ? `<div class="rec-tip"><strong>${t('quiz.pairing')}</strong>${r.food_pairing}</div>` : ''}
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
        <div class="publish-lock-title">${t('pub.locked_title')}</div>
        <div class="publish-lock-sub">${t('pub.locked_sub_quiz')}</div>
        <button class="btn-publish-hero btn-publish-login">
          <span class="bp-spark"></span>
          <span class="bp-text">${t('pub.login_publish')}</span>
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
        <div class="publish-title">${t('pub.title_quiz')}</div>
        <div class="publish-sub">${t('pub.sub_quiz')}</div>
      </div>
    </div>
    <textarea class="publish-caption" maxlength="280" placeholder="${t('pub.caption_ph')}"></textarea>
    <button class="btn-publish-hero">
      <span class="bp-spark"></span>
      <span class="bp-text">${t('pub.publish')}</span>
    </button>
  `;
  insertPublishCard(container, card);

  card.querySelector('.btn-publish-hero').onclick = async () => {
    const caption = card.querySelector('.publish-caption').value;
    const btn = card.querySelector('.btn-publish-hero');
    btn.disabled = true;
    btn.querySelector('.bp-text').textContent = t('pub.publishing');

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
      if (!hid) throw new Error(t('pub.save_failed'));

      const r = await fetch('/api/posts', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, history_id: hid, caption }),
      });
      if (r.status === 401) throw new Error(t('pub.need_login'));
      const data = await r.json();
      if (data.id) {
        btn.querySelector('.bp-text').textContent = t('pub.published');
        btn.onclick = () => location.href = 'community.html';
        btn.disabled = false;
      } else {
        throw new Error(data.error || t('pub.publish_failed'));
      }
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.querySelector('.bp-text').textContent = t('pub.publish');
    }
  };
}

function insertPublishCard(container, card) {
  const actions = container.querySelector('.result-actions');
  if (actions) container.insertBefore(card, actions);
  else container.appendChild(card);
}

renderQuestion();
window.addEventListener('pourmatch:langchange', () => {
  if (document.getElementById('resultScreen').style.display !== 'block') renderQuestion();
});
