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
    el.innerHTML = `
      <div class="pour-veil"></div>
      <div class="pour-scene">
        <svg class="pour-glass" viewBox="0 0 120 150" aria-hidden="true">
          <defs>
            <!-- userSpaceOnUse：漸層固定在杯碗的座標上。
                 預設的 objectBoundingBox 會讓顏色跟著縮放一起壓扁，
                 那樣看起來是整塊色彩在變形，而不是酒液累積上來。 -->
            <linearGradient id="pgLiquid" gradientUnits="userSpaceOnUse" x1="60" y1="16" x2="60" y2="76">
              <stop offset="0%" stop-color="#FFC46B"/>
              <stop offset="55%" stop-color="#FF4D8D"/>
              <stop offset="100%" stop-color="#7B5CFF"/>
            </linearGradient>
          </defs>
          <clipPath id="pgClip">
            <path d="M22,16 L98,16 L64,74 L56,74 Z"/>
          </clipPath>
          <rect class="pg-fill" x="20" y="16" width="80" height="60" fill="url(#pgLiquid)" clip-path="url(#pgClip)"/>
          <path d="M22,16 L98,16 L64,74 L56,74 Z" fill="none" stroke="rgba(255,240,214,.85)" stroke-width="2.5" stroke-linejoin="round"/>
          <line x1="60" y1="74" x2="60" y2="126" stroke="rgba(255,240,214,.85)" stroke-width="2.5"/>
          <line x1="38" y1="130" x2="82" y2="130" stroke="rgba(255,240,214,.85)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <div class="pour-word"></div>
      </div>
      <div class="pour-liquid">
        <svg class="pour-wave" viewBox="0 0 1200 140" preserveAspectRatio="none"><path d="${WAVE}"/></svg>
        <svg class="pour-wave w2" viewBox="0 0 1200 140" preserveAspectRatio="none"><path d="${WAVE}"/></svg>
        <div class="pour-glint"></div>
      </div>`;
    document.body.appendChild(el);

    // 氣泡：大小、位置、速度都隨機，才不會看出是重複的
    const liquid = el.querySelector('.pour-liquid');
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('span');
      const size = 5 + Math.random() * 13;
      b.className = 'pour-bubble';
      b.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
        `animation-duration:${2.6 + Math.random() * 2.6}s;animation-delay:${Math.random() * 2.4}s;`;
      liquid.appendChild(b);
    }
    return el;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const label = k => (window.t ? window.t(k) : k);

  function setWord(el, text) {
    el.querySelector('.pour-word').innerHTML =
      [...text].map((c, i) =>
        `<span style="animation-delay:${i * 0.06}s">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  }

  // 酒液漲滿。resolve 時畫面已被完全遮住，呼叫端才可以安全換頁。
  async function pourOut(word) {
    const el = build();
    setWord(el, word || label('tr.pouring'));
    const liquid = el.querySelector('.pour-liquid');
    const fill = el.querySelector('.pg-fill');

    el.classList.add('active');
    if (reduce) { liquid.style.height = '130vh'; await wait(120); return; }

    // 杯中先注滿，再溢出成整片
    fill.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
      { duration: 620, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    await wait(240);

    liquid.animate([{ height: '0' }, { height: '130vh' }],
      { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    await wait(980);
  }

  // 酒液退去，露出新頁面
  async function pourIn() {
    const el = build();
    const liquid = el.querySelector('.pour-liquid');
    liquid.style.height = '130vh';
    el.classList.add('active');
    setWord(el, label('tr.settling'));
    // 覆蓋層已就位且顏色相同，這時才拿掉行內的臨時遮罩
    document.documentElement.classList.remove('pour-arriving');

    if (reduce) { el.classList.remove('active'); liquid.style.height = '0'; return; }

    await wait(260);
    el.querySelector('.pour-scene').style.opacity = '0';
    liquid.animate([{ height: '130vh' }, { height: '0' }],
      { duration: 1000, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    await wait(760);
    el.querySelector('.pour-veil').style.opacity = '0';
    await wait(340);
    el.classList.remove('active');
    liquid.style.height = '0';
  }

  // 換頁：先倒滿，再導向，讓下一頁接著播退場。
  // 倒酒的這一秒順便把目的地重新抓一次（cache: 'reload'），
  // 強制更新該網址的快取條目 —— 否則瀏覽器可能拿舊的 HTML，
  // 使用者就會看到過期的頁面而且無從察覺。
  async function pourTo(url, word) {
    sessionStorage.setItem(FLAG, '1');
    const warm = fetch(url, { cache: 'reload' }).catch(() => {});
    await pourOut(word);
    await Promise.race([warm, wait(1200)]);
    location.href = url;
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
    // 每個 session 第一次進首頁：先蓋住，再揭開
    if (isHome && !sessionStorage.getItem(INTRO)) {
      sessionStorage.setItem(INTRO, '1');
      pourIn();
    }
  });
})();
