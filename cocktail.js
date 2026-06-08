// ===== 調酒生成器邏輯 =====
const state = {
  base_spirit: [],
  flavors: [],
  mood: null,
  sweet: 3,
  strong: 3,
  free_text: '',
};

// Chip 多選 / 單選
document.querySelectorAll('.chip-group').forEach(group => {
  const field = group.dataset.field;
  const multi = group.dataset.multi === 'true';

  group.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value;
      if (multi) {
        chip.classList.toggle('selected');
        const arr = state[field];
        const idx = arr.indexOf(val);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(val);
      } else {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        state[field] = val;
      }
    });
  });
});

// 滑桿
const sweetSlider = document.getElementById('sweetSlider');
const strongSlider = document.getElementById('strongSlider');
sweetSlider.addEventListener('input', e => {
  state.sweet = Number(e.target.value);
  document.getElementById('sweetVal').textContent = state.sweet;
});
strongSlider.addEventListener('input', e => {
  state.strong = Number(e.target.value);
  document.getElementById('strongVal').textContent = state.strong;
});

// 自由文字
document.getElementById('freeText').addEventListener('input', e => {
  state.free_text = e.target.value;
});

// 生成
document.getElementById('generateBtn').addEventListener('click', async () => {
  if (state.base_spirit.length === 0 && state.flavors.length === 0 && !state.mood && !state.free_text) {
    alert('至少選擇一項偏好，或在自由文字欄留言');
    return;
  }

  document.getElementById('inputScreen').style.display = 'none';
  const loading = document.getElementById('loadingScreen');
  loading.style.display = 'block';

  const tips = [
    '融合風味的分子...',
    '平衡甜酸苦的比例...',
    '尋找靈感故事...',
    '雕琢最後一滴...',
  ];
  let tipIdx = 0;
  const tipInterval = setInterval(() => {
    tipIdx = (tipIdx + 1) % tips.length;
    document.getElementById('loadingSub').textContent = tips[tipIdx];
  }, 1800);

  try {
    const resp = await fetch('/api/cocktail-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: state }),
    });
    const data = await resp.json();
    clearInterval(tipInterval);
    if (data.error) throw new Error(data.error);
    renderCocktail(data);
  } catch (err) {
    clearInterval(tipInterval);
    loading.innerHTML = `
      <div style="padding:60px 20px;text-align:center;">
        <h2 style="color:#FF4D8D;margin-bottom:12px;">生成失敗 😢</h2>
        <p style="color:var(--text-dim);margin-bottom:24px;">${err.message}</p>
        <button class="btn-primary" onclick="location.reload()">重試</button>
      </div>
    `;
  }
});

let lastCocktailData = null;

window.addEventListener('pourmatch:authchange', () => {
  if (lastCocktailData) injectPublishRow('cocktail', lastCocktailData.history_id);
});

function renderCocktail(data) {
  document.getElementById('loadingScreen').style.display = 'none';
  const result = document.getElementById('resultScreen');
  result.style.display = 'block';

  document.getElementById('cockTagline').textContent = data.tagline || '';
  document.getElementById('cockName').textContent = data.cocktail_name || '';
  document.getElementById('cockGlass').textContent = data.glass || '';
  document.getElementById('cockColor').textContent = data.color || '';
  document.getElementById('cockStory').textContent = data.story || '';
  document.getElementById('garnishText').textContent = data.garnish || '';

  // 風味條
  const fp = data.flavor_profile || {};
  const flavorMap = [
    { key: 'sweet', label: '甜' },
    { key: 'sour', label: '酸' },
    { key: 'bitter', label: '苦' },
    { key: 'strong', label: '烈' },
  ];
  document.getElementById('flavorBars').innerHTML = flavorMap.map((f, i) => `
    <div class="flavor-bar">
      <span class="flavor-name">${f.label}</span>
      <div class="flavor-track">
        <div class="flavor-fill ${i >= 2 ? 'b' : ''}" style="width:${((fp[f.key] || 0) / 5) * 100}%"></div>
      </div>
    </div>
  `).join('');

  // 材料
  document.getElementById('ingredientList').innerHTML =
    (data.ingredients || []).map(ing => `
      <li>
        <span class="ing-name">${ing.name}</span>
        <span class="ing-amount">${ing.amount}</span>
      </li>
    `).join('');

  // 步驟
  document.getElementById('stepsList').innerHTML =
    (data.steps || []).map(s => `<li>${s}</li>`).join('');

  // 根據顏色描述改酒液漸層（簡單情境式變色）
  tintLiquidByColor(data.color || '');

  lastCocktailData = data;
  injectPublishRow('cocktail', data.history_id);
}

function injectPublishRow(type, historyId) {
  const container = document.getElementById('resultScreen');
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#lockg2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <defs>
              <linearGradient id="lockg2" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stop-color="#FFB547"/><stop offset="50%" stop-color="#FF4D8D"/><stop offset="100%" stop-color="#7B5CFF"/>
              </linearGradient>
            </defs>
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="publish-lock-title">登入後即可發布到社群</div>
        <div class="publish-lock-sub">用 Google 一鍵登入 · 登入完成會自動回到這個結果頁<br/>讓其他酒友嘗試你的 AI 獨家配方</div>
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
            stroke="url(#pubg2)" stroke-width="1.5" stroke-linejoin="round" fill="url(#pubg2)" fill-opacity="0.15"/>
          <defs>
            <linearGradient id="pubg2" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stop-color="#FFB547"/>
              <stop offset="50%" stop-color="#FF4D8D"/>
              <stop offset="100%" stop-color="#7B5CFF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div>
        <div class="publish-title">把這杯獨家調酒發布到社群</div>
        <div class="publish-sub">讓其他酒友嘗試你的 AI 配方 · 收集按讚與留言</div>
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
      if (!hid && lastCocktailData) {
        const sr = await fetch('/api/save-result', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'cocktail',
            payload: { preferences: state, result: lastCocktailData },
          }),
        });
        const sd = await sr.json();
        hid = sd.history_id;
        if (hid && lastCocktailData) lastCocktailData.history_id = hid;
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

function tintLiquidByColor(desc) {
  const d = desc.toLowerCase();
  let top = '#FFB547', bottom = '#FF4D8D';
  if (/綠|green|emerald/.test(d)) { top = '#00E5A0'; bottom = '#00B8A3'; }
  else if (/藍|blue|sapphire/.test(d)) { top = '#4DA6FF'; bottom = '#7B5CFF'; }
  else if (/紫|purple|violet/.test(d)) { top = '#C56BFF'; bottom = '#7B5CFF'; }
  else if (/紅|red|crimson|ruby/.test(d)) { top = '#FF6B6B'; bottom = '#C70039'; }
  else if (/黃|yellow|gold|honey/.test(d)) { top = '#FFD24D'; bottom = '#FFB547'; }
  else if (/黑|dark|midnight/.test(d)) { top = '#3D2A5A'; bottom = '#1A0E2E'; }
  else if (/白|white|cream|milk/.test(d)) { top = '#FFF4D6'; bottom = '#FFD6B0'; }
  document.getElementById('liqStop1')?.setAttribute('stop-color', top);
  document.getElementById('liqStop2')?.setAttribute('stop-color', bottom);
}
