// ===== 倒酒過場 =====
// pourOut()：酒液漲滿畫面，用來蓋住換頁的瞬間
// pourIn() ：抵達新頁面後讓酒液退去
// 兩段之間靠 sessionStorage 傳遞，換頁後才知道要不要接續播放。
(function () {
  const FLAG = 'pourmatch_transition';
  const INTRO = 'pourmatch_intro';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WAVE = 'M0,40 C150,90 350,-10 600,40 C850,90 1050,-10 1200,40 L1200,140 L0,140 Z';

  function build() {
    let el = document.querySelector('.pour-overlay');
    if (el) return el;

    el = document.createElement('div');
    el.className = 'pour-overlay';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    const veil = document.createElement('div');
    veil.className = 'pour-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);

    const scene = document.createElement('div');
    scene.className = 'pour-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = `
      <svg class="pour-glass" viewBox="0 0 120 150" aria-hidden="true">
        <defs>
          <linearGradient id="pgLiquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFE0B0"/>
            <stop offset="52%" stop-color="#FF6E88"/>
            <stop offset="100%" stop-color="#8B5CE0"/>
          </linearGradient>
        </defs>
        <clipPath id="pgClip"><path d="M24,18 L96,18 L64,72 L56,72 Z"/></clipPath>
        <rect class="pg-fill" x="22" y="18" width="76" height="56" fill="url(#pgLiquid)" clip-path="url(#pgClip)"/>
        <path d="M24,18 L96,18 L64,72 L56,72 Z" fill="none" stroke="rgba(255,246,230,.9)" stroke-width="2" stroke-linejoin="round"/>
        <line x1="60" y1="72" x2="60" y2="124" stroke="rgba(255,246,230,.9)" stroke-width="2"/>
        <line x1="40" y1="128" x2="80" y2="128" stroke="rgba(255,246,230,.9)" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div class="pour-word"></div>`;
    document.body.appendChild(scene);

    return el;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const label = k => (window.t ? window.t(k) : k);
  const parts = () => ({
    overlay: document.querySelector('.pour-overlay'),
    veil: document.querySelector('.pour-veil'),
    scene: document.querySelector('.pour-scene'),
  });

  function setWord(text) {
    const w = document.querySelector('.pour-word');
    if (!w) return;
    w.innerHTML = [...text]
      .map((c, i) => `<span style="animation-delay:${i * 0.06}s">${c === ' ' ? '&nbsp;' : c}</span>`)
      .join('');
  }

  // 離開：整片顏色淡入蓋住畫面。沒有移動中的邊界，就不會有對不齊的縫。
  async function pourOut(word) {
    build();
    const { overlay, veil, scene } = parts();
    setWord(word || label('tr.pouring'));

    overlay.classList.remove('reveal');
    overlay.classList.add('active');
    veil.classList.add('on');
    await wait(120);
    scene.classList.add('on');
    if (reduce) return;

    const fill = document.querySelector('.pg-fill');
    if (fill) {
      fill.animate([{ transform: 'scaleY(0.15)' }, { transform: 'scaleY(1)' }],
        { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    }
    await wait(700);
  }

  // 抵達：顏色先退，薄紗慢一步，內容因此像從底色裡浮出來
  async function pourIn() {
    build();
    const { overlay, veil, scene } = parts();
    overlay.classList.add('active');
    veil.classList.add('on');
    setWord(label('tr.settling'));

    // 這一格先把畫面蓋住，再交給行內遮罩下班
    await wait(30);
    document.documentElement.classList.remove('pour-arriving');

    if (reduce) {
      overlay.classList.remove('active');
      veil.classList.remove('on');
      return;
    }

    scene.classList.add('on');
    await wait(340);
    scene.classList.remove('on');
    overlay.classList.add('reveal');
    overlay.classList.remove('active');
    await wait(420);
    veil.classList.remove('on');
    await wait(1500);
  }

  window.pourOut = pourOut;
  window.pourIn = pourIn;
  window.pourTo = pourTo;

  const isHome = /(^\/$|\/index\.html$)/.test(location.pathname);

  window.addEventListener('DOMContentLoaded', () => {
    // 從過場換頁抵達：接續播放退場
    if (sessionStorage.getItem(FLAG)) {
      sessionStorage.removeItem(FLAG);
      pourIn();
      return;
    }
    // 每個 session 第一次進首頁：先滿版蓋住，再揭開
    if (isHome && !sessionStorage.getItem(INTRO)) {
      sessionStorage.setItem(INTRO, '1');
      pourIn();
    }
  });
})();
