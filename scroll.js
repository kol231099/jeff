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
            `perspective(1500px) rotateY(${-k * 22}deg) scale(${1 - Math.abs(k) * 0.12}) translateZ(${-Math.abs(k) * 110}px)`;
          // 衰減收斂：原本降到 50% 不透明 + 62% 亮度，內容直接讀不到。
          // 深度感由旋轉與縮放承擔就夠了。
          el.style.opacity = (1 - Math.abs(k) * 0.2).toFixed(3);
          el.style.setProperty('--focus', (1 - Math.min(1, Math.abs(k) * 1.15)).toFixed(3));
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

  /* ---------- 4. 倒酒影片：捲動擦洗播放進度 ----------
     不呼叫 play()，而是直接把捲動進度寫進 currentTime。
     影片已重新編碼成每 4 格一個關鍵影格，所以 seek 幾乎即時。 */

  // 影片每一秒對應多少捲動像素。這是唯一要調的旋鈕：
  // 調大 = 滑得更久（更慢），調小 = 更快滑完。
  const SCRUB_PX_PER_SEC = 480;

  function initScrub() {
    const secs = [...document.querySelectorAll('[data-scrub]')];
    if (!secs.length) return;

    const setup = sec => {
      const v = sec.querySelector('[data-scrub-video]');
      if (!v) return null;
      const dur = v.duration;
      if (!dur || !isFinite(dur)) return null;
      const run = reduce ? 0 : Math.round(dur * SCRUB_PX_PER_SEC);
      sec.style.height = `${innerHeight + run}px`;
      return { sec, v, dur, run, want: 0, pendingAt: 0, lastRecover: 0 };
    };

    let items = [];
    const build = () => { items = secs.map(setup).filter(Boolean); update(); };

    // 頁面閒置一段時間後，Safari 會釋放媒體解碼器來省電。此時 currentTime
    // 的寫入會被接受，但畫面不再更新 —— 看起來就是「卡在某一格不動」。
    // 這個看門狗負責偵測並把元素重新載回來。
    const RECOVER_AFTER = 700;    // 要求 seek 後多久沒到位就視為失聯
    const RECOVER_GAP  = 2500;    // 兩次復原之間的最小間隔，避免反覆重載

    function recover(st) {
      const now = performance.now();
      if (now - st.lastRecover < RECOVER_GAP) return;
      st.lastRecover = now;
      st.pendingAt = 0;
      const target = st.want;
      try {
        st.v.load();                       // 重新取得解碼器
        st.v.addEventListener('loadeddata', () => {
          try { st.v.currentTime = target; } catch (e) {}
        }, { once: true });
      } catch (e) {}
    }

    let ticking = false;
    function update() {
      const now = performance.now();
      for (const st of items) {
        const { sec, v, dur, run } = st;
        if (!run) continue;
        const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / run));
        const t = p * dur;
        st.want = t;

        // 差距太小就不寫入：每格都 seek 會讓 Safari 卡頓
        if (Math.abs(v.currentTime - t) > 1 / 48) {
          try { v.currentTime = t; } catch (e) {}
          if (!st.pendingAt) st.pendingAt = now;
        } else {
          st.pendingAt = 0;
        }

        // 要求了 seek 卻遲遲沒到位，而且解碼器已經沒資料 → 重新載入
        if (st.pendingAt && now - st.pendingAt > RECOVER_AFTER &&
            Math.abs(v.currentTime - t) > 0.12 && v.readyState < 2) {
          recover(st);
        }

        sec.style.setProperty('--scrub', p.toFixed(4));
      }
    }

    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    addEventListener('resize', build);

    // 分頁切回來時，媒體多半已經被釋放，先確認狀態
    addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      for (const st of items) if (st.v.readyState < 2) recover(st);
    });

    // 影片要先知道長度才能換算行程
    for (const sec of secs) {
      const v = sec.querySelector('[data-scrub-video]');
      if (!v) continue;
      if (v.readyState >= 1) build();
      else v.addEventListener('loadedmetadata', build, { once: true });
      // 有些瀏覽器不先觸碰就不解碼第一格
      v.addEventListener('loadeddata', () => { try { v.currentTime = 0.001; } catch (e) {} }, { once: true });
      // 解碼器被回收或串流中斷時主動復原
      for (const ev of ['emptied', 'stalled', 'error', 'suspend']) {
        v.addEventListener(ev, () => {
          const st = items.find(x => x.v === v);
          if (st && v.readyState < 2) recover(st);
        });
      }
      v.addEventListener('seeked', () => {
        const st = items.find(x => x.v === v);
        if (st) st.pendingAt = 0;
      });
    }
  }

  /* ---------- 5. 導讀：逐句點亮 ---------- */
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

  /* ---------- 6. 導覽列隨捲動收起 ---------- */
  function initNav() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    // 只滑一點點就跳出來很煩。累積往上的距離，超過門檻才現身；
    // 一往下滑就把累積歸零。
    const UP_THRESHOLD = 110;
    let last = scrollY, up = 0, ticking = false;
    const update = () => {
      const y = scrollY;
      const d = y - last;
      nav.classList.toggle('nav-solid', y > 8);

      if (y <= 60) {                    // 回到最上面一定顯示
        up = 0;
        nav.classList.remove('nav-hidden');
      } else if (d > 0) {               // 往下：收起，累積歸零
        up = 0;
        if (y > 160) nav.classList.add('nav-hidden');
      } else if (d < 0) {               // 往上：累積夠了才現身
        up -= d;
        if (up > UP_THRESHOLD) {
          nav.classList.remove('nav-hidden');
          up = 0;
        }
      }
      last = y;
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    update();
  }

  const start = () => { initPin(); initScrub(); initGuide(); initReveal(); initProgress(); initNav(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
