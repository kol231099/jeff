// ===== 單頁捲動引擎 =====
// 三種手法，都是 landonorris.com 在用的那組：
//   1. 橫向釘住：外層拉高、內層 sticky，捲動進度換算成橫向位移
//   2. 跑馬燈：內容複製一份，位移 -50% 後無縫接回
//   3. 進場揭露：IntersectionObserver，只觸發一次
// 全部只動 transform / opacity，交給合成器，不觸發版面重算。
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 橫向釘住 ---------- */
  function initPin() {
    const pins = [...document.querySelectorAll('[data-pin]')];
    if (!pins.length) return;

    const setup = pin => {
      const track = pin.querySelector('[data-pin-track]');
      if (!track) return null;
      // 手機不做橫向釘住：改回正常直式捲動，避免困住使用者
      if (innerWidth < 900 || reduce) {
        pin.style.height = '';
        track.style.transform = '';
        pin.classList.add('pin-off');
        return null;
      }
      pin.classList.remove('pin-off');
      // 需要橫向捲過的距離
      const dist = Math.max(0, track.scrollWidth - innerWidth + 96);
      // 1:1 對應時只釘住 0.78 個視窗高，一閃就過去了。
      // 把垂直行程拉長成 1.7 倍，橫移走得慢，這一段才成為一個「時刻」。
      const travel = dist * 3.2;   // 這段是主秀。太快會來不及看清楚每一杯
      pin.style.height = `${innerHeight + travel}px`;
      return { pin, track, dist, travel };
    };

    let items = pins.map(setup).filter(Boolean);

    const update = () => {
      for (const { pin, track, dist, travel } of items) {
        const r = pin.getBoundingClientRect();
        // 0 → 1：區塊頂端貼齊視窗頂端起算
        const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
        track.style.transform = `translate3d(${-p * dist}px,0,0)`;
        pin.style.setProperty('--pin-progress', p.toFixed(4));
        // 炫技的核心：每個項目依「離畫面中心多遠」做 3D 旋轉、縮放與明暗。
        // 靠近中心的被推到眼前並打亮，兩側的向後傾斜退開。
        const cx = innerWidth / 2;
        for (const el of track.children) {
          if (!el.classList || !el.classList.contains('lane-item')) continue;
          const b = el.getBoundingClientRect();
          if (b.right < -400 || b.left > innerWidth + 400) { el.style.opacity = ''; continue; }
          const d = ((b.left + b.width / 2) - cx) / cx;      // -1 左緣 → 0 中心 → 1 右緣
          const k = Math.max(-1.4, Math.min(1.4, d));
          el.style.transform =
            `perspective(1400px) rotateY(${-k * 26}deg) scale(${1 - Math.abs(k) * 0.16}) translateZ(${-Math.abs(k) * 130}px)`;
          el.style.opacity = (1 - Math.abs(k) * 0.5).toFixed(3);
          el.style.setProperty('--focus', (1 - Math.min(1, Math.abs(k) * 1.6)).toFixed(3));
        }

        // 背景巨型字反向慢速位移，做出景深
        const ghost = pin.querySelector('.lane-ghost');
        if (ghost) ghost.style.transform = `translate3d(${-p * dist * 0.32}px,0,0)`;

        // 計量的編號跟著進度走
        const num = pin.querySelector('.lane-meter-num');
        if (num) {
          const total = +(pin.querySelector('.lane-meter-total')?.textContent || 0);
          const n = Math.min(total, Math.max(1, Math.round(p * (total - 1)) + 1));
          const txt = String(n).padStart(2, '0');
          if (num.textContent !== txt) num.textContent = txt;
        }
      }
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { items = pins.map(setup).filter(Boolean); update(); });
    update();
  }

  /* ---------- 2. 進場揭露 ---------- */
  function initReveal() {
    const els = [...document.querySelectorAll('[data-reveal]')];
    if (!els.length) return;
    if (reduce) { els.forEach(e => e.classList.add('is-in')); return; }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // 同一組內依序進場，整組同時出現會失去節奏
        const i = +(e.target.dataset.revealDelay || 0);
        setTimeout(() => e.target.classList.add('is-in'), i * 90);
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    els.forEach(e => io.observe(e));
  }

  /* ---------- 3. 捲動進度指示 ---------- */
  function initProgress() {
    const bar = document.querySelector('[data-progress]');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    update();
  }

  /* ---------- 4. 導覽列隨捲動收起 ---------- */
  function initNav() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    let last = scrollY, ticking = false;
    const update = () => {
      const y = scrollY;
      nav.classList.toggle('nav-solid', y > 8);
      // 往下且已離開頂端 → 收起；往上 → 立刻回來
      if (y > last + 4 && y > 140) nav.classList.add('nav-hidden');
      else if (y < last - 4) nav.classList.remove('nav-hidden');
      last = y;
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    update();
  }

  const start = () => { initPin(); initReveal(); initProgress(); initNav(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
