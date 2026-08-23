// ===== PourMatch 共用登入 / 使用者狀態 =====
// i18n.js 先載入，但仍留退路避免它失效時整個登入區壞掉
const T = (k) => (window.t ? window.t(k) : k);
const GOOGLE_CLIENT_ID = '988443784351-6agi102fhc4srccf2l4phi92hbu0jldt.apps.googleusercontent.com';

let currentUser = null;

function emitAuthChange() {
  window.currentUser = currentUser;
  window.dispatchEvent(new CustomEvent('pourmatch:authchange', { detail: { user: currentUser } }));
}

async function fetchMe() {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    const data = await r.json();
    currentUser = data.user;
  } catch { currentUser = null; }
  renderAuthUI();
  emitAuthChange();
}

async function handleCredentialResponse(response) {
  try {
    const r = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!r.ok) throw new Error('登入失敗');
    currentUser = await r.json();
    renderAuthUI();
    emitAuthChange();
  } catch (err) {
    alert(err.message);
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  currentUser = null;
  emitAuthChange();
  location.reload();
}

function bindUserChipToggle() {
  document.querySelectorAll('.user-chip').forEach(chip => {
    if (chip.dataset.toggleBound) return;
    chip.dataset.toggleBound = '1';
    chip.addEventListener('click', e => {
      // 讓選單裡的 a/button 可正常觸發
      if (e.target.closest('.user-menu')) return;
      e.stopPropagation();
      const open = chip.classList.toggle('open');
      // 同頁多個 chip 時，關掉其他
      if (open) {
        document.querySelectorAll('.user-chip.open').forEach(c => {
          if (c !== chip) c.classList.remove('open');
        });
      }
    });
  });
  if (!window._userChipOutsideBound) {
    window._userChipOutsideBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.user-chip.open').forEach(c => c.classList.remove('open'));
    });
  }
}

// 給結果頁的「登入並發布」按鈕呼叫
function triggerLogin() {
  if (!window.google?.accounts?.id) {
    alert('Google 登入服務尚未載入，請稍後再試');
    return;
  }
  // 先試 One Tap；若被擋掉則高亮右上角按鈕
  google.accounts.id.prompt(notification => {
    if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
      const btn = document.querySelector('.btn-login');
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.classList.add('btn-login-pulse');
        setTimeout(() => btn.classList.remove('btn-login-pulse'), 3000);
      }
    }
  });
}
window.triggerLogin = triggerLogin;

function renderAuthUI() {
  // 已登入：把所有 .btn-login 換成 user chip（dropdown 內含關於我/朋友/歷史）
  if (currentUser) {
    document.querySelectorAll('.btn-login').forEach(btn => {
      btn.outerHTML = `
        <div class="user-chip">
          <img src="${currentUser.picture}" alt="" referrerpolicy="no-referrer" />
          <span class="user-name">${currentUser.name || currentUser.email}</span>
          <div class="user-menu">
            <a href="profile.html">${T('nav.profile')}</a>
            <a href="friends.html">${T('nav.friends')}</a>
            <a href="history.html">${T('nav.history')}</a>
            <button onclick="logout()">${T('nav.logout_menu')}</button>
          </div>
        </div>
      `;
    });
    bindUserChipToggle();
    return;
  }

  // 未登入：把每個 .btn-login 用透明 Google 官方按鈕覆蓋
  document.querySelectorAll('.btn-login').forEach(btn => {
    if (btn.dataset.gsiReady) return;
    btn.dataset.gsiReady = '1';
    btn.style.position = btn.style.position || 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'gsi-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      opacity: 0.001;
      overflow: hidden;
      pointer-events: auto;
    `;
    btn.appendChild(overlay);

    const tryRender = () => {
      if (!window.google?.accounts?.id) return false;
      const rect = btn.getBoundingClientRect();
      google.accounts.id.renderButton(overlay, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        width: Math.max(200, Math.round(rect.width)),
        locale: (window.getLang && getLang() === 'zh') ? 'zh_TW' : 'en',
      });
      return true;
    };

    if (!tryRender()) {
      const iv = setInterval(() => {
        if (tryRender()) clearInterval(iv);
      }, 200);
      setTimeout(() => clearInterval(iv), 8000);
    }
  });
}

// 注入登入狀態樣式
(function injectAuthStyles() {
  const css = `
    .user-chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px 6px 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1.5px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 100px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .user-chip:hover {
      border-color: rgba(255, 181, 71, 0.4);
      background: rgba(255, 181, 71, 0.06);
    }
    .user-chip img {
      width: 30px; height: 30px;
      border-radius: 50%;
      object-fit: cover;
    }
    .user-chip .user-name {
      font-size: 14px;
      color: var(--text, #fff);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .user-menu {
      position: absolute;
      top: 100%;
      right: 0;
      min-width: 180px;
      padding: 14px 8px 8px;
      margin-top: -4px;
      background:
        linear-gradient(rgba(15,16,40,0.95), rgba(15,16,40,0.95)) padding-box,
        transparent border-box;
      background-clip: padding-box;
      backdrop-filter: blur(20px);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      opacity: 0;
      transform: translateY(-6px);
      pointer-events: none;
      transition: all 0.2s;
      z-index: 100;
    }
    .user-menu::before {
      content: '';
      position: absolute;
      top: -10px; left: 0; right: 0; height: 14px;
    }
    .user-chip.open .user-menu {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    @media (hover: hover) and (pointer: fine) {
      .user-chip:hover .user-menu,
      .user-menu:hover {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
    }
    .user-chip { user-select: none; -webkit-tap-highlight-color: transparent; }
    .user-menu a, .user-menu button {
      display: block;
      width: 100%;
      padding: 10px 14px;
      background: transparent;
      border: none;
      text-align: left;
      color: var(--text-dim, #9aa0c0);
      font-family: inherit;
      font-size: 14px;
      text-decoration: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .user-menu a:hover, .user-menu button:hover {
      background: rgba(255, 181, 71, 0.1);
      color: var(--text, #fff);
    }
    .btn-login-pulse {
      animation: btnLoginPulse 0.9s ease-in-out 3;
      box-shadow: 0 0 0 0 rgba(255,77,141,.6);
    }
    @keyframes btnLoginPulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,77,141,.65); }
      70%  { box-shadow: 0 0 0 18px rgba(255,77,141,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,77,141,0); }
    }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

window.addEventListener('load', () => {
  if (window.google?.accounts?.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
    });
    // 切換語言時重繪 Google 按鈕，否則它會停在初次渲染時的語系
    window.addEventListener('pourmatch:langchange', () => {
      document.querySelectorAll('.btn-login').forEach(b => { delete b.dataset.gsiReady; });
      document.querySelectorAll('.gsi-overlay').forEach(o => o.remove());
      renderAuthUI();
    });
  }
  fetchMe();
});
