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
  feedBody.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--text-dim);">${t('cm.loading')}</div>`;
  try {
    const r = await fetch(`/api/feed?scope=${currentScope}`, { credentials: 'include' });
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) {
      feedBody.innerHTML = `
        <div class="card" style="text-align:center;padding:60px 20px;">
          <h2 style="margin-bottom:8px;">${currentScope === 'friends' ? t('cm.empty_friends') : t('cm.empty')}</h2>
          <p style="color:var(--text-dim);">${t('cm.empty_sub')}</p>
        </div>`;
      return;
    }
    feedBody.innerHTML = list.map(renderPost).join('');
    bindActions();
  } catch (e) {
    feedBody.innerHTML = `<div class="card">${t('cm.load_failed')}：${e.message}</div>`;
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
          <div class="post-name">${p.user.name || t('cm.anon')}</div>
          <div class="post-time">${p.type === 'quiz' ? t('cm.quiz_post') : t('cm.cocktail_post')} · ${time}</div>
        </div>
        ${p.is_owner ? `
          <button class="post-delete" data-id="${p.id}" title="${t('cm.delete_post')}">
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
          💬 <span class="comment-count">${p.comments_count || 0}</span> ${t('cm.comments')}
        </button>
        <button class="action-btn share-btn" data-id="${p.id}">${t('cm.share_link')}</button>
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
      if (r.status === 401) { alert(t('cm.need_login_like')); return; }
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
      b.textContent = t('cm.link_copied');
      setTimeout(() => b.textContent = old, 1500);
    };
  });
  document.querySelectorAll('.post-delete').forEach(b => {
    b.onclick = async () => {
      if (!confirm(t('cm.confirm_delete_post'))) return;
      const id = b.dataset.id;
      const r = await fetch(`/api/posts/${id}`, { method: 'DELETE', credentials: 'include' });
      if (r.status === 401) { alert(t('common.login_first')); return; }
      if (!r.ok) { const d = await r.json(); alert(d.error || t('cm.delete_failed')); return; }
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
  wrap.innerHTML = `<div class="comments-loading">${t('cm.loading_comments')}</div>`;
  try {
    const r = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' });
    const list = await r.json();
    renderComments(wrap, postId, list, btn);
    wrap.dataset.loaded = '1';
  } catch (e) {
    wrap.innerHTML = `<div class="comments-loading">${t('cm.comments_failed')}</div>`;
  }
}

function renderComments(wrap, postId, list, countBtn) {
  const composer = window.currentUser ? `
    <div class="comment-composer">
      <img class="comment-avatar" src="${window.currentUser.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <textarea class="comment-input" maxlength="500" placeholder="${t('cm.comment_ph')}"></textarea>
      <button class="comment-send">${t('cm.send')}</button>
    </div>
  ` : `
    <div class="comment-login-cta">
      🔒 <button class="link-style" onclick="window.triggerLogin?.()">${t('cm.login')}</button> ${t('cm.login_to_comment')}
    </div>
  `;

  wrap.innerHTML = `
    <div class="comments-list">
      ${list.length === 0
        ? `<div class="comments-empty">${t('cm.no_comments')}</div>`
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
          <span class="comment-name">${escapeHtml(c.user.name || t('m.drinker'))}</span>
          <span class="comment-time">${time}</span>
          ${c.is_owner ? `<button class="comment-delete" data-id="${c.id}" title="${t('cm.delete_comment')}">×</button>` : ''}
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
      sendBtn.disabled = true; sendBtn.textContent = t('cm.sending');
      try {
        const r = await fetch(`/api/posts/${postId}/comments`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
        if (r.status === 401) { alert(t('common.login_first')); return; }
        const data = await r.json();
        if (!r.ok) { alert(data.error || t('cm.send_failed')); return; }
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
        sendBtn.disabled = false; sendBtn.textContent = t('cm.send');
      }
    };
    input.onkeydown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendBtn.click();
    };
  }
  wrap.querySelectorAll('.comment-delete').forEach(b => {
    b.onclick = async () => {
      if (!confirm(t('cm.confirm_delete_comment'))) return;
      const id = b.dataset.id;
      const r = await fetch(`/api/comments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); alert(d.error || t('cm.delete_failed')); return; }
      const item = b.closest('.comment-item');
      item.style.opacity = '0';
      setTimeout(() => {
        item.remove();
        bumpCount(countBtn, -1);
        const list = wrap.querySelector('.comments-list');
        if (list && !list.querySelector('.comment-item')) {
          list.innerHTML = `<div class="comments-empty">${t('cm.no_comments')}</div>`;
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
  if (diff < 60) return t('cm.just_now');
  if (diff < 3600) return t('cm.min_ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('cm.hr_ago', { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 7) return t('cm.day_ago', { n: Math.floor(diff / 86400) });
  return new Date(unix * 1000).toLocaleDateString('zh-TW');
}

window.addEventListener('pourmatch:authchange', () => {
  // 登入狀態變化時 reload feed，讓 is_owner / 留言區重畫
  loadFeed();
});

loadFeed();
