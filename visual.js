/* Adaptação nativa das referências Hero Scrub e Halftone Wordmark Footer.
   Fotografias configuradas da Voltux; não depende de React, GSAP ou serviços externos. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = document.getElementById('inicio');
  const tracker = [...document.querySelectorAll('[data-section-link]')];
  const sections = tracker.map(link => document.getElementById(link.dataset.sectionLink));
  const panels = [...document.querySelectorAll('.catalog-panel, .services-hero')];
  const clamp = value => Math.max(0, Math.min(1, value));
  let scheduled = false;
  function renderScroll() {
    scheduled = false;
    const height = innerHeight;
    if (hero) {
      const rect = hero.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, rect.height - height));
      hero.style.setProperty('--setup-scale', reduced.matches ? '1' : String(1 + progress * .24));
    }
    panels.forEach(panel => {
      const rect = panel.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > height) return;
      const progress = clamp((height - rect.top) / (height + rect.height));
      panel.style.setProperty('--section-scale', reduced.matches ? '1' : String(1.1 - progress * .1));
    });
    let active = 0;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= height * .45) active = index;
    });
    tracker.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(renderScroll); }
  }
  function motionChanged() {
    document.documentElement.classList.toggle('scroll-enhanced', !reduced.matches);
    schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reduced.addEventListener('change', motionChanged);
  motionChanged();

  // Máscara tipográfica amostrada em pontos. A física só roda enquanto há interação.
  const canvas = document.getElementById('footer-halftone');
  if (!canvas) return;
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 0, height = 0, dpr = 1, dots = [], frame = 0, visible = false;
  let pointer = { x: -10000, y: -10000 };
  let ring = { x: 0, y: 0, time: -10000 };
  function draw(now) {
    frame = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let moving = false;
    const age = now - ring.time;
    for (const dot of dots) {
      if (!reduced.matches) {
        let dx = dot.x - pointer.x, dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 85) {
          const force = (1 - distance / 85) * 2.6;
          dot.vx += (dx / (distance || 1)) * force;
          dot.vy += (dy / (distance || 1)) * force;
        }
        if (age < 850) {
          dx = dot.homeX - ring.x; dy = dot.homeY - ring.y;
          const distanceToRing = Math.hypot(dx, dy) || 1;
          const force = Math.max(0, 1 - Math.abs(distanceToRing - age * .7) / 26) * 3 * (1 - age / 850);
          dot.vx += dx / distanceToRing * force;
          dot.vy += dy / distanceToRing * force;
        }
        dot.vx = (dot.vx + (dot.homeX - dot.x) * .05) * .84;
        dot.vy = (dot.vy + (dot.homeY - dot.y) * .05) * .84;
        dot.x += dot.vx; dot.y += dot.vy;
        if (Math.abs(dot.vx) + Math.abs(dot.vy) + Math.abs(dot.x - dot.homeX) + Math.abs(dot.y - dot.homeY) > .08) moving = true;
        else { dot.x = dot.homeX; dot.y = dot.homeY; dot.vx = dot.vy = 0; }
      } else { dot.x = dot.homeX; dot.y = dot.homeY; dot.vx = dot.vy = 0; }
      const warmth = Math.min(1, Math.hypot(dot.x - dot.homeX, dot.y - dot.homeY) / 28);
      ctx.fillStyle = `rgb(${Math.round(240 * warmth)},${Math.round(207 * (1 - warmth))},${Math.round(255 - 208 * warmth)})`;
      ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2); ctx.fill();
    }
    if (visible && !document.hidden && !reduced.matches && (moving || age < 850)) frame = requestAnimationFrame(draw);
  }
  function wake() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function layout() {
    width = Math.max(1, Math.round(host.clientWidth));
    height = Math.max(1, Math.round(host.clientHeight));
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
    const m = mask.getContext('2d', { willReadFrequently: true });
    if (!m) return;
    m.font = '900 100px Arial, sans-serif';
    const size = width * .98 / m.measureText('VOLTUX').width * 100;
    m.font = `900 ${size}px Arial, sans-serif`; m.textAlign = 'center'; m.textBaseline = 'alphabetic';
    m.fillText('VOLTUX', width / 2, height * .95);
    const pixels = m.getImageData(0, 0, width, height).data;
    const gap = width < 700 ? 5 : 7;
    dots = [];
    for (let y = gap / 2; y < height; y += gap) {
      for (let x = gap / 2; x < width; x += gap) {
        let alpha = 0;
        for (const sy of [-1, 0, 1]) for (const sx of [-1, 0, 1]) {
          const px = Math.max(0, Math.min(width - 1, Math.floor(x + sx * gap / 3)));
          const py = Math.max(0, Math.min(height - 1, Math.floor(y + sy * gap / 3)));
          alpha += pixels[(py * width + px) * 4 + 3];
        }
        const coverage = alpha / (9 * 255);
        if (coverage > .06) dots.push({ x, y, homeX: x, homeY: y, vx: 0, vy: 0, radius: Math.sqrt(coverage) * gap * .43 });
      }
    }
    host.classList.add('is-ready');
    draw(performance.now());
  }
  canvas.addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect(); pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }; wake();
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointer = { x: -10000, y: -10000 }; wake(); });
  canvas.addEventListener('pointerdown', event => {
    if (reduced.matches) return;
    const rect = canvas.getBoundingClientRect(); ring = { x: event.clientX - rect.left, y: event.clientY - rect.top, time: performance.now() }; wake();
  });
  reduced.addEventListener('change', () => {
    pointer = { x: -10000, y: -10000 }; ring.time = -10000;
    if (frame) cancelAnimationFrame(frame); frame = 0; draw(performance.now());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake();
  });
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(host);
  else addEventListener('resize', layout, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; }
  }).observe(host);
  else visible = true;
  layout();
})();
