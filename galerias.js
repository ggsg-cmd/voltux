/* Galerias configuráveis: uma imagem continua compatível com configurações antigas. */
(() => {
  'use strict';
  const config = window.VOLTUX_CONFIG;
  const core = window.VoltuxCore;
  if (!core || core.validateConfig(config).length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const seconds = config.intervaloFotos || 6;
  const areas = [
    ['hero', '.hero-image', 'Setup Voltux'],
    ['catalogo', '.catalog-image', 'Catálogo Voltux'],
    ['servicos', '.services-hero-image', 'Cuidados com seu PC'],
    ['sobre', '.about-section', 'Sobre a Voltux'],
    ['rodape', '.cinematic-footer', 'Atendimento Voltux']
  ];
  for (const [key, selector, label] of areas) {
    const sources = core.imageSources(config.imagens?.[key]).filter(core.safeImageSource);
    const area = document.querySelector(selector);
    if (!area || !sources.length) continue;
    let holder = area;
    if (key === 'sobre' || key === 'rodape') {
      holder = document.createElement('div'); holder.className = 'section-gallery';
      area.prepend(holder); area.classList.add('has-photo-background');
    }
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    holder.classList.add('photo-gallery');
    // A fotografia é decorativa; títulos e links continuam como conteúdo acessível.
    holder.removeAttribute('role'); holder.removeAttribute('aria-label');
    let current = holder.querySelector('img');
    if (!current) { current = document.createElement('img'); holder.append(current); }
    current.src = sources[0]; current.alt = ''; current.classList.add('gallery-photo');
    if (key === 'hero') { current.loading = 'eager'; current.fetchPriority = 'high'; }
    else current.loading = 'lazy';
    if (sources.length < 2) continue;
    const incoming = document.createElement('img');
    incoming.alt = ''; incoming.className = 'gallery-photo gallery-incoming'; incoming.decoding = 'async';
    holder.append(incoming);
    const controls = document.createElement('div'); controls.className = 'gallery-controls';
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', `Fotos: ${label}`);
    const count = document.createElement('span');
    const pause = document.createElement('button'); pause.type = 'button';
    const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Próxima →'; next.setAttribute('aria-label', `Próxima foto: ${label}`);
    controls.append(count, pause, next);
    // Fora da camada fotográfica para manter os controles clicáveis e legíveis.
    const parent = key === 'hero' ? document.querySelector('.hero-stage') : key === 'catalogo' ? holder.parentElement : area.parentElement;
    if (key === 'sobre' || key === 'rodape') area.append(controls);
    else parent.append(controls);
    let index = 0, paused = false, visible = false, hovered = false, focused = false, timer = 0, fade = 0, busy = false;
    function update() {
      count.textContent = `${index + 1} / ${sources.length}`;
      pause.textContent = paused || reduced.matches ? 'Retomar' : 'Pausar';
      pause.disabled = reduced.matches;
      pause.setAttribute('aria-label', reduced.matches ? 'Troca automática desativada por preferência de movimento reduzido' : `${paused ? 'Retomar' : 'Pausar'} troca automática: ${label}`);
      pause.setAttribute('aria-pressed', String(paused || reduced.matches));
    }
    function schedule() {
      clearTimeout(timer);
      if (visible && !paused && !reduced.matches && !document.hidden && !hovered && !focused && !busy) timer = setTimeout(() => advance(), seconds * 1000);
    }
    function advance(attempt = 1) {
      clearTimeout(timer);
      if (busy) return;
      busy = true;
      const candidate = (index + attempt) % sources.length;
      if (candidate === index) { busy = false; schedule(); return; }
      incoming.onload = () => {
        incoming.classList.add('is-visible');
        fade = setTimeout(() => {
          current.src = sources[candidate]; index = candidate;
          // Espera a imagem de base ser decodificada antes de remover a sobreposição.
          const finish = () => { incoming.classList.remove('is-visible'); busy = false; update(); schedule(); };
          if (current.decode) current.decode().catch(() => {}).then(finish); else finish();
        }, reduced.matches ? 0 : 700);
      };
      incoming.onerror = () => { busy = false; if (attempt < sources.length - 1) advance(attempt + 1); else schedule(); };
      incoming.src = sources[candidate];
    }
    pause.addEventListener('click', () => { paused = !paused; update(); schedule(); });
    next.addEventListener('click', () => advance());
    controls.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    controls.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    controls.addEventListener('focusin', () => { focused = true; schedule(); });
    controls.addEventListener('focusout', () => { focused = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', () => { update(); schedule(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }).observe(area);
    else { visible = true; schedule(); }
    update();
    addEventListener('pagehide', () => { clearTimeout(timer); clearTimeout(fade); });
  }
})();
