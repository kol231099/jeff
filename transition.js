// ===== 倒酒過場 =====
// pourOut()：酒液漲滿畫面，用來蓋住換頁的瞬間
// pourIn() ：抵達新頁面後讓酒液退去
// 兩段之間靠 sessionStorage 傳遞，換頁後才知道要不要接續播放。
(function () {
  const FLAG = 'pourmatch_transition';
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
        <svg class="pour-glass" viewBox="0 0 120 160" aria-hidden="true">
          <defs>
            <!-- 漸層釘在杯碗座標上，液面上升時顏色不會跟著被拉扯 -->
            <linearGradient id="pgLiquid" gradientUnits="userSpaceOnUse" x1="60" y1="18" x2="60" y2="74">
              <stop offset="0%" stop-color="#FFC46B"/>
              <stop offset="55%" stop-color="#FF4D8D"/>
              <stop offset="100%" stop-color="#7B5CFF"/>
            </linearGradient>
            <linearGradient id="pgStream" gradientUnits="userSpaceOnUse" x1="60" y1="-20" x2="60" y2="40">
              <stop offset="0%" stop-color="#FFD9A0" stop-opacity="0"/>
              <stop offset="35%" stop-color="#FFC46B"/>
              <stop offset="100%" stop-color="#FF8A5B"/>
            </linearGradient>
          </defs>

          <!-- 落下的酒柱 -->
          <path class="pg-stream" d="" fill="url(#pgStream)"/>

          <!-- 杯中的酒：路徑由 JS 每格重算 -->
          <path class="pg-liquid" d="" fill="url(#pgLiquid)"/>
          <ellipse class="pg-surface" cx="60" cy="74" rx="0" ry="0" fill="#FFE8C8" opacity="0.32"/>
          <path class="pg-meniscus" d="" fill="none" stroke="#FFF0D8" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>

          <!-- 撞擊點的水花 -->
          <g class="pg-splash">
            <circle class="pg-drop d1" r="1.8" fill="#FFD9A0"/>
            <circle class="pg-drop d2" r="1.4" fill="#FFC46B"/>
            <circle class="pg-drop d3" r="1.6" fill="#FFE0B0"/>
          </g>

          <!-- 杯體 -->
          <path d="M22,18 L98,18 L64,74 L56,74 Z" fill="none" stroke="rgba(255,246,230,.9)" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="60" cy="18" rx="38" ry="5" fill="none" stroke="rgba(255,246,230,.95)" stroke-width="2"/>
          <line x1="60" y1="74" x2="60" y2="132" stroke="rgba(255,246,230,.9)" stroke-width="2"/>
          <ellipse cx="60" cy="134" rx="22" ry="4.5" fill="none" stroke="rgba(255,246,230,.9)" stroke-width="2"/>
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

  // 杯碗幾何。錐形杯的液面是橢圓，而且越高越寬 —— 這是「像不像在裝液體」的關鍵。
  const RIM_Y = 18, TIP_Y = 74;          // 杯口與杯底的高度
  const RIM_HW = 36, TIP_HW = 3;         // 對應的半寬
  const halfWidthAt = y => TIP_HW + (TIP_Y - y) / (TIP_Y - RIM_Y) * (RIM_HW - TIP_HW);

  // level 0~1：0 是空杯，1 是滿到杯口下緣
  function liquidPath(level) {
    const ys = TIP_Y - level * (TIP_Y - RIM_Y - 2);
    const hw = halfWidthAt(ys);
    const ry = Math.max(1, hw * 0.2);     // 液面橢圓的短半徑
    return {
      d: `M ${60 - hw},${ys} L 57,${TIP_Y} L 63,${TIP_Y} L ${60 + hw},${ys} ` +
         `A ${hw},${ry} 0 0 0 ${60 - hw},${ys} Z`,
      ys, hw, ry,
    };
  }

  function setLevel(el, level, wobble) {
    const p = liquidPath(level);
    const liq = el.querySelector('.pg-liquid');
    const surf = el.querySelector('.pg-surface');
    if (!liq) return p;
    liq.setAttribute('d', p.d);
    // 液面隨注入輕微晃動，靜止的橢圓看起來像塑膠
    surf.setAttribute('cx', 60);
    surf.setAttribute('cy', p.ys + (wobble || 0));
    surf.setAttribute('rx', p.hw);
    surf.setAttribute('ry', p.ry);
    surf.setAttribute('opacity', level > 0.02 ? 0.3 : 0);
    // 液面後緣那道亮線，是「這是一個液面」而不是一塊色塊的關鍵
    const men = el.querySelector('.pg-meniscus');
    if (men) {
      const cy = p.ys + (wobble || 0);
      men.setAttribute('d', `M ${60 - p.hw},${cy} A ${p.hw},${p.ry} 0 0 1 ${60 + p.hw},${cy}`);
      men.setAttribute('opacity', level > 0.02 ? 0.5 : 0);
    }
    return p;
  }

  // 酒柱：從畫面上方落到目前的液面
  function setStream(el, on, ys, t) {
    const s = el.querySelector('.pg-stream');
    if (!s) return;
    if (!on) { s.setAttribute('d', ''); return; }
    const sway = Math.sin(t / 140) * 0.6;          // 細微擺動，完全筆直不自然
    const w = 1.5 + Math.sin(t / 90) * 0.22;       // 粗細也有變化
    const xTop = 60 + sway, xBot = 60 + sway * 0.4;
    s.setAttribute('d',
      `M ${xTop - w},-30 L ${xTop + w},-30 L ${xBot + w * 0.62},${ys} L ${xBot - w * 0.62},${ys} Z`);
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
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
    const splash = el.querySelector('.pg-splash');

    el.classList.add('active');
    if (reduce) {
      setLevel(el, 1, 0);
      liquid.style.height = '130vh';
      await wait(120);
      return;
    }

    const FALL = 170;   // 酒柱從畫面外落到杯底
    const FILL = 680;   // 注滿
    const REST = 140;   // 收柱、液面回穩

    await new Promise(done => {
      const t0 = performance.now();
      (function frame(now) {
        const t = now - t0;
        const pouring = t < FALL + FILL;

        // 錐形杯是定流量灌入，體積隨寬度平方成長，所以液面高度大致是 t 的立方根：
        // 一開始竄得快，接近杯口反而慢下來。用線性上升會立刻露餡。
        const fp = clamp((t - FALL) / FILL, 0, 1);
        const level = Math.cbrt(fp);

        // 停止注入後液面還會晃兩下才靜下來
        const settle = t < FALL + FILL ? 0.55
          : Math.max(0, 0.55 * (1 - (t - FALL - FILL) / REST));
        const wobble = Math.sin(t / 42) * settle;

        const p = setLevel(el, level, wobble);

        // 酒柱下墜：還沒到液面前，柱底就是墜落中的柱頭
        const head = t < FALL ? -30 + (p.ys + 30) * (t / FALL) : p.ys;
        setStream(el, pouring, head, t);

        // 水花跟著撞擊點走
        if (splash) {
          splash.setAttribute('transform', `translate(0 ${p.ys})`);
          splash.style.opacity = t > FALL * 0.85 && pouring ? '1' : '0';
        }

        if (t < FALL + FILL + REST) requestAnimationFrame(frame);
        else done();
      })(performance.now());
    });

    // 杯子滿了才漫出整片畫面
    liquid.animate([{ height: '0' }, { height: '130vh' }],
      { duration: 820, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    await wait(880);
  }

  // 酒液退去，露出新頁面
  async function pourIn() {
    const el = build();
    const liquid = el.querySelector('.pour-liquid');
    liquid.style.height = '130vh';
    setLevel(el, 1, 0);          // 抵達時杯子是滿的
    setStream(el, false);
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

  // 抵達時若帶著旗標就接續播放退場
  window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem(FLAG)) {
      sessionStorage.removeItem(FLAG);
      pourIn();
    }
  });
})();
