// ===== 公開分享頁 =====
const body = document.getElementById('shareBody');
const id = new URLSearchParams(location.search).get('id');

async function load() {
  if (!id) {
    body.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
      <h2>沒有提供貼文 ID</h2></div>`;
    return;
  }
  try {
    const r = await fetch(`/api/share/${id}`);
    if (!r.ok) throw new Error('找不到貼文');
    const p = await r.json();
    render(p);
  } catch (e) {
    body.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
      <h2 style="margin-bottom:8px;">貼文不存在</h2>
      <p style="color:var(--text-dim);">${e.message}</p>
      <a href="community.html" class="btn-share" style="text-decoration:none;margin-top:16px;display:inline-block;">回到社群</a>
    </div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render(p) {
  const c = p.content?.result || {};
  const inner = p.type === 'quiz' ? renderQuiz(c) : renderCocktail(c);
  const time = new Date(p.created_at * 1000).toLocaleString('zh-TW', { hour12: false });
  body.innerHTML = `
    <div class="social-header">
      <h1 class="gradient-text">${p.type === 'quiz' ? '品味測驗結果' : '創意調酒'}</h1>
      <p>來自 PourMatch 的 AI 推薦 · ${time}</p>
    </div>
    <div class="card post">
      <div class="post-head">
        <img class="post-avatar" src="${p.user.picture || ''}" referrerpolicy="no-referrer" alt="" />
        <div class="post-meta">
          <div class="post-name">${p.user.name || '匿名酒友'}</div>
          <div class="post-time">識別代碼：${p.user.unique_code || '—'}</div>
        </div>
      </div>
      ${p.caption ? `<div class="post-caption">${escapeHtml(p.caption)}</div>` : ''}
      <div class="post-content">${inner}</div>
      <div class="post-actions">
        <span class="action-btn ${p.liked ? 'liked' : ''}">❤️ ${p.likes_count || 0}</span>
        <a class="btn-share" href="quiz.html" style="text-decoration:none;">🍷 我也來測測看</a>
        <a class="btn-share" href="cocktail.html" style="text-decoration:none;">🍹 我也來生成調酒</a>
      </div>
      <div class="comments-wrap" id="shareComments"></div>
    </div>
  `;
  loadShareComments(p.id);
}

async function loadShareComments(postId) {
  const wrap = document.getElementById('shareComments');
  if (!wrap) return;
  try {
    const r = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' });
    const list = await r.json();
    renderShareComments(wrap, postId, list);
  } catch (e) {
    wrap.innerHTML = `<div class="comments-loading">留言載入失敗</div>`;
  }
}

function renderShareComments(wrap, postId, list) {
  const composer = window.currentUser ? `
    <div class="comment-composer">
      <img class="comment-avatar" src="${window.currentUser.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <textarea class="comment-input" maxlength="500" placeholder="寫下你的想法…"></textarea>
      <button class="comment-send">送出</button>
    </div>
  ` : `
    <div class="comment-login-cta">
      🔒 <button class="link-style" onclick="window.triggerLogin?.()">登入</button> 即可留言
    </div>
  `;
  wrap.innerHTML = `
    <div class="comments-divider">💬 ${list.length} 則留言</div>
    <div class="comments-list">
      ${list.length === 0
        ? `<div class="comments-empty">還沒有人留言 · 來當第一個吧</div>`
        : list.map(commentHtml).join('')}
    </div>
    ${composer}
  `;
  bindShareComment(wrap, postId);
}

function commentHtml(c) {
  const diff = Date.now() / 1000 - c.created_at;
  let time;
  if (diff < 60) time = '剛剛';
  else if (diff < 3600) time = `${Math.floor(diff / 60)} 分鐘前`;
  else if (diff < 86400) time = `${Math.floor(diff / 3600)} 小時前`;
  else time = new Date(c.created_at * 1000).toLocaleDateString('zh-TW');
  return `
    <div class="comment-item" data-id="${c.id}">
      <img class="comment-avatar" src="${c.user.picture || ''}" referrerpolicy="no-referrer" alt="" />
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-name">${escapeHtml(c.user.name || '酒友')}</span>
          <span class="comment-time">${time}</span>
          ${c.is_owner ? `<button class="comment-delete" data-id="${c.id}">×</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.body)}</div>
      </div>
    </div>
  `;
}

function bindShareComment(wrap, postId) {
  const sendBtn = wrap.querySelector('.comment-send');
  const input = wrap.querySelector('.comment-input');
  if (sendBtn && input) {
    sendBtn.onclick = async () => {
      const text = input.value.trim();
      if (!text) return;
      sendBtn.disabled = true; sendBtn.textContent = '送出中…';
      try {
        const r = await fetch(`/api/posts/${postId}/comments`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: text }),
        });
        if (r.status === 401) { alert('請先登入'); return; }
        const data = await r.json();
        if (!r.ok) { alert(data.error || '送出失敗'); return; }
        const list = wrap.querySelector('.comments-list');
        const empty = list.querySelector('.comments-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', commentHtml(data));
        input.value = '';
        bindShareComment(wrap, postId);
        const divider = wrap.querySelector('.comments-divider');
        if (divider) {
          const n = list.querySelectorAll('.comment-item').length;
          divider.textContent = `💬 ${n} 則留言`;
        }
      } finally {
        sendBtn.disabled = false; sendBtn.textContent = '送出';
      }
    };
  }
  wrap.querySelectorAll('.comment-delete').forEach(b => {
    b.onclick = async () => {
      if (!confirm('刪除這則留言？')) return;
      const r = await fetch(`/api/comments/${b.dataset.id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); alert(d.error || '刪除失敗'); return; }
      const item = b.closest('.comment-item');
      item.remove();
      const list = wrap.querySelector('.comments-list');
      if (list && !list.querySelector('.comment-item')) {
        list.innerHTML = `<div class="comments-empty">還沒有人留言 · 來當第一個吧</div>`;
      }
      const divider = wrap.querySelector('.comments-divider');
      if (divider) {
        const n = list.querySelectorAll('.comment-item').length;
        divider.textContent = `💬 ${n} 則留言`;
      }
    };
  });
}

window.addEventListener('pourmatch:authchange', () => load());

function renderQuiz(r) {
  const recs = (r.recommendations || []).slice(0, 3);
  return `
    <div class="share-quiz">
      <div class="share-section">
        <div class="share-label">風味 DNA</div>
        <div class="share-profile">${r.profile || ''}</div>
      </div>
      <div class="share-section">
        <div class="share-label">3 款推薦</div>
        <div class="share-recs">
          ${recs.map(x => `
            <div class="share-rec">
              <div class="share-rec-head">
                <div class="share-rec-name">${x.name}</div>
                <div class="share-rec-score">${x.match_score || '--'}</div>
              </div>
              <div class="share-rec-cat">${x.category || ''}</div>
              <div class="share-rec-tags">${(x.flavor_tags || []).map(t => `<span class="rec-tag">${t}</span>`).join('')}</div>
              <div class="share-rec-reason">${x.reason || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderCocktail(r) {
  const fp = r.flavor_profile || {};
  const flavorMap = [
    { key: 'sweet', label: '甜' },
    { key: 'sour', label: '酸' },
    { key: 'bitter', label: '苦' },
    { key: 'strong', label: '烈' },
  ];
  return `
    <div class="share-cocktail">
      <div class="share-cock-name gradient-text">${r.cocktail_name || ''}</div>
      <div class="share-cock-tagline">${r.tagline || ''}</div>
      <div class="share-cock-meta">
        <span>🥂 ${r.glass || ''}</span>
        <span>🎨 ${r.color || ''}</span>
      </div>
      <div class="share-cock-story">${r.story || ''}</div>
      <div class="share-flavor-bars">
        ${flavorMap.map((f, i) => `
          <div class="flavor-bar">
            <span class="flavor-name">${f.label}</span>
            <div class="flavor-track"><div class="flavor-fill ${i >= 2 ? 'b' : ''}" style="width:${((fp[f.key] || 0) / 5) * 100}%"></div></div>
          </div>`).join('')}
      </div>
      <div class="share-section">
        <div class="share-label">材料</div>
        <ul class="share-ings">${(r.ingredients || []).map(i => `<li><span>${i.name}</span><span>${i.amount}</span></li>`).join('')}</ul>
      </div>
      <div class="share-section">
        <div class="share-label">調製步驟</div>
        <ol class="share-steps">${(r.steps || []).map(s => `<li>${s}</li>`).join('')}</ol>
      </div>
      <div class="share-section">
        <div class="share-label">裝飾</div>
        <div>${r.garnish || ''}</div>
      </div>
    </div>
  `;
}

load();
