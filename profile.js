// ===== 關於我 頁面 =====
const body = document.getElementById('profileBody');

async function load() {
  const r = await fetch('/api/me', { credentials: 'include' });
  const data = await r.json();
  if (!data.user) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:12px;">請先登入</h2>
        <p style="color:var(--text-dim);">用 Google 登入後即可查看你的個人資料與專屬代碼</p>
      </div>`;
    return;
  }
  render(data.user);
}

function render(u) {
  body.innerHTML = `
    <div class="card profile-hero">
      <img class="profile-avatar" src="${u.picture}" referrerpolicy="no-referrer" alt="" />
      <div class="profile-info">
        <div class="profile-name">${u.name || u.email}</div>
        <div class="profile-email">${u.email}</div>
      </div>
    </div>

    <div class="card code-card">
      <div class="code-label">你的專屬識別代碼</div>
      <div class="code-value" id="codeVal">${u.unique_code || '------'}</div>
      <div class="code-hint">把這組 6 碼分享給朋友，他們就能在「朋友」頁加你</div>
      <button class="btn-copy" id="btnCopy">📋 複製代碼</button>
    </div>

    <div class="card">
      <div class="card-title">我的數據</div>
      <div class="stats-grid">
        <div class="stat-cell"><div class="stat-num">${u.stats.quiz_count}</div><div class="stat-label">品味測驗</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.cocktail_count}</div><div class="stat-label">調酒生成</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.posts_count}</div><div class="stat-label">社群貼文</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.friends_count}</div><div class="stat-label">酒友人數</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">個人簡介</div>
      <div class="bio-edit">
        <textarea id="bioInput" maxlength="280" placeholder="簡短介紹你自己、最愛的酒款、或想交什麼樣的酒友...">${u.bio || ''}</textarea>
        <div class="bio-foot">
          <span id="bioCount">${(u.bio || '').length}/280</span>
          <button class="btn-publish" id="btnSaveBio">儲存</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">快速入口</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a class="btn-share" href="history.html" style="text-decoration:none;">📚 我的歷史</a>
        <a class="btn-share" href="friends.html" style="text-decoration:none;">👥 朋友</a>
        <a class="btn-share" href="community.html" style="text-decoration:none;">🌐 社群</a>
        <a class="btn-share" href="match.html" style="text-decoration:none;">💞 AI 配對</a>
      </div>
    </div>
  `;

  document.getElementById('btnCopy').onclick = () => {
    navigator.clipboard.writeText(u.unique_code || '');
    const btn = document.getElementById('btnCopy');
    const old = btn.textContent;
    btn.textContent = '✅ 已複製';
    setTimeout(() => btn.textContent = old, 1500);
  };

  const bio = document.getElementById('bioInput');
  bio.addEventListener('input', () => {
    document.getElementById('bioCount').textContent = `${bio.value.length}/280`;
  });
  document.getElementById('btnSaveBio').onclick = async () => {
    const r = await fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: bio.value }),
    });
    if (r.ok) {
      const btn = document.getElementById('btnSaveBio');
      btn.textContent = '✅ 已儲存';
      setTimeout(() => btn.textContent = '儲存', 1500);
    }
  };
}

setTimeout(load, 300);
