// ===== 朋友頁 =====
const body = document.getElementById('friendsBody');

async function load() {
  const meR = await fetch('/api/me', { credentials: 'include' });
  const me = (await meR.json()).user;
  if (!me) {
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <h2 style="margin-bottom:8px;">請先登入</h2>
        <p style="color:var(--text-dim);">登入後才能加好友、查看好友列表</p>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="card code-card">
      <div class="code-label">我的識別代碼</div>
      <div class="code-value">${me.unique_code || '------'}</div>
      <div class="code-hint">把這組分享給朋友，他們在下方輸入即可加你</div>
    </div>

    <div class="card">
      <div class="card-title">加好友</div>
      <div class="friends-add-row">
        <input id="codeInput" type="text" maxlength="6" placeholder="輸入對方的 6 碼識別代碼（如 A8K3M2）" />
        <button class="btn-publish" id="btnAdd">加為好友</button>
      </div>
      <div id="addMsg" style="margin-top:10px;font-size:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">我的好友 <span id="friendsCount" style="color:var(--text-dim);font-size:14px;font-weight:400;"></span></div>
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
    msg.textContent = '請輸入完整的 6 碼識別代碼';
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
    msg.textContent = data.error || '加好友失敗';
    msg.style.color = 'var(--accent-pink)';
    return;
  }
  msg.textContent = `✅ 已加 ${data.name} 為好友`;
  msg.style.color = 'var(--accent-gold)';
  document.getElementById('codeInput').value = '';
  loadFriends();
}

async function loadFriends() {
  const list = document.getElementById('friendsList');
  list.innerHTML = `<div style="padding:20px;color:var(--text-dim);">載入中…</div>`;
  const r = await fetch('/api/friends', { credentials: 'include' });
  const friends = await r.json();
  document.getElementById('friendsCount').textContent = `（${friends.length}）`;
  if (!friends.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-dim);">還沒有酒友，去 AI 配對找找看吧 →</div>`;
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
      <button class="btn-remove" data-id="${f.id}">移除</button>
    </div>
  `).join('')}</div>`;
  list.querySelectorAll('.btn-remove').forEach(b => {
    b.onclick = async () => {
      if (!confirm('確定移除這位酒友？')) return;
      await fetch(`/api/friends/${b.dataset.id}`, { method: 'DELETE', credentials: 'include' });
      loadFriends();
    };
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

setTimeout(load, 300);
