// ===== AI 酒友配對 =====
const body = document.getElementById('matchBody');
const tabsEl = document.getElementById('tabs');
const roomsBadge = document.getElementById('roomsBadge');

let currentTab = 'online';
let pollTimer = null;      // 聊天室輪詢
let roomsTimer = null;     // 未讀數輪詢
let openRoom = null;       // 目前開啟的房間
let lastMsgId = 0;
let lastRendered = null;   // 用來判斷連續訊息是否收合

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const api = (path, opts = {}) =>
  fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ---------------- 版面狀態 ---------------- */
function stateCard(title, sub, action = '') {
  return `<div class="card state-card">
    <h2>${esc(title)}</h2>
    ${sub ? `<p>${esc(sub)}</p>` : ''}
    ${action}
  </div>`;
}

function loadingCard(text) {
  return `<div class="card state-card">
    <div class="ai-core" style="margin:0 auto 20px;">
      <div class="core-ring r1"></div><div class="core-ring r2"></div><div class="core-ring r3"></div>
      <div class="core-center">AI</div>
    </div>
    <h2 class="gradient-text">${esc(text)}</h2>
  </div>`;
}

/* ---------------- 候選清單 ---------------- */
async function loadCandidates(mode) {
  body.innerHTML = loadingCard(t('m.comparing'));
  try {
    const r = await api(`/api/match/candidates?mode=${mode === 'online' ? 'online' : 'all'}&limit=20`);
    if (r.status === 401) {
      body.innerHTML = stateCard(t('common.login_first'), t('m.login_to_match'));
      return;
    }
    const data = await r.json();
    if (!r.ok) {
      body.innerHTML = stateCard(data.error || t('m.match_failed'), '',
        `<a href="quiz.html" class="btn-primary state-btn">${t('m.take_quiz_first')}</a>`);
      return;
    }
    if (!data.candidates?.length) {
      body.innerHTML = stateCard(t('m.no_candidates'), t('m.no_candidates_sub'));
      return;
    }
    renderCandidates(data);
  } catch (e) {
    body.innerHTML = stateCard(t('m.match_failed'), e.message);
  }
}

function renderCandidates(data) {
  const notice = data.fallback
    ? `<div class="notice">${esc(data.message || t('m.no_one_online'))}</div>` : '';

  body.innerHTML = notice + `<div class="cand-grid">` + data.candidates.map(c => `
    <div class="card cand-card" data-id="${c.user.id}">
      <div class="cand-top">
        <div class="cand-avatar-wrap">
          <img class="cand-avatar" src="${esc(c.user.picture)}" referrerpolicy="no-referrer" alt="" />
          ${c.user.online ? `<span class="dot-online" title="${t('common.online')}"></span>` : ''}
        </div>
        <div class="cand-meta">
          <div class="cand-name">${esc(c.user.name)}</div>
          <div class="cand-code">${esc(c.user.unique_code || '')}</div>
        </div>
        <div class="cand-score">
          <span class="cand-score-num">${c.match_percent}</span>
          <span class="cand-score-label">${t('m.overlap')}</span>
        </div>
      </div>

      <div class="cand-bar"><div class="cand-bar-fill" style="width:${c.match_percent}%"></div></div>

      ${c.shared?.length
        ? `<div class="cand-shared">${t('m.agree_on')}${c.shared.map(s => `<span>${esc(t(s))}</span>`).join('')}</div>`
        : `<div class="cand-shared dim">${t('m.little_overlap')}</div>`}

      ${c.user.bio ? `<div class="cand-bio">${esc(c.user.bio)}</div>` : ''}

      <div class="cand-actions">
        <button class="btn-pass" data-action="pass" data-id="${c.user.id}">${t('m.pass')}</button>
        <button class="btn-like" data-action="like" data-id="${c.user.id}"
                data-name="${esc(c.user.name)}" data-pic="${esc(c.user.picture)}"
                data-pct="${c.match_percent}">${t('m.like')}</button>
      </div>
    </div>`).join('') + `</div>`;
}

async function act(btn) {
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const card = btn.closest('.cand-card');
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    const r = await api('/api/match/action', {
      method: 'POST',
      body: JSON.stringify({ to_user: id, action }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('m.action_failed'));

    card.classList.add('gone');
    setTimeout(() => {
      card.remove();
      if (!document.querySelector('.cand-card')) {
        body.innerHTML = stateCard(t('m.round_done'), t('m.round_done_sub'));
      }
    }, 260);

    if (data.matched) {
      showMatch(btn.dataset.name, btn.dataset.pic, btn.dataset.pct, data.room_id);
      refreshRoomsBadge();
    }
  } catch (e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    alert(e.message);
  }
}

/* ---------------- 配對成功 ---------------- */
const modal = document.getElementById('matchModal');
document.getElementById('mmLater').onclick = () => { modal.hidden = true; };

function showMatch(name, pic, pct, roomId) {
  document.getElementById('mmMe').src = window.currentUser?.picture || '';
  document.getElementById('mmThem').src = pic || '';
  document.getElementById('mmName').textContent = t('m.matched_with', { name });
  document.getElementById('mmSub').textContent = t('m.matched_sub', { pct });
  document.getElementById('mmChat').onclick = () => {
    modal.hidden = true;
    switchTab('rooms');
    setTimeout(() => enterRoom(roomId), 260);
  };
  modal.hidden = false;
}

/* ---------------- 我的配對 / 聊天 ---------------- */
async function loadRooms() {
  stopPolling();
  openRoom = null;
  document.body.classList.remove('chat-open');
  body.innerHTML = loadingCard(t('m.loading_rooms'));
  try {
    const r = await api('/api/rooms');
    if (r.status === 401) { body.innerHTML = stateCard(t('common.login_first'), ''); return; }
    const { rooms } = await r.json();
    updateBadge(rooms);

    if (!rooms.length) {
      body.innerHTML = stateCard(t('m.no_rooms'), t('m.no_rooms_sub'));
      return;
    }
    body.innerHTML = `<div class="room-list">` + rooms.map(rm => {
      const other = rm.members[0];
      const preview = rm.last_message ? rm.last_message.body : t('m.no_messages_yet');
      return `<div class="card room-item" data-room="${rm.id}">
        <div class="cand-avatar-wrap">
          <img class="cand-avatar" src="${esc(other?.picture)}" referrerpolicy="no-referrer" alt="" />
          ${other?.online ? '<span class="dot-online"></span>' : ''}
        </div>
        <div class="room-meta">
          <div class="room-name">${esc(other?.name || t('m.drinker'))}</div>
          <div class="room-preview">${esc(preview)}</div>
        </div>
        ${rm.unread ? `<span class="room-unread">${rm.unread}</span>` : ''}
      </div>`;
    }).join('') + `</div>`;
  } catch (e) {
    body.innerHTML = stateCard(t('m.load_failed'), e.message);
  }
}

async function enterRoom(roomId) {
  stopPolling();
  openRoom = roomId;
  lastMsgId = 0;
  lastRendered = null;
  document.body.classList.add('chat-open');

  const r = await api('/api/rooms');
  const { rooms } = await r.json();
  const rm = rooms.find(x => x.id === roomId);
  const other = rm?.members?.[0];

  body.innerHTML = `
    <div class="chat-wrap card">
      <div class="chat-head">
        <button class="chat-back" id="chatBack">←</button>
        <img class="chat-avatar" src="${esc(other?.picture)}" referrerpolicy="no-referrer" alt="" />
        <div>
          <div class="chat-name">${esc(other?.name || t('m.drinker'))}</div>
          <div class="chat-status">${other?.online ? t('common.online') : t('common.offline')}</div>
        </div>
      </div>
      <div class="chat-log" id="chatLog"></div>
      <form class="chat-form" id="chatForm">
        <input class="chat-input" id="chatInput" maxlength="1000" placeholder="${t('m.chat_ph')}" autocomplete="off" />
        <button class="chat-send" type="submit">${t('m.send')}</button>
      </form>
    </div>`;

  document.getElementById('chatBack').onclick = () => { document.body.classList.remove('chat-open'); loadRooms(); };
  document.getElementById('chatForm').onsubmit = sendMessage;

  await pullMessages(true);
  // 輪詢就夠了：這個規模不需要 WebSocket
  pollTimer = setInterval(() => pullMessages(false), 3000);
}

async function pullMessages(initial) {
  if (!openRoom) return;
  try {
    const url = `/api/rooms/${openRoom}/messages` + (lastMsgId ? `?after=${lastMsgId}` : '');
    const r = await api(url);
    if (!r.ok) return;
    const { messages } = await r.json();
    if (!messages.length && !initial) return;

    const log = document.getElementById('chatLog');
    if (!log) return;

    if (initial && !messages.length) {
      log.innerHTML = `<div class="chat-empty">${t('m.chat_empty')}</div>`;
      return;
    }
    if (!messages.length) return;

    // 有訊息就一定要把空狀態拿掉，否則它的 margin:auto 會把訊息撐開
    if (initial) log.innerHTML = '';
    else log.querySelector('.chat-empty')?.remove();

    const fmtTime = ts => new Date(ts * 1000)
      .toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

    log.insertAdjacentHTML('beforeend', messages.map((m, i) => {
      const prev = i > 0 ? messages[i - 1] : lastRendered;
      // 同一人連續發言且在 5 分鐘內就收合，時間只在群組最後一則顯示
      const grouped = prev && prev.mine === m.mine && (m.created_at - prev.created_at) < 300;
      const next = messages[i + 1];
      const showTime = !next || next.mine !== m.mine || (next.created_at - m.created_at) >= 300;
      return `<div class="bubble ${m.mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}">
        <div class="bubble-body">${esc(m.body)}</div>
        ${showTime ? `<div class="bubble-time">${fmtTime(m.created_at)}</div>` : ''}
      </div>`;
    }).join(''));

    lastRendered = messages[messages.length - 1];
    lastMsgId = lastRendered.id;
    log.scrollTop = log.scrollHeight;
    api(`/api/rooms/${openRoom}/read`, { method: 'POST', body: JSON.stringify({ up_to: lastMsgId }) });
  } catch { /* 輪詢失敗就等下一次，不打斷使用者 */ }
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !openRoom) return;
  input.value = '';
  try {
    const r = await api(`/api/rooms/${openRoom}/messages`, {
      method: 'POST', body: JSON.stringify({ body: text }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('m.send_failed'));
    await pullMessages(false);
  } catch (err) {
    input.value = text;
    alert(err.message);
  }
}

/* ---------------- 未讀徽章 ---------------- */
function updateBadge(rooms) {
  const total = rooms.reduce((n, r) => n + (r.unread || 0), 0);
  roomsBadge.textContent = total;
  roomsBadge.hidden = total === 0;
}
async function refreshRoomsBadge() {
  try {
    const r = await api('/api/rooms');
    if (!r.ok) return;
    const { rooms } = await r.json();
    updateBadge(rooms);
  } catch { /* 忽略 */ }
}

/* ---------------- 群組 ---------------- */
function renderGroup() {
  body.innerHTML = `
    <div class="card group-card">
      <div class="group-badge">${t('m.g_badge')}</div>
      <h2>${t('m.g_title')}</h2>
      <p>${t('m.g_body')}</p>
      <div class="group-steps">
        <div class="gs"><span>1</span>${t('m.g_s1')}</div>
        <div class="gs"><span>2</span>${t('m.g_s2')}</div>
        <div class="gs"><span>3</span>${t('m.g_s3')}</div>
      </div>
      <p class="group-note">${t('m.g_note')}</p>
    </div>`;
}

/* ---------------- 分頁 ---------------- */
function switchTab(tab) {
  currentTab = tab;
  stopPolling();
  openRoom = null;
  document.body.classList.remove('chat-open');
  tabsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (tab === 'rooms') loadRooms();
  else if (tab === 'group') renderGroup();
  else loadCandidates(tab);
}

tabsEl.addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) switchTab(t.dataset.tab);
});

body.addEventListener('click', e => {
  const actBtn = e.target.closest('[data-action]');
  if (actBtn) { act(actBtn); return; }
  const room = e.target.closest('.room-item');
  if (room) enterRoom(Number(room.dataset.room));
});

// 從測驗結果頁帶 ?tab= 進來時直接切到該分頁
const wanted = new URLSearchParams(location.search).get('tab');
switchTab(['online', 'all', 'group', 'rooms'].includes(wanted) ? wanted : 'online');

// 背景更新未讀數
refreshRoomsBadge();
roomsTimer = setInterval(refreshRoomsBadge, 20000);
window.addEventListener('pourmatch:authchange', () => switchTab(currentTab));
window.addEventListener('pourmatch:langchange', () => switchTab(currentTab));
