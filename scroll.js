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
      // 只按橫向距離換算的話，項目少的區塊會一閃而過（4 張卡只有 2 個視窗高）。
      // 改成同時保證「每個項目至少佔 0.95 個視窗高」，節奏才會一致。
      const count = [...track.children].filter(
        el => el.classList && (el.classList.contains('lane-item') ||
              el.classList.contains('shot') || el.classList.contains('scene-panel'))).length;
      const travel = Math.max(dist * 3.2, count * innerHeight * 0.95);
      // 尾段：最後一個項目走到定位後，再多留一段才放開釘住
      const tail = innerHeight * 0.75;
      pin.style.height = `${innerHeight + travel + tail}px`;
      return { pin, track, dist, travel, tail };
    };

    let items = pins.map(setup).filter(Boolean);

    const update = () => {
      for (const { pin, track, dist, travel } of items) {
        const r = pin.getBoundingClientRect();
        // 0 → 1：區塊頂端貼齊視窗頂端起算。超過 1 之後進入尾段，橫移維持在底。
        const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
        track.style.transform = `translate3d(${-p * dist}px,0,0)`;
        pin.style.setProperty('--pin-progress', p.toFixed(4));
        // 炫技的核心：每個項目依「離畫面中心多遠」做 3D 旋轉、縮放與明暗。
        // 靠近中心的被推到眼前並打亮，兩側的向後傾斜退開。
        const cx = innerWidth / 2;
        for (const el of track.children) {
          if (!el.classList) continue;
          if (!el.classList.contains('lane-item') && !el.classList.contains('shot') && !el.classList.contains('scene-panel')) continue;
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
        setTimeout(() => e.target.classList.add('is-in'), i * 130);
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

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

  /* ---------- 4. 導讀：逐句點亮 ---------- */
  function initGuide() {
    const secs = [...document.querySelectorAll('[data-guide]')];
    if (!secs.length) return;

    const setup = sec => {
      const lines = [...sec.querySelectorAll('.guide-text span')];
      if (!lines.length) return null;
      // 每句給一個視窗高的捲動距離，讀者被迫看完才過得去
      const run = reduce ? 0 : innerHeight * lines.length * 0.72;
      sec.style.height = `${innerHeight + run}px`;
      if (reduce) lines.forEach(l => l.classList.add('lit'));
      return { sec, lines, run };
    };
    let items = secs.map(setup).filter(Boolean);

    const update = () => {
      for (const { sec, lines, run } of items) {
        if (!run) continue;
        const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / run));
        // 進度換算成「讀到第幾句」，含句內的部分進度
        const exact = p * lines.length;
        lines.forEach((el, i) => {
          const f = Math.min(1, Math.max(0, exact - i));
          el.classList.toggle('lit', f > 0.04);
          el.style.setProperty('--lit', f.toFixed(3));
        });
      }
    };
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    addEventListener('resize', () => { items = secs.map(setup).filter(Boolean); update(); });
    update();
  }

  /* ---------- 5. 導覽列隨捲動收起 ---------- */
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

  const start = () => { initPin(); initGuide(); initReveal(); initProgress(); initNav(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
