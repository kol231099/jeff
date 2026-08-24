// ===== 背景音樂 =====
// 預設關閉。瀏覽器一律禁止有聲的自動播放，沒有互動就呼叫 play() 只會被拒絕；
// 而且未經同意就出聲，對在辦公室或公共場合開啟網站的人是很糟的體驗。
// 使用者按下之後才播，選擇記在 localStorage，下次自動接續。
(() => {
  const KEY = 'pourmatch_ambient';
  const FADE = 700;          // 淡入淡出，硬切很廉價
  const VOL  = 0.32;         // 背景音樂不該蓋過任何東西

  const el = document.createElement('button');
  el.className = 'ambient';
  el.type = 'button';
  el.setAttribute('aria-label', '背景音樂');
  el.innerHTML = '<i></i><i></i><i></i><span class="ambient-label"></span>';
  document.body.appendChild(el);

  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';    // 沒開就不要浪費使用者的流量
  audio.volume = 0;
  // Opus 為無縫循環而生；Safari 走 AAC
  audio.src = audio.canPlayType('audio/ogg; codecs="opus"') ||
              audio.canPlayType('audio/webm; codecs="opus"')
              ? 'media/ambient.opus?v=1' : 'media/ambient.m4a?v=1';

  let on = false, fadeTimer = null;

  const label = () => {
    const t = window.t ? window.t : (k => k);
    const s = el.querySelector('.ambient-label');
    s.textContent = on ? t('amb.on') : t('amb.off');
  };

  function fade(to, done) {
    clearInterval(fadeTimer);
    const from = audio.volume, steps = 24, dt = FADE / steps;
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); done && done(); }
    }, dt);
  }

  async function start() {
    try {
      await audio.play();          // 被瀏覽器拒絕時會 throw
      on = true;
      el.classList.add('playing');
      fade(VOL);
    } catch (e) {
      // 沒有互動就被擋下：維持關閉狀態，不要顯示成正在播放
      on = false;
      el.classList.remove('playing');
    }
    label();
  }

  function stop() {
    on = false;
    el.classList.remove('playing');
    fade(0, () => audio.pause());
    label();
  }

  el.addEventListener('click', () => (on ? stop() : start()));

  // 切到別的分頁就停，回來再接上 —— 背景還在放音樂很失禮
  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) audio.pause();
    else audio.play().catch(() => {});
  });

  // 刻意不做自動續播。
  // 曾經做過「上次開著就在第一次互動時接續」，但那代表使用者只是隨手點了
  // 頁面上任何地方，音樂就自己響起來 —— 從使用者的角度，那就是網站擅自播放。
  // 音樂一律由本人按下才開始。
  try { localStorage.removeItem(KEY); } catch (e) {}

  // 離開頁面時明確停掉，不倚賴瀏覽器回收
  addEventListener('pagehide', () => { try { audio.pause(); } catch (e) {} });
  addEventListener('beforeunload', () => { try { audio.pause(); } catch (e) {} });

  label();
  addEventListener('pourmatch:langchange', label);
})();
