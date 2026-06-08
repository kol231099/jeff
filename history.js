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
        <h2 class="gradient-text">請先登入</h2>
        <p style="color:var(--text-dim);margin-bottom:20px;">登入後即可查看你所有的品味測驗結果與 AI 調酒紀錄。</p>
        <p style="color:var(--text-dim);font-size:13px;">點擊右上角「使用 Google 登入」。</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="history-tabs">
      <button class="history-tab ${activeTab==='quiz'?'active':''}" data-tab="quiz">🍷 品味測驗</button>
      <button class="history-tab ${activeTab==='cocktail'?'active':''}" data-tab="cocktail">🍹 調酒生成</button>
    </div>
    <div class="history-list" id="historyList">
      <div style="text-align:center;color:var(--text-dim);padding:40px;">載入中...</div>
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
    document.getElementById('historyList').innerHTML = `<div class="history-empty">載入失敗：${err.message}</div>`;
  }
}

function renderList(list) {
  const wrap = document.getElementById('historyList');
  if (!list || list.length === 0) {
    wrap.innerHTML = `
      <div class="history-empty">
        <div class="big-emoji">${activeTab === 'quiz' ? '🍷' : '🍹'}</div>
        <h3>還沒有任何紀錄</h3>
        <p>${activeTab === 'quiz' ? '完成品味測驗後，結果會自動存到這裡' : '生成一杯專屬調酒後會自動存到這裡'}</p>
        <a href="${activeTab === 'quiz' ? 'quiz.html' : 'cocktail.html'}" class="btn-primary">立即開始 →</a>
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
              <div class="history-name">風味 DNA 分析</div>
              <div class="history-meta">${fmtDate(item.created_at)}</div>
            </div>
            <div class="history-meta">${recs.length} 款推薦</div>
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
              <div class="history-name">${r.cocktail_name || '未命名'}</div>
              <div class="history-meta">${fmtDate(item.created_at)} · ${r.glass || ''}</div>
            </div>
            <div class="history-meta" style="color:var(--accent-gold);">${r.tagline || ''}</div>
          </div>
          <div class="history-summary">${r.story || ''}</div>
          <div class="history-tags">
            <span class="history-tag">甜 ${fp.sweet ?? '-'}</span>
            <span class="history-tag">酸 ${fp.sour ?? '-'}</span>
            <span class="history-tag">苦 ${fp.bitter ?? '-'}</span>
            <span class="history-tag">烈 ${fp.strong ?? '-'}</span>
            ${r.color ? `<span class="history-tag">${r.color}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

window.addEventListener('load', () => setTimeout(loadHistory, 500));
