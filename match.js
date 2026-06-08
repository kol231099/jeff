// ===== AI 酒友配對 =====
const body = document.getElementById('matchBody');

async function load() {
  body.innerHTML = `
    <div class="card" style="text-align:center;padding:60px 20px;">
      <div class="ai-core" style="margin:0 auto 20px;">
        <div class="core-ring r1"></div>
        <div class="core-ring r2"></div>
        <div class="core-ring r3"></div>
        <div class="core-center">AI</div>
      </div>
      <h2 style="margin-bottom:8px;" class="gradient-text">AI 正在分析全站酒友的味蕾頻率…</h2>
      <p style="color:var(--text-dim);">為你尋找最對味的 3 位</p>
    </div>`;

  try {
    const r = await fetch('/api/match', { credentials: 'include' });
    if (r.status === 401) {
      body.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:8px;">請先登入</h2>
        <p style="color:var(--text-dim);">登入後 AI 才能根據你的測驗結果配對</p></div>`;
      return;
    }
    const data = await r.json();
    if (!r.ok) {
      body.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:8px;">${data.error || '配對失敗'}</h2>
        <a href="quiz.html" class="btn-share" style="text-decoration:none;margin-top:16px;display:inline-block;">前往做品味測驗 →</a></div>`;
      return;
    }
    if (!data.matches?.length) {
      body.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:8px;">還沒有其他酒友</h2>
        <p style="color:var(--text-dim);">${data.message || '邀請朋友加入 PourMatch 吧！'}</p></div>`;
      return;
    }
    render(data.matches);
  } catch (e) {
    body.innerHTML = `<div class="card">配對失敗：${e.message}</div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render(matches) {
  body.innerHTML = `
    <div class="match-grid">
      ${matches.map((m, i) => `
        <div class="card match-card" data-code="${m.user.unique_code}">
          <div class="match-rank">#${i + 1}</div>
          <img class="match-avatar" src="${m.user.picture || ''}" referrerpolicy="no-referrer" alt="" />
          <div class="match-name">${m.user.name}</div>
          <div class="match-code">${m.user.unique_code || ''}</div>
          ${m.user.bio ? `<div class="match-bio">${escapeHtml(m.user.bio)}</div>` : ''}
          <div class="match-score">
            <span class="match-score-num">${m.match_score}</span>
            <span class="match-score-label">對味度</span>
          </div>
          <div class="match-comment">"${m.comment}"</div>
          <button class="btn-add-friend" data-code="${m.user.unique_code}">+ 加為好友</button>
        </div>
      `).join('')}
    </div>
    <div class="card" style="text-align:center;margin-top:20px;">
      <p style="color:var(--text-dim);margin-bottom:12px;">想看不一樣的結果？</p>
      <a href="quiz.html" class="btn-share" style="text-decoration:none;">🍷 重新做品味測驗</a>
      <button class="btn-share" id="btnRefresh" style="margin-left:8px;">🔄 重新配對</button>
    </div>
  `;

  document.querySelectorAll('.btn-add-friend').forEach(b => {
    b.onclick = async () => {
      const code = b.dataset.code;
      const r = await fetch('/api/friends/add', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (r.ok) { b.textContent = '✅ 已加為好友'; b.disabled = true; }
      else alert(data.error || '加好友失敗');
    };
  });
  document.getElementById('btnRefresh').onclick = load;
}

setTimeout(load, 300);
