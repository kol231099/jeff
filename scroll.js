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
      const travel = dist * 1.7;
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

  const start = () => { initPin(); initReveal(); initProgress(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
