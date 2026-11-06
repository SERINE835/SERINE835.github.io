(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Fawn eyes: open at load, then blink at random ---------- */
  const eye = document.querySelector('.eye');
  const blinkOnce = (ms = 140) => {
    if (!eye) return;
    eye.classList.add('is-closed');
    setTimeout(() => eye.classList.remove('is-closed'), ms);
  };
  const blinkLoop = () => {
    blinkOnce();
    if (Math.random() < 0.25) setTimeout(() => blinkOnce(120), 280);      // sometimes a double blink
    setTimeout(blinkLoop, 2600 + Math.random() * 3800);
  };
  // the fawn starts asleep (eyelid closed from the <head> script), then wakes up
  setTimeout(() => {
    root.classList.remove('js-start');
    if (!reduce) setTimeout(blinkLoop, 2200);
  }, reduce ? 0 : 1300);

  /* ---------- 2. Mouse parallax (stage + flowers move at different depths) ---------- */
  if (finePointer && !reduce) {
    addEventListener('pointermove', e => {
      root.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3));
      root.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3));
    }, { passive: true });
  }

  /* ---------- 3. Petal canvas: ambient petals, sparkles, cursor trail ---------- */
  const canvas = document.getElementById('petals');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const COLORS = ['#f7b6cf', '#f3a9c6', '#fde3ee', '#f08fb5', '#e8c987'];
  const rand = (a, b) => a + Math.random() * (b - a);

  const ambient = [];
  const sparks = [];
  const bits = [];                         // trail / burst petals
  const AMBIENT_N = Math.max(14, Math.min(34, Math.round(innerWidth / 55)));
  const SPARK_N = Math.max(14, Math.min(34, Math.round(innerWidth / 50)));

  const newAmbient = (anywhere = true) => ({
    x: rand(0, W), y: anywhere ? rand(0, H) : -20,
    size: rand(4, 9), vy: rand(0.25, 0.7), drift: rand(0.2, 0.7),
    phase: rand(0, 6.28), rot: rand(0, 6.28), vr: rand(-0.02, 0.02),
    a: rand(0.35, 0.8), c: COLORS[(Math.random() * COLORS.length) | 0]
  });
  for (let i = 0; i < AMBIENT_N; i++) ambient.push(newAmbient());
  for (let i = 0; i < SPARK_N; i++) sparks.push({
    x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.8), t: rand(0, 6.28), s: rand(0.01, 0.035)
  });

  const drawPetal = (x, y, size, rot, color, alpha) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * .9, -size * .6, size * .7, size * .7, 0, size);
    ctx.bezierCurveTo(-size * .7, size * .7, -size * .9, -size * .6, 0, -size);
    ctx.fill();
    ctx.restore();
  };

  const spawnBit = (x, y, burst = false) => bits.push({
    x, y,
    vx: burst ? rand(-3, 3) : rand(-0.6, 0.6),
    vy: burst ? rand(-3.5, 0.5) : rand(-0.2, 0.6),
    size: rand(4, 8), rot: rand(0, 6.28), vr: rand(-0.1, 0.1),
    life: 0, max: rand(60, 110), c: COLORS[(Math.random() * COLORS.length) | 0]
  });

  const frame = () => {
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;

    for (const s of sparks) {
      s.t += s.s;
      const a = (Math.sin(s.t) + 1) / 2 * 0.8;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffe9b0';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.y += p.vy; p.x += Math.sin(t + p.phase) * p.drift - 0.15; p.rot += p.vr;
      if (p.y > H + 20 || p.x < -30) ambient[i] = newAmbient(false);
      drawPetal(p.x, p.y, p.size, p.rot, p.c, p.a);
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life++; b.vy += 0.03; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.vx *= 0.985;
      const a = 1 - b.life / b.max;
      if (a <= 0) { bits.splice(i, 1); continue; }
      drawPetal(b.x, b.y, b.size, b.rot, b.c, a * 0.9);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  };
  if (!reduce) requestAnimationFrame(frame);

  /* ---------- 4. Flower cursor (mouse) + tap petals (touch) ---------- */
  const cursor = document.getElementById('cursor');
  if (finePointer) {
    root.classList.add('has-cursor');
    let tx = -100, ty = -100, cx = -100, cy = -100, lastX = 0, lastY = 0, angle = 0;

    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('is-visible');
      if (!reduce && Math.hypot(tx - lastX, ty - lastY) > 26) {
        spawnBit(tx, ty); lastX = tx; lastY = ty;
      }
      cursor.classList.toggle('is-hot', !!e.target.closest('a, button'));
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));

    const follow = () => {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      angle += ((tx - cx) * 1.2 - angle) * 0.15;          // tilts while moving
      cursor.style.transform = `translate3d(${cx}px,${cy}px,0) rotate(${angle}deg)`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  // Click / tap anywhere: little burst of petals (+ the fawn blinks when you tap it)
  addEventListener('pointerdown', e => {
    if (!reduce) for (let i = 0; i < 9; i++) spawnBit(e.clientX, e.clientY, true);
    if (e.target.closest('.stage')) blinkOnce(180);
  });

  /* ---------- 5. Nav: active link + mobile menu ---------- */
  const links = [...document.querySelectorAll('.nav a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => s && io.observe(s));

  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
  });
})();
