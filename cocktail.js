// ===== 調酒生成器邏輯 =====
const state = {
  base_spirit: [],
  flavors: [],
  mood: null,
  sweet: 3,
  strong: 3,
  free_text: '',
  // ===== 進階模式 =====
  adv_texture: [],
  adv_sour: 3,
  adv_bitter: 3,
  adv_ice: null,
  adv_glass: null,
  adv_complexity: null,
  adv_technique: [],
  adv_inspiration: null,
  adv_color: null,
  adv_diet: [],
  adv_naming: null,
};

// 進階欄位清單，用於統計「已設定幾項」與組裝送出的 payload
const ADV_CHIP_FIELDS = [
  'adv_texture', 'adv_ice', 'adv_glass', 'adv_complexity',
  'adv_technique', 'adv_inspiration', 'adv_color', 'adv_diet', 'adv_naming',
];
const ADV_SLIDER_DEFAULTS = { adv_sour: 3, adv_bitter: 3 };

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
        // 再點一次已選中的項目視為取消
        if (state[field] === val) {
          chip.classList.remove('selected');
          state[field] = null;
        } else {
          group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          state[field] = val;
        }
      }
      if (field.startsWith('adv_')) updateAdvCount();
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

// ===== 進階模式：滑桿、開關、計數 =====
const sourSlider = document.getElementById('sourSlider');
const bitterSlider = document.getElementById('bitterSlider');
sourSlider.addEventListener('input', e => {
  state.adv_sour = Number(e.target.value);
  document.getElementById('sourVal').textContent = state.adv_sour;
  updateAdvCount();
});
bitterSlider.addEventListener('input', e => {
  state.adv_bitter = Number(e.target.value);
  document.getElementById('bitterVal').textContent = state.adv_bitter;
  updateAdvCount();
});

// 計算使用者實際動過的進階項目數量（滑桿維持預設值不算）
function countAdvanced() {
  let n = 0;
  ADV_CHIP_FIELDS.forEach(f => {
    const v = state[f];
    if (Array.isArray(v)) { if (v.length) n++; }
    else if (v) n++;
  });
  Object.entries(ADV_SLIDER_DEFAULTS).forEach(([f, def]) => {
    if (state[f] !== def) n++;
  });
  return n;
}

function updateAdvCount() {
  const n = countAdvanced();
  const badge = document.getElementById('advCount');
  const btn = document.getElementById('advancedBtn');
  badge.textContent = n;
  badge.hidden = n === 0;
  btn.classList.toggle('has-advanced', n > 0);
}

// 只有實際設定過項目，才把進階偏好送給後端
function buildAdvancedPayload() {
  if (countAdvanced() === 0) return null;
  const adv = {};
  ADV_CHIP_FIELDS.forEach(f => {
    const v = state[f];
    if (Array.isArray(v) ? v.length : v) adv[f.replace('adv_', '')] = v;
  });
  Object.keys(ADV_SLIDER_DEFAULTS).forEach(f => {
    adv[f.replace('adv_', '')] = state[f];
  });
  return adv;
}

const advOverlay = document.getElementById('advOverlay');

function openAdvanced() {
  advOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeAdvanced() {
  advOverlay.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('advancedBtn').addEventListener('click', openAdvanced);
document.getElementById('advClose').addEventListener('click', closeAdvanced);
document.getElementById('advDone').addEventListener('click', closeAdvanced);
advOverlay.addEventListener('click', e => {
  if (e.target === advOverlay) closeAdvanced();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !advOverlay.hidden) closeAdvanced();
});

document.getElementById('advReset').addEventListener('click', () => {
  ADV_CHIP_FIELDS.forEach(f => { state[f] = Array.isArray(state[f]) ? [] : null; });
  Object.entries(ADV_SLIDER_DEFAULTS).forEach(([f, def]) => { state[f] = def; });
  advOverlay.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  sourSlider.value = ADV_SLIDER_DEFAULTS.adv_sour;
  bitterSlider.value = ADV_SLIDER_DEFAULTS.adv_bitter;
  document.getElementById('sourVal').textContent = ADV_SLIDER_DEFAULTS.adv_sour;
  document.getElementById('bitterVal').textContent = ADV_SLIDER_DEFAULTS.adv_bitter;
  updateAdvCount();
});

// 生成
document.getElementById('generateBtn').addEventListener('click', async () => {
  const advanced = buildAdvancedPayload();
  if (state.base_spirit.length === 0 && state.flavors.length === 0 && !state.mood
      && !state.free_text && !advanced) {
    alert(t('ck.need_input'));
    return;
  }

  document.getElementById('inputScreen').style.display = 'none';
  const loading = document.getElementById('loadingScreen');
  loading.style.display = 'block';

  const tips = [t('ck.tip1'), t('ck.tip2'), t('ck.tip3'), t('ck.tip4')];
  let tipIdx = 0;
  const tipInterval = setInterval(() => {
    tipIdx = (tipIdx + 1) % tips.length;
    document.getElementById('loadingSub').textContent = tips[tipIdx];
  }, 1800);

  try {
    const resp = await fetch('/api/cocktail-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: {
          base_spirit: state.base_spirit,
          flavors: state.flavors,
          mood: state.mood,
          sweet: state.sweet,
          strong: state.strong,
          free_text: state.free_text,
        },
        advanced,
        lang: getLang(),
      }),
    });
    const data = await resp.json();
    clearInterval(tipInterval);
    if (data.error) throw new Error(data.error);
    renderCocktail(data);
  } catch (err) {
    clearInterval(tipInterval);
    loading.innerHTML = `
      <div style="padding:60px 20px;text-align:center;">
        <h2 style="color:#FF4D8D;margin-bottom:12px;">${t('ck.failed')}</h2>
        <p style="color:var(--text-dim);margin-bottom:24px;">${err.message}</p>
        <button class="btn-primary" onclick="location.reload()">${t('common.retry')}</button>
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
    { key: 'sweet', label: t('ck.f_sweet') },
    { key: 'sour', label: t('ck.f_sour') },
    { key: 'bitter', label: t('ck.f_bitter') },
    { key: 'strong', label: t('ck.f_strong') },
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

  // 進階模式的額外欄位
  renderAdvancedResult(data);

  // 根據顏色描述改酒液漸層（簡單情境式變色）
  tintLiquidByColor(data.color || '');

  lastCocktailData = data;
  injectPublishRow('cocktail', data.history_id);
}

// 進階模式回傳的規格與延伸內容，基本模式不會有這些欄位
function renderAdvancedResult(data) {
  const wrap = document.getElementById('advResult');
  if (!wrap) return;

  const specs = [
    { label: t('ck.spec_technique'), value: data.technique },
    { label: t('ck.spec_difficulty'), value: data.difficulty },
    { label: t('ck.spec_time'), value: data.prep_time },
    { label: t('ck.spec_abv'), value: data.abv_estimate },
  ].filter(s => s.value);

  const proTips = data.pro_tips || [];
  const variations = data.variations || [];
  const mocktail = data.mocktail_version;

  if (!specs.length && !proTips.length && !variations.length && !mocktail) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  document.getElementById('advSpecGrid').innerHTML = specs.map(s => `
    <div class="adv-spec">
      <div class="adv-spec-label">${s.label}</div>
      <div class="adv-spec-value">${s.value}</div>
    </div>
  `).join('');

  const tipsBox = document.getElementById('advProTips');
  tipsBox.hidden = proTips.length === 0;
  document.getElementById('proTipsList').innerHTML = proTips.map(t => `<li>${t}</li>`).join('');

  const varBox = document.getElementById('advVariations');
  varBox.hidden = variations.length === 0;
  document.getElementById('variationsList').innerHTML = variations.map(v =>
    typeof v === 'string'
      ? `<li>${v}</li>`
      : `<li><strong>${v.name || ''}</strong>${v.name ? '：' : ''}${v.description || ''}</li>`
  ).join('');

  const mockBox = document.getElementById('advMocktail');
  mockBox.hidden = !mocktail;
  document.getElementById('mocktailText').textContent = mocktail || '';
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
        <div class="publish-lock-title">${t('pub.locked_title')}</div>
        <div class="publish-lock-sub">${t('pub.locked_sub_cocktail')}</div>
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
        <div class="publish-title">${t('pub.title_cocktail')}</div>
        <div class="publish-sub">${t('pub.sub_cocktail')}</div>
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
