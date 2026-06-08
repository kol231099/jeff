// ===== 粒子背景動畫：漂浮的光點 + 滑鼠互動 =====
(() => {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // 偵測觸控/低階裝置：手機上大幅降階
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;
  const isLowEnd = isTouch
    || (navigator.deviceMemory && navigator.deviceMemory < 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);

  // 手機限制 DPR 為 1，桌面最多 2（avoid 4K monitors blowing it up）
  const DPR = isLowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const ENABLE_LINES = !isLowEnd;       // 手機關掉 O(n²) 連線
  const ENABLE_GLOW = !isLowEnd;        // 手機關掉 shadowBlur
  const ENABLE_MOUSE = !isTouch;        // 手機沒滑鼠互動

  let w, h, particles;
  let rafId = null;
  let lastFrame = 0;
  const targetFps = isLowEnd ? 30 : 60;
  const frameInterval = 1000 / targetFps;
  const mouse = { x: -9999, y: -9999 };

  const COLORS = [
    'rgba(255, 181, 71, 0.8)',
    'rgba(255, 77, 141, 0.75)',
    'rgba(123, 92, 255, 0.8)',
    'rgba(0, 229, 255, 0.6)',
  ];

  function resize() {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function initParticles() {
    const area = window.innerWidth * window.innerHeight;
    const baseCount = Math.floor(area / (isLowEnd ? 28000 : 12000));
    const cap = isLowEnd ? 30 : 120;
    const count = Math.max(8, Math.min(cap, baseCount));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 2 + 0.5) * DPR,
      vx: (Math.random() - 0.5) * 0.3 * DPR,
      vy: (Math.random() - 0.5) * 0.3 * DPR,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (now - lastFrame < frameInterval) return;
    lastFrame = now;

    ctx.clearRect(0, 0, w, h);

    if (ENABLE_GLOW) {
      ctx.shadowBlur = 12 * DPR;
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.twinkle += 0.03;

      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      if (ENABLE_MOUSE) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 * DPR) {
          const force = (120 * DPR - dist) / (120 * DPR);
          p.x += (dx / dist) * force * 2;
          p.y += (dy / dist) * force * 2;
        }
      }

      const alpha = 0.5 + Math.sin(p.twinkle) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (ENABLE_GLOW) ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ENABLE_LINES) {
      ctx.shadowBlur = 0;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 140 * DPR) {
            ctx.globalAlpha = (1 - d / (140 * DPR)) * 0.15;
            ctx.strokeStyle = 'rgba(255, 181, 71, 0.5)';
            ctx.lineWidth = 0.5 * DPR;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); initParticles(); }, 150);
  });

  if (ENABLE_MOUSE) {
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX * DPR;
      mouse.y = e.clientY * DPR;
    });
    window.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });
  }

  // 頁面隱藏時暫停（省電 + 不卡）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (!rafId) {
      lastFrame = 0;
      rafId = requestAnimationFrame(draw);
    }
  });

  resize();
  initParticles();
  rafId = requestAnimationFrame(draw);
})();

// ===== 滑鼠跟隨光暈（手機不掛）=====
(() => {
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;
  if (isTouch) return;

  const cursorGlow = document.createElement('div');
  cursorGlow.style.cssText = `
    position: fixed;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 181, 71, 0.08), transparent 60%);
    pointer-events: none;
    z-index: 1;
    mix-blend-mode: screen;
    transform: translate(-50%, -50%);
    transition: transform 0.15s ease-out;
    left: -9999px;
  `;
  document.body.appendChild(cursorGlow);
  window.addEventListener('mousemove', e => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
  });
})();
