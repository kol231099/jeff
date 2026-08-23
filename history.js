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
        </div>
      `;
    }).join('');
  } else {
    wrap.innerHTML = list.map(item => {
      const r = item.result || {};
      const fp = r.flavor_profile || {};
      return `
        <div class="history-item">
          <div class="history-row">
            <div>
              <div class="history-name">${r.cocktail_name || t('hs.untitled')}</div>
              <div class="history-meta">${fmtDate(item.created_at)} · ${r.glass || ''}</div>
            </div>
            <div class="history-meta" style="color:var(--accent-gold);">${r.tagline || ''}</div>
          </div>
          <div class="history-summary">${r.story || ''}</div>
          <div class="history-tags">
            <span class="history-tag">${t('ck.f_sweet')} ${fp.sweet ?? '-'}</span>
            <span class="history-tag">${t('ck.f_sour')} ${fp.sour ?? '-'}</span>
            <span class="history-tag">${t('ck.f_bitter')} ${fp.bitter ?? '-'}</span>
            <span class="history-tag">${t('ck.f_strong')} ${fp.strong ?? '-'}</span>
            ${r.color ? `<span class="history-tag">${r.color}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

window.addEventListener('load', () => setTimeout(loadHistory, 500));
