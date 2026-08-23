// ===== 關於我 頁面 =====
const body = document.getElementById('profileBody');

async function load() {
  const r = await fetch('/api/me', { credentials: 'include' });
  const data = await r.json();
  if (!data.user) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:12px;">${t('common.login_first')}</h2>
        <p style="color:var(--text-dim);">${t('pf.login_sub')}</p>
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
      <div class="code-label">${t('pf.code_label')}</div>
      <div class="code-value" id="codeVal">${u.unique_code || '------'}</div>
      <div class="code-hint">${t('pf.code_hint')}</div>
      <button class="btn-copy" id="btnCopy">${t('pf.copy')}</button>
    </div>

    <div class="card">
      <div class="card-title">${t('pf.stats')}</div>
      <div class="stats-grid">
        <div class="stat-cell"><div class="stat-num">${u.stats.quiz_count}</div><div class="stat-label">${t('pf.stat_quiz')}</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.cocktail_count}</div><div class="stat-label">${t('pf.stat_cocktail')}</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.posts_count}</div><div class="stat-label">${t('pf.stat_posts')}</div></div>
        <div class="stat-cell"><div class="stat-num">${u.stats.friends_count}</div><div class="stat-label">${t('pf.stat_friends')}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${t('pf.bio')}</div>
      <div class="bio-edit">
        <textarea id="bioInput" maxlength="280" placeholder="${t('pf.bio_ph')}">${u.bio || ''}</textarea>
        <div class="bio-foot">
          <span id="bioCount">${(u.bio || '').length}/280</span>
          <button class="btn-publish" id="btnSaveBio">${t('pf.save')}</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${t('pf.quick')}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a class="btn-share" href="history.html" style="text-decoration:none;">${t('nav.history')}</a>
        <a class="btn-share" href="friends.html" style="text-decoration:none;">${t('nav.friends')}</a>
        <a class="btn-share" href="community.html" style="text-decoration:none;">🌐 ${t('nav.community')}</a>
        <a class="btn-share" href="match.html" style="text-decoration:none;">💞 ${t('nav.match')}</a>
      </div>
    </div>
  `;

  document.getElementById('btnCopy').onclick = () => {
    navigator.clipboard.writeText(u.unique_code || '');
    const btn = document.getElementById('btnCopy');
    const old = btn.textContent;
    btn.textContent = t('pf.copied');
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
      btn.textContent = t('pf.saved');
      setTimeout(() => btn.textContent = t('pf.save'), 1500);
    }
  };
}

setTimeout(load, 300);
