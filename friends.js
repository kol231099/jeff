// ===== 朋友頁 =====
const body = document.getElementById('friendsBody');

async function load() {
  const meR = await fetch('/api/me', { credentials: 'include' });
  const me = (await meR.json()).user;
  if (!me) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:8px;">${t('common.login_first')}</h2>
        <p style="color:var(--text-dim);">${t('fr.login_sub')}</p>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="card code-card">
      <div class="code-label">${t('fr.my_code')}</div>
      <div class="code-value">${me.unique_code || '------'}</div>
      <div class="code-hint">${t('fr.code_hint')}</div>
    </div>

    <div class="card">
      <div class="card-title">${t('fr.add')}</div>
      <div class="friends-add-row">
        <input id="codeInput" type="text" maxlength="6" placeholder="${t('fr.code_ph')}" />
        <button class="btn-publish" id="btnAdd">${t('fr.add_btn')}</button>
      </div>
      <div id="addMsg" style="margin-top:10px;font-size:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">${t('fr.my_friends')} <span id="friendsCount" style="color:var(--text-dim);font-size:14px;font-weight:400;"></span></div>
      <div id="friendsList"></div>
    </div>
  `;

  document.getElementById('codeInput').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  document.getElementById('btnAdd').onclick = addFriend;
  loadFriends();
}

async function addFriend() {
  const code = document.getElementById('codeInput').value.trim();
  const msg = document.getElementById('addMsg');
  if (!code || code.length !== 6) {
    msg.textContent = t('fr.bad_code');
    msg.style.color = 'var(--accent-pink)';
    return;
  }
  const r = await fetch('/api/friends/add', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await r.json();
  if (!r.ok) {
    msg.textContent = data.error || t('fr.add_failed');
    msg.style.color = 'var(--accent-pink)';
    return;
  }
  msg.textContent = t('fr.added', { name: data.name });
  msg.style.color = 'var(--accent-gold)';
  document.getElementById('codeInput').value = '';
  loadFriends();
}

async function loadFriends() {
  const list = document.getElementById('friendsList');
  list.innerHTML = `<div style="padding:20px;color:var(--text-dim);">${t('cm.loading')}</div>`;
  const r = await fetch('/api/friends', { credentials: 'include' });
  const friends = await r.json();
  document.getElementById('friendsCount').textContent = `（${friends.length}）`;
  if (!friends.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-dim);">${t('fr.empty')}</div>`;
    return;
  }
  list.innerHTML = `<div class="friends-grid">${friends.map(f => `
    <div class="friend-card" data-id="${f.id}">
      <img src="${f.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <div class="friend-info">
        <div class="friend-name">${f.name}</div>
        <div class="friend-code">${f.unique_code || ''}</div>
        ${f.bio ? `<div class="friend-bio">${escapeHtml(f.bio)}</div>` : ''}
      </div>
      <button class="btn-remove" data-id="${f.id}">${t('fr.remove')}</button>
    </div>
  `).join('')}</div>`;
  list.querySelectorAll('.btn-remove').forEach(b => {
    b.onclick = async () => {
      if (!confirm(t('fr.confirm_remove'))) return;
      await fetch(`/api/friends/${b.dataset.id}`, { method: 'DELETE', credentials: 'include' });
      loadFriends();
    };
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

setTimeout(load, 300);
