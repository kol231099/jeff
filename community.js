// ===== 社群 Feed =====
const feedBody = document.getElementById('feedBody');
let currentScope = 'all';

document.querySelectorAll('.tab-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentScope = b.dataset.scope;
    loadFeed();
  });
});

async function loadFeed() {
  feedBody.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--text-dim);">載入中…</div>`;
  try {
    const r = await fetch(`/api/feed?scope=${currentScope}`, { credentials: 'include' });
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) {
      feedBody.innerHTML = `
        <div class="card" style="text-align:center;padding:60px 20px;">
          <h2 style="margin-bottom:8px;">${currentScope === 'friends' ? '朋友還沒有發布貼文' : '還沒有人發布貼文'}</h2>
          <p style="color:var(--text-dim);">完成品味測驗或調酒生成後，可以一鍵發布到社群</p>
        </div>`;
      return;
    }
    feedBody.innerHTML = list.map(renderPost).join('');
    bindActions();
  } catch (e) {
    feedBody.innerHTML = `<div class="card">載入失敗：${e.message}</div>`;
  }
}

function renderPost(p) {
  const c = p.content?.result || {};
  const inner = p.type === 'quiz' ? renderQuizContent(c) : renderCocktailContent(c);
  const time = new Date(p.created_at * 1000).toLocaleString('zh-TW', { hour12: false });
  return `
    <div class="card post" data-id="${p.id}">
      <div class="post-head">
        <img class="post-avatar" src="${p.user.picture || ''}" referrerpolicy="no-referrer" alt="" />
        <div class="post-meta">
          <div class="post-name">${p.user.name || '匿名酒友'}</div>
          <div class="post-time">${p.type === 'quiz' ? '🍷 品味測驗結果' : '🍹 創意調酒'} · ${time}</div>
        </div>
        ${p.is_owner ? `
          <button class="post-delete" data-id="${p.id}" title="刪除這則貼文">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>` : ''}
      </div>
      ${p.caption ? `<div class="post-caption">${escapeHtml(p.caption)}</div>` : ''}
      <div class="post-content">${inner}</div>
      <div class="post-actions">
        <button class="action-btn like-btn ${p.liked ? 'liked' : ''}" data-id="${p.id}">
          <span class="like-icon">${p.liked ? '❤️' : '🤍'}</span>
          <span class="like-count">${p.likes_count || 0}</span>
        </button>
        <button class="action-btn comment-btn" data-id="${p.id}">
          💬 <span class="comment-count">${p.comments_count || 0}</span> 留言
        </button>
        <button class="action-btn share-btn" data-id="${p.id}">🔗 分享連結</button>
      </div>
      <div class="comments-wrap" data-post-id="${p.id}" style="display:none;"></div>
    </div>
  `;
}

function renderQuizContent(r) {
  const recs = (r.recommendations || []).slice(0, 3);
  return `
    <div class="quiz-mini">
      <div class="mini-profile">${r.profile || ''}</div>
      <div class="mini-recs">
        ${recs.map(x => `
          <div class="mini-rec">
            <div class="mini-rec-name">${x.name}</div>
            <div class="mini-rec-score">${x.match_score || '--'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCocktailContent(r) {
  return `
    <div class="cocktail-mini">
      <div class="mini-name">${r.cocktail_name || ''}</div>
      <div class="mini-tagline">${r.tagline || ''}</div>
      <div class="mini-story">${r.story || ''}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function bindActions() {
  document.querySelectorAll('.like-btn').forEach(b => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const r = await fetch(`/api/posts/${id}/like`, { method: 'POST', credentials: 'include' });
      if (r.status === 401) { alert('請先登入才能按讚'); return; }
      const data = await r.json();
      const icon = b.querySelector('.like-icon');
      const count = b.querySelector('.like-count');
      const cur = Number(count.textContent) || 0;
      if (data.liked) { b.classList.add('liked'); icon.textContent = '❤️'; count.textContent = cur + 1; }
      else { b.classList.remove('liked'); icon.textContent = '🤍'; count.textContent = Math.max(0, cur - 1); }
    };
  });
  document.querySelectorAll('.share-btn').forEach(b => {
    b.onclick = () => {
      const url = `${location.origin}/share.html?id=${b.dataset.id}`;
      navigator.clipboard.writeText(url);
      const old = b.textContent;
      b.textContent = '✅ 連結已複製';
      setTimeout(() => b.textContent = old, 1500);
    };
  });
  document.querySelectorAll('.post-delete').forEach(b => {
    b.onclick = async () => {
      if (!confirm('確定要刪除這則貼文？此動作無法復原。')) return;
      const id = b.dataset.id;
      const r = await fetch(`/api/posts/${id}`, { method: 'DELETE', credentials: 'include' });
      if (r.status === 401) { alert('請先登入'); return; }
      if (!r.ok) { const d = await r.json(); alert(d.error || '刪除失敗'); return; }
      const card = b.closest('.post');
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(.96)';
      setTimeout(() => card.remove(), 280);
    };
  });
  document.querySelectorAll('.comment-btn').forEach(b => {
    b.onclick = () => toggleComments(b.dataset.id, b);
  });
}

async function toggleComments(postId, btn) {
  const wrap = document.querySelector(`.comments-wrap[data-post-id="${postId}"]`);
  if (!wrap) return;
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  if (wrap.dataset.loaded) return;
  wrap.innerHTML = `<div class="comments-loading">載入留言中…</div>`;
  try {
    const r = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' });
    const list = await r.json();
    renderComments(wrap, postId, list, btn);
    wrap.dataset.loaded = '1';
  } catch (e) {
    wrap.innerHTML = `<div class="comments-loading">留言載入失敗</div>`;
  }
}

function renderComments(wrap, postId, list, countBtn) {
  const composer = window.currentUser ? `
    <div class="comment-composer">
      <img class="comment-avatar" src="${window.currentUser.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <textarea class="comment-input" maxlength="500" placeholder="寫下你的想法…（最多 500 字）"></textarea>
      <button class="comment-send">送出</button>
    </div>
  ` : `
    <div class="comment-login-cta">
      🔒 <button class="link-style" onclick="window.triggerLogin?.()">登入</button> 即可留言
    </div>
  `;

  wrap.innerHTML = `
    <div class="comments-list">
      ${list.length === 0
        ? `<div class="comments-empty">還沒有人留言 · 來當第一個吧</div>`
        : list.map(commentHtml).join('')}
    </div>
    ${composer}
  `;

  bindCommentEvents(wrap, postId, countBtn);
}

function commentHtml(c) {
  const time = relTime(c.created_at);
  return `
    <div class="comment-item" data-id="${c.id}">
      <img class="comment-avatar" src="${c.user.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-name">${escapeHtml(c.user.name || '酒友')}</span>
          <span class="comment-time">${time}</span>
          ${c.is_owner ? `<button class="comment-delete" data-id="${c.id}" title="刪除留言">×</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.body)}</div>
      </div>
    </div>
  `;
}

function bindCommentEvents(wrap, postId, countBtn) {
  const sendBtn = wrap.querySelector('.comment-send');
  const input = wrap.querySelector('.comment-input');
  if (sendBtn && input) {
    sendBtn.onclick = async () => {
      const body = input.value.trim();
      if (!body) return;
      sendBtn.disabled = true; sendBtn.textContent = '送出中…';
      try {
        const r = await fetch(`/api/posts/${postId}/comments`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
        if (r.status === 401) { alert('請先登入'); return; }
        const data = await r.json();
        if (!r.ok) { alert(data.error || '送出失敗'); return; }
        const list = wrap.querySelector('.comments-list');
        const empty = list.querySelector('.comments-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', commentHtml(data));
        input.value = '';
        bumpCount(countBtn, +1);
        bindCommentEvents(wrap, postId, countBtn);
      } catch (e) {
        alert(e.message);
      } finally {
        sendBtn.disabled = false; sendBtn.textContent = '送出';
      }
    };
    input.onkeydown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendBtn.click();
    };
  }
  wrap.querySelectorAll('.comment-delete').forEach(b => {
    b.onclick = async () => {
      if (!confirm('刪除這則留言？')) return;
      const id = b.dataset.id;
      const r = await fetch(`/api/comments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); alert(d.error || '刪除失敗'); return; }
      const item = b.closest('.comment-item');
      item.style.opacity = '0';
      setTimeout(() => {
        item.remove();
        bumpCount(countBtn, -1);
        const list = wrap.querySelector('.comments-list');
        if (list && !list.querySelector('.comment-item')) {
          list.innerHTML = `<div class="comments-empty">還沒有人留言 · 來當第一個吧</div>`;
        }
      }, 200);
    };
  });
}

function bumpCount(btn, delta) {
  if (!btn) return;
  const span = btn.querySelector('.comment-count');
  if (!span) return;
  const next = Math.max(0, (Number(span.textContent) || 0) + delta);
  span.textContent = next;
}

function relTime(unix) {
  const diff = Date.now() / 1000 - unix;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(unix * 1000).toLocaleDateString('zh-TW');
}

window.addEventListener('pourmatch:authchange', () => {
  // 登入狀態變化時 reload feed，讓 is_owner / 留言區重畫
  loadFeed();
});

loadFeed();
