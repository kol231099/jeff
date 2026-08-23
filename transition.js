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
        <svg class="pour-glass" viewBox="-72 -112 252 286" aria-hidden="true">
          <defs>
            <linearGradient id="pgLiquid" gradientUnits="userSpaceOnUse" x1="60" y1="18" x2="60" y2="74">
              <stop offset="0%" stop-color="#FFC46B"/>
              <stop offset="55%" stop-color="#FF4D8D"/>
              <stop offset="100%" stop-color="#7B5CFF"/>
            </linearGradient>
            <!-- 酒柱沿著飛行方向由亮轉深，看起來才有厚度 -->
            <linearGradient id="pgStream" gradientUnits="userSpaceOnUse" x1="34" y1="-16" x2="60" y2="74">
              <stop offset="0%" stop-color="#FFE3B0"/>
              <stop offset="25%" stop-color="#FFB871"/>
              <stop offset="62%" stop-color="#FF6B8E"/>
              <stop offset="100%" stop-color="#FF4D8D"/>
            </linearGradient>
            <linearGradient id="pgBottle" gradientUnits="userSpaceOnUse" x1="-14" y1="0" x2="14" y2="0">
              <stop offset="0%" stop-color="#2A1420"/>
              <stop offset="30%" stop-color="#120A16"/>
              <stop offset="100%" stop-color="#3A1C2C"/>
            </linearGradient>
          </defs>

          <!-- 瓶子。倒的過程會越傾越多，收尾時扶正，酒柱自然就斷了 -->
          <g class="pg-bottle">
            <path class="pg-bottle-body" fill="url(#pgBottle)" stroke="rgba(255,246,230,.78)" stroke-width="1.7" stroke-linejoin="round"
              d="M -3.4,1 L -3.4,4.4 L -5,5.6 L -5,31 C -5,45 -13.4,47 -13.4,61 L -13.4,122
                 L 13.4,122 L 13.4,61 C 13.4,47 5,45 5,31 L 5,5.6 L 3.4,4.4 L 3.4,1 Z"/>
            <rect class="pg-bottle-lip" x="-5.6" y="2.6" width="11.2" height="3.6" rx="1.4"
              fill="rgba(255,246,230,.28)" stroke="rgba(255,246,230,.6)" stroke-width="1.1"/>
            <path class="pg-bottle-shine" d="M -8.6,64 L -8.6,118" stroke="rgba(255,246,230,.26)" stroke-width="3.4" stroke-linecap="round"/>
            <path class="pg-bottle-rim" d="M 4.4,8 C 4.4,30 12.6,44 12.6,62 L 12.6,118"
              fill="none" stroke="rgba(255,214,160,.55)" stroke-width="1.6" stroke-linecap="round"/>
          </g>

          <path class="pg-stream" d="" fill="url(#pgStream)"/>
          <path class="pg-stream-hi" d="" fill="none" stroke="rgba(255,248,235,.75)" stroke-width="0.7" stroke-linecap="round"/>

          <path class="pg-liquid" d="" fill="url(#pgLiquid)"/>
          <ellipse class="pg-surface" cx="60" cy="74" rx="0" ry="0" fill="#FFE8C8" opacity="0.32"/>
          <ellipse class="pg-churn" cx="60" cy="74" rx="0" ry="0" fill="#FFF3DC" opacity="0"/>
          <path class="pg-meniscus" d="" fill="none" stroke="#FFF0D8" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>

          <g class="pg-splash">
            <circle class="pg-drop d1" r="2.3" fill="#FFF6E6"/>
            <circle class="pg-drop d2" r="1.4" fill="#FFEFD2"/>
            <circle class="pg-drop d3" r="2.1" fill="#FFFBF2"/>
            <circle class="pg-drop d4" r="1.2" fill="#FFE3B4"/>
            <circle class="pg-drop d5" r="1.9" fill="#FFF6E6"/>
          </g>

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
  const surfaceY = level => TIP_Y - level * (TIP_Y - RIM_Y - 2);

  const MOUTH = { x: 34, y: -16 };       // 瓶口，酒柱的起點

  // level 0~1：0 是空杯，1 是滿到杯口下緣
  function liquidPath(level) {
    const ys = surfaceY(level);
    const hw = halfWidthAt(ys);
    const ry = Math.max(1, hw * 0.2);     // 液面橢圓的短半徑
    return {
      // 從斜上方看，液體最高的地方是液面後緣，所以頂邊向上凸
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
    const cy = p.ys + (wobble || 0);
    surf.setAttribute('cx', 60);
    surf.setAttribute('cy', cy);
    surf.setAttribute('rx', p.hw);
    surf.setAttribute('ry', p.ry);
    surf.setAttribute('opacity', level > 0.02 ? 0.3 : 0);
    // 液面後緣那道亮線，是「這是一個液面」而不是一塊色塊的關鍵
    const men = el.querySelector('.pg-meniscus');
    if (men) {
      men.setAttribute('d', `M ${60 - p.hw},${cy} A ${p.hw},${p.ry} 0 0 1 ${60 + p.hw},${cy}`);
      men.setAttribute('opacity', level > 0.02 ? 0.5 : 0);
    }
    return p;
  }

  // 酒柱是一條拋物線。瓶口射出後被重力拉彎，落地時幾乎垂直。
  function streamGeometry(targetY) {
    const vx = 60 - MOUTH.x;
    const dy = targetY - MOUTH.y;
    const vy0 = 0.3 * dy;                 // 出瓶口時的下墜速度
    const g = 1.4 * dy;                   // 其餘全靠重力補上
    return {
      at: s => ({ x: MOUTH.x + vx * s, y: MOUTH.y + vy0 * s + 0.5 * g * s * s }),
      tangent: s => [vx, vy0 + g * s],
      speed: s => Math.hypot(vx, vy0 + g * s),
    };
  }

  const W0 = 5.4;                         // 瓶口處的酒柱半寬

  // s0~s1 是目前畫出來的區間：落下時尾端固定、頭往前跑，收尾時反過來
  function setStream(el, on, targetY, s0, s1, t) {
    const path = el.querySelector('.pg-stream');
    const hi = el.querySelector('.pg-stream-hi');
    if (!path) return null;
    if (!on || s1 - s0 < 0.02) {
      path.setAttribute('d', '');
      if (hi) hi.setAttribute('d', '');
      return null;
    }

    const G = streamGeometry(targetY);
    const spd0 = G.speed(0);
    const N = 34;
    const left = [], right = [], mid = [];
    let head = null;

    for (let i = 0; i <= N; i++) {
      const s = s0 + (s1 - s0) * (i / N);
      const p = G.at(s);
      const [tx, ty] = G.tangent(s);
      const m = Math.hypot(tx, ty);
      const nx = -ty / m, ny = tx / m;

      // 流量守恆：越掉越快，酒柱就越細。這條是「有份量」的來源。
      let w = W0 * Math.pow(spd0 / G.speed(s), 0.62);
      w *= 1 + 0.12 * Math.sin(s * 13 - t / 52);   // 沿柱身流動的紋路
      if (i === N && s1 < 0.999) w *= 0.4;         // 還在下墜時柱頭收尖
      if (i === 0 && s0 > 0.001) w *= 0.4;         // 斷開時柱尾收尖

      const off = 0.7 * Math.sin(s * 8 - t / 96);  // 整條輕輕擺
      const cx = p.x + nx * off, cy = p.y + ny * off;
      left.push(`${(cx + nx * w).toFixed(2)},${(cy + ny * w).toFixed(2)}`);
      right.push(`${(cx - nx * w).toFixed(2)},${(cy - ny * w).toFixed(2)}`);
      mid.push(`${(cx + nx * w * 0.45).toFixed(2)},${(cy + ny * w * 0.45).toFixed(2)}`);
      if (i === N) head = { x: cx, y: cy };
    }

    path.setAttribute('d', `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`);
    if (hi) hi.setAttribute('d', `M ${mid.join(' L ')}`);
    return head;
  }

  function setBottle(el, angle) {
    const g = el.querySelector('.pg-bottle');
    if (g) g.setAttribute('transform', `translate(${MOUTH.x} ${MOUTH.y}) rotate(${angle.toFixed(2)}) scale(1.25)`);
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const easeOut = x => 1 - Math.pow(1 - x, 3);
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
    const churn = el.querySelector('.pg-churn');

    el.classList.add('active');
    if (reduce) {
      setLevel(el, 1, 0);
      setBottle(el, 112);
      liquid.style.height = '130vh';
      await wait(120);
      return;
    }

    const TILT = 260;   // 瓶子傾下來
    const FALL = 380;   // 酒柱從瓶口飛到杯裡
    const FILL = 1300;  // 注滿
    const CUT  = 300;   // 扶正瓶子、酒柱斷開
    const REST = 260;   // 液面回穩
    const END = TILT + FALL + FILL + CUT + REST;

    setLevel(el, 0, 0);
    el.querySelector('.pg-bottle').style.display = '';
    setBottle(el, 112);

    // rAF 在背景分頁會完全停住。真的有人倒到一半切走，這個 Promise 就永遠不會
    // resolve，畫面卡在覆蓋層、也不會跳頁。所以另外掛一個以計時器為準的保險。
    await new Promise(done => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; clearTimeout(guard); done(); };
      const guard = setTimeout(() => { setLevel(el, 1, 0); setStream(el, false); finish(); }, END + 600);
      const t0 = performance.now();
      (function frame(now) {
        if (settled) return;
        const t = now - t0;

        // 瓶身角度：先傾下來，倒的過程越倒越斜，最後扶正
        let angle;
        if (t < TILT) angle = 112 + 18 * easeOut(t / TILT);
        else if (t < TILT + FALL + FILL) angle = 130 + 11 * ((t - TILT) / (FALL + FILL));
        else angle = 141 - 32 * clamp((t - TILT - FALL - FILL) / CUT, 0, 1);
        setBottle(el, angle);

        // 錐形杯是定流量灌入，體積隨寬度平方成長，所以液面高度大致是 t 的立方根：
        // 一開始竄得快，接近杯口反而慢下來。用線性上升會立刻露餡。
        const fp = clamp((t - TILT - FALL) / FILL, 0, 1);
        const level = Math.cbrt(fp);
        const landed = t > TILT + FALL;

        // 停止注入後液面還會晃兩下才靜下來
        const settle = t < TILT + FALL + FILL ? 0.7
          : Math.max(0, 0.7 * (1 - (t - TILT - FALL - FILL) / (CUT + REST)));
        const wobble = Math.sin(t / 46) * settle;

        const p = setLevel(el, level, wobble);

        // 酒柱：下墜時頭往前跑，扶正瓶子時尾巴跟著離開瓶口
        let s0 = 0, s1 = 1, on = t > TILT * 0.72 && t < TILT + FALL + FILL + CUT;
        if (t < TILT + FALL) s1 = clamp((t - TILT * 0.72) / (FALL + TILT * 0.28), 0, 1);
        else if (t > TILT + FALL + FILL) s0 = clamp((t - TILT - FALL - FILL) / CUT, 0, 1);
        setStream(el, on, landed ? p.ys : TIP_Y, s0, s1, t);

        // 撞擊點：水花與翻攪
        const pouring = landed && t < TILT + FALL + FILL + CUT * 0.6;
        if (splash) {
          splash.setAttribute('transform', `translate(0 ${p.ys})`);
          splash.style.opacity = pouring ? '1' : '0';
        }
        if (churn) {
          const r = pouring ? p.hw * (0.3 + 0.06 * Math.sin(t / 60)) : 0;
          churn.setAttribute('cx', 60);
          churn.setAttribute('cy', p.ys + wobble);
          churn.setAttribute('rx', r);
          churn.setAttribute('ry', r * 0.28);
          churn.setAttribute('opacity', pouring ? 0.35 : 0);
        }

        if (t < END) requestAnimationFrame(frame);
        else finish();
      })(performance.now());
    });

    // 杯子滿了才漫出整片畫面
    liquid.animate([{ height: '0' }, { height: '130vh' }],
      { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    // 瓶子在這裡退場。下一頁的覆蓋層沒有瓶子，留到最後一格才消失會變成跳接。
    el.querySelector('.pg-bottle').animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 420, easing: 'ease-in', fill: 'forwards' });
    await wait(940);
  }

  // 酒液退去，露出新頁面
  async function pourIn() {
    const el = build();
    const liquid = el.querySelector('.pour-liquid');
    liquid.style.height = '130vh';
    setLevel(el, 1, 0);          // 抵達時杯子是滿的，酒已經倒完，瓶子不出現
    setStream(el, false);
    el.querySelector('.pg-bottle').style.display = 'none';

    // 上一頁最後一格是「滿版漸層 + 滿杯」。這裡若照 CSS 從 opacity:0 淡入，
    // 就會變成酒杯憑空浮出來一下又縮回去 —— 直接接在原本的狀態上。
    const scene = el.querySelector('.pour-scene');
    const wordEl = el.querySelector('.pour-word');
    scene.style.transition = 'none';
    scene.style.opacity = '1';
    scene.style.transform = 'none';
    wordEl.style.transition = 'none';
    wordEl.style.opacity = '0';
    void scene.offsetWidth;                 // 強制回流，讓上面幾行成為起始狀態

    el.classList.add('active');
    setWord(el, label('tr.settling'));
    wordEl.style.transition = 'opacity .34s ease';
    wordEl.style.opacity = '1';             // 只有字換，杯子不動
    // 覆蓋層已就位且顏色相同，這時才拿掉行內的臨時遮罩
    document.documentElement.classList.remove('pour-arriving');

    if (reduce) { el.classList.remove('active'); liquid.style.height = '0'; return; }

    await wait(620);
    scene.style.transition = 'opacity .5s ease';
    scene.style.opacity = '0';
    liquid.animate([{ height: '130vh' }, { height: '0' }],
      { duration: 1000, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    await wait(760);
    el.querySelector('.pour-veil').style.opacity = '0';
    await wait(340);
    el.classList.remove('active');
    liquid.style.height = '0';
    // 行內樣式會蓋過 .pour-overlay.active 的規則，留著的話同一頁再觸發一次
    // 過場時整個場景是隱形的。交還給 CSS。
    scene.style.cssText = '';
    wordEl.style.cssText = '';
    el.querySelector('.pour-veil').style.opacity = '';
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
