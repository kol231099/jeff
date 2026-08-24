// ===== 歷史紀錄頁邏輯 =====
let activeTab = 'quiz';

function fmtDate(unix) {
  const d = new Date(unix * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadHistory() {
  const body = document.getElementById('historyBody');

  // 等 auth.js 跑完
  await new Promise(r => setTimeout(r, 400));

  if (!currentUser) {
    body.innerHTML = `
      <div class="login-prompt">
        <h2 class="gradient-text">${t('common.login_first')}</h2>
        <p style="color:var(--text-dim);margin-bottom:20px;">${t('hs.login_sub')}</p>
        <p style="color:var(--text-dim);font-size:13px;">${t('hs.login_hint')}</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="history-tabs">
      <button class="history-tab ${activeTab==='quiz'?'active':''}" data-tab="quiz">${t('hs.tab_quiz')}</button>
      <button class="history-tab ${activeTab==='cocktail'?'active':''}" data-tab="cocktail">${t('hs.tab_cocktail')}</button>
    </div>
    <div class="history-list" id="historyList">
      <div style="text-align:center;color:var(--text-dim);padding:40px;">${t('cm.loading')}</div>
    </div>
  `;

  document.querySelectorAll('.history-tab').forEach(t => {
    t.addEventListener('click', () => {
      activeTab = t.dataset.tab;
      loadHistory();
    });
  });

  try {
    const url = activeTab === 'quiz' ? '/api/history/quiz' : '/api/history/cocktail';
    const r = await fetch(url, { credentials: 'include' });
    const list = await r.json();
    renderList(list);
  } catch (err) {
    document.getElementById('historyList').innerHTML = `<div class="history-empty">${t('cm.load_failed')}：${err.message}</div>`;
  }
}


// ===== 展開後的細節 =====
// 刻意不沿用結果頁的視覺語彙（大酒杯、漸層標題、風味長條）。
// 這裡是「檔案」：標籤配數值、細線分隔、可以回頭核對當時的輸入。

// 儲存的是原始值（'fresh'、'tequila'），翻回人看得懂的字
function answerLabel(qid, val) {
  if (typeof val === 'number') return String(val);
  const k = `o.${qid}.${val}`;
  const got = t(k);
  return got === k ? val : got;      // 沒有對應翻譯就顯示原值
}
function questionLabel(qid) {
  const k = `q.${qid}.t`;
  const got = t(k);
  return got === k ? qid : got;
}

function specRows(obj, skip = []) {
  return Object.entries(obj || {})
    .filter(([k, v]) => !skip.includes(k) && v !== null && v !== '' &&
                        !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.map(x => answerLabel(k, x)).join('、')
                                   : answerLabel(k, v);
      return `<div class="dt-row"><dt>${questionLabel(k)}</dt><dd>${val}</dd></div>`;
    }).join('');
}

function quizDetail(item) {
  const r = item.result || {};
  const recs = r.recommendations || [];
  const traits = r.traits || [];
  return `
    <div class="dt">
      <section class="dt-sec">
        <h4>${t('hs.d_answers')}</h4>
        <dl class="dt-list">${specRows(item.answers)}</dl>
      </section>

      <section class="dt-sec">
        <h4>${t('hs.d_reading')}</h4>
        ${r.nickname ? `<p class="dt-lead">${r.nickname}</p>` : ''}
        <p class="dt-body">${r.profile || ''}</p>
        ${traits.length ? `<div class="dt-chips">${traits.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
      </section>

      <section class="dt-sec">
        <h4>${t('hs.d_recs', { n: recs.length })}</h4>
        <ol class="dt-recs">
          ${recs.map((x, i) => `
            <li>
              <div class="dt-rec-head">
                <span class="dt-idx">${String(i + 1).padStart(2, '0')}</span>
                <b>${x.name || ''}</b>
                ${x.match_score != null ? `<em>${x.match_score}</em>` : ''}
              </div>
              <div class="dt-rec-meta">${[x.category, x.origin].filter(Boolean).join(' · ')}</div>
              ${x.reason ? `<p>${x.reason}</p>` : ''}
              ${(x.flavor_tags || []).length ? `<div class="dt-chips sm">${x.flavor_tags.map(f => `<span>${f}</span>`).join('')}</div>` : ''}
              ${x.serving_tip ? `<div class="dt-note"><span>${t('hs.d_serving')}</span>${x.serving_tip}</div>` : ''}
              ${x.food_pairing ? `<div class="dt-note"><span>${t('hs.d_pairing')}</span>${x.food_pairing}</div>` : ''}
            </li>`).join('')}
        </ol>
      </section>
    </div>`;
}

function cocktailDetail(item) {
  const r = item.result || {};
  const fp = r.flavor_profile || {};
  const ing = r.ingredients || [];
  const steps = r.steps || [];
  return `
    <div class="dt">
      <section class="dt-sec">
        <h4>${t('hs.d_prefs')}</h4>
        <dl class="dt-list">${specRows(item.preferences, ['advanced'])}</dl>
      </section>

      <section class="dt-sec">
        <h4>${t('hs.d_structure')}</h4>
        <div class="dt-figures">
          ${[['ck.f_sweet', fp.sweet], ['ck.f_sour', fp.sour],
             ['ck.f_bitter', fp.bitter], ['ck.f_strong', fp.strong]]
            .map(([k, v]) => `<div><span>${t(k)}</span><b>${v ?? '—'}</b></div>`).join('')}
        </div>
        ${r.story ? `<p class="dt-body">${r.story}</p>` : ''}
      </section>

      <section class="dt-sec">
        <h4>${t('hs.d_recipe')}</h4>
        <dl class="dt-list">
          ${ing.map(x => typeof x === 'string'
            ? `<div class="dt-row"><dt>${x}</dt><dd></dd></div>`
            : `<div class="dt-row"><dt>${x.name || ''}</dt><dd>${x.amount || ''}</dd></div>`).join('')}
        </dl>
        <ol class="dt-steps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>
        ${r.garnish ? `<div class="dt-note"><span>${t('ck.garnish')}</span>${r.garnish}</div>` : ''}
      </section>
    </div>`;
}

// 點卡片展開／收合。高度用實際內容量測，才有平順的過場
function bindExpand() {
  document.querySelectorAll('.history-item').forEach(el => {
    const head = el.querySelector('.history-head');
    if (!head) return;
    head.addEventListener('click', () => {
      const panel = el.querySelector('.history-detail');
      const open = el.classList.toggle('open');
      head.setAttribute('aria-expanded', open);
      panel.style.height = open ? panel.scrollHeight + 'px' : '0px';
    });
  });
}

function renderList(list) {
  const wrap = document.getElementById('historyList');
  if (!list || list.length === 0) {
    wrap.innerHTML = `
      <div class="history-empty">
        <div class="big-emoji">${activeTab === 'quiz' ? '🍷' : '🍹'}</div>
        <h3>${t('hs.empty')}</h3>
        <p>${activeTab === 'quiz' ? t('hs.empty_quiz') : t('hs.empty_cocktail')}</p>
        <a href="${activeTab === 'quiz' ? 'quiz.html' : 'cocktail.html'}" class="btn-primary">${t('hs.start')}</a>
      </div>
    `;
    return;
  }

  if (activeTab === 'quiz') {
    wrap.innerHTML = list.map(item => {
      const recs = item.result?.recommendations || [];
      const profile = item.result?.profile || '';
      return `
        <div class="history-item">
          <button class="history-head" aria-expanded="false">
            <div class="history-row">
              <div>
                <div class="history-name">${t('hs.dna')}</div>
                <div class="history-meta">${fmtDate(item.created_at)}</div>
              </div>
              <div class="history-meta">${t('hs.rec_count', { n: recs.length })}</div>
            </div>
            <div class="history-summary">${profile}</div>
            <div class="history-tags">
              ${recs.slice(0, 6).map(r => `<span class="history-tag">${r.name}</span>`).join('')}
            </div>
            <span class="history-more">${t('hs.expand')}<i></i></span>
          </button>
          <div class="history-detail" style="height:0">${quizDetail(item)}</div>
        </div>
      `;
    }).join('');
  } else {
    wrap.innerHTML = list.map(item => {
      const r = item.result || {};
      const fp = r.flavor_profile || {};
      return `
        <div class="history-item">
          <button class="history-head" aria-expanded="false">
            <div class="history-row">
              <div>
                <div class="history-name">${r.cocktail_name || t('hs.untitled')}</div>
                <div class="history-meta">${fmtDate(item.created_at)} · ${r.glass || ''}</div>
              </div>
              <div class="history-meta" style="color:var(--accent-warm);">${r.tagline || ''}</div>
            </div>
            <div class="history-summary">${r.story || ''}</div>
            <div class="history-tags">
              <span class="history-tag">${t('ck.f_sweet')} ${fp.sweet ?? '-'}</span>
              <span class="history-tag">${t('ck.f_sour')} ${fp.sour ?? '-'}</span>
              <span class="history-tag">${t('ck.f_bitter')} ${fp.bitter ?? '-'}</span>
              <span class="history-tag">${t('ck.f_strong')} ${fp.strong ?? '-'}</span>
              ${r.color ? `<span class="history-tag">${r.color}</span>` : ''}
            </div>
            <span class="history-more">${t('hs.expand')}<i></i></span>
          </button>
          <div class="history-detail" style="height:0">${cocktailDetail(item)}</div>
        </div>
      `;
    }).join('');
  }
  bindExpand();
}

window.addEventListener('load', () => setTimeout(loadHistory, 500));
