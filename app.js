(() => {
  'use strict';
  const config = window.VOLTUX_CONFIG;
  const core = window.VoltuxCore;
  if (!core || core.validateConfig(config).length) {
    document.getElementById('services-grid').textContent = 'Fale com a loja pelo WhatsApp para consultar os serviços.';
    return;
  }
  const items = core.itemsById(config);
  const storageKey = 'voltux-carrinho-v1';
  let cart = [];
  try { cart = core.normalizeCart(JSON.parse(localStorage.getItem(storageKey)), config); } catch {}
  let toastTimeout;
  let scrollPending = false;
  const dialog = document.getElementById('cart-dialog');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function photo(item, className) {
    const slot = el('div', `${className} media-slot`);
    slot.dataset.imageSlot = item.id;
    const source = typeof item.imagem === 'string' ? item.imagem.trim() : '';
    if (source && (core.safeWebUrl(source) || (!/^[a-z][a-z0-9+.-]*:/i.test(source) && !source.startsWith('//')))) {
      const image = el('img');
      image.src = source;
      image.alt = item.nome;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 600;
      image.height = 400;
      slot.append(image);
    } else {
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', `Espaço reservado para a imagem de ${item.nome}`);
    }
    return slot;
  }
  function fillStaticImage(slotName, source, alt) {
    const slot = document.querySelector(`[data-image-slot="${slotName}"]`);
    const cleanSource = typeof source === 'string' ? source.trim() : '';
    if (!slot || !cleanSource) return;
    if (!core.safeWebUrl(cleanSource) && (/^[a-z][a-z0-9+.-]*:/i.test(cleanSource) || cleanSource.startsWith('//'))) return;
    const image = el('img');
    image.src = cleanSource;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 900;
    image.height = 700;
    slot.removeAttribute('role');
    slot.removeAttribute('aria-label');
    slot.replaceChildren(image);
  }
  function directLink(item) {
    return core.whatsappUrl(config.whatsapp, core.messageForCart([{ id: item.id, quantidade: 1 }], config));
  }
  function actions(item, isService) {
    const wrapper = el('div', 'card-actions');
    const add = el('button', 'button button-outline', 'Adicionar ao carrinho');
    add.type = 'button';
    add.dataset.addItem = item.id;
    add.setAttribute('aria-label', `Adicionar ${item.nome} ao carrinho`);
    const buy = el('a', 'text-link', isService ? 'Agendar agora' : 'Comprar agora');
    buy.href = directLink(item);
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    buy.dataset.buyItem = item.id;
    buy.setAttribute('aria-label', `${isService ? 'Agendar' : 'Comprar'} ${item.nome} pelo WhatsApp`);
    wrapper.append(add, buy);
    return wrapper;
  }
  config.servicos.forEach(item => {
    const card = el('article', 'service-card interactive-card');
    card.dataset.reveal = '';
    card.dataset.itemId = item.id;
    const body = el('div', 'service-body');
    body.append(el('h4', '', item.nome), el('p', '', item.descricao), el('div', 'service-price' + (item.preco === null ? ' is-consultation' : ''), core.formatPrice(item)), el('div', 'price-note', item.observacaoPreco || ''), actions(item, true));
    card.append(photo(item, 'service-image'), body);
    document.getElementById('services-grid').append(card);
  });
  if (!config.servicos.length) document.getElementById('services-grid').append(el('p', '', 'Converse com a Voltux para conhecer os serviços disponíveis.'));

  const catalog = document.getElementById('catalog-link');
  catalog.href = core.safeWebUrl(config.catalogoUrl) || core.whatsappUrl(config.whatsapp, 'Olá, Voltux! Gostaria de receber o catálogo.');
  if (!config.catalogoUrl) catalog.textContent = 'Pedir catálogo no WhatsApp';
  fillStaticImage('hero-pc', config.imagens?.hero, 'PC gamer montado pela Voltux');
  fillStaticImage('catalogo', config.imagens?.catalogo, 'Produtos disponíveis no catálogo da Voltux');
  document.querySelectorAll('[data-whatsapp]').forEach(link => { link.href = core.whatsappUrl(config.whatsapp, link.dataset.whatsapp); });
  document.querySelectorAll('[data-instagram]').forEach(link => { link.href = core.safeWebUrl(config.instagram); });
  const nationalPhone = config.whatsapp.replace(/^55/, '');
  document.querySelector('[data-phone-label]').textContent = nationalPhone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');

  function notify(text) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2700);
  }
  function saveCart() {
    cart = core.normalizeCart(cart, config);
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch {}
    renderCart();
  }
  function renderCart() {
    const active = document.activeElement;
    const previousFocus = dialog.contains(active) && active.dataset.cartAction ? { action: active.dataset.cartAction, id: active.dataset.id } : null;
    const holder = document.getElementById('cart-items');
    holder.replaceChildren();
    const count = cart.reduce((sum, entry) => sum + entry.quantidade, 0);
    document.querySelectorAll('[data-cart-count]').forEach(badge => { badge.textContent = String(count); });
    document.querySelector('.cart-toggle').setAttribute('aria-label', `Abrir carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`);
    if (!cart.length) {
      const empty = el('div', 'cart-empty');
      empty.append(el('h3', '', 'Seu próximo setup começa aqui.'), el('p', '', 'Adicione serviços e leve sua lista para o WhatsApp.'));
      holder.append(empty);
    }
    cart.forEach(entry => {
      const item = items.get(entry.id);
      const row = el('article', 'cart-item');
      const price = item.tipo === 'serviço' ? core.formatPrice(item) + (item.observacaoPreco ? ` ${item.observacaoPreco}` : '') : 'Produto · opções e valores pelo WhatsApp';
      row.append(el('h3', '', item.nome), el('p', 'item-description', price));
      const controls = el('div', 'cart-item-controls');
      const quantity = el('div', 'quantity-control');
      for (const action of ['decrease', 'increase']) {
        const button = el('button', '', action === 'decrease' ? '-' : '+');
        button.type = 'button';
        button.dataset.cartAction = action;
        button.dataset.id = entry.id;
        button.disabled = action === 'increase' ? entry.quantidade >= 99 : entry.quantidade <= 1;
        button.setAttribute('aria-label', `${action === 'decrease' ? 'Diminuir' : 'Aumentar'} quantidade de ${item.nome}`);
        if (action === 'increase') quantity.append(el('span', '', entry.quantidade));
        quantity.append(button);
      }
      const remove = el('button', 'remove-item', 'Remover');
      remove.type = 'button';
      remove.dataset.cartAction = 'remove';
      remove.dataset.id = entry.id;
      remove.setAttribute('aria-label', `Remover ${item.nome} do carrinho`);
      controls.append(quantity, remove);
      row.append(controls);
      holder.append(row);
    });
    const summary = document.getElementById('cart-summary');
    summary.replaceChildren();
    const pricedServices = cart.filter(entry => items.get(entry.id).tipo === 'serviço' && items.get(entry.id).preco !== null);
    if (pricedServices.length) {
      const cents = pricedServices.reduce((sum, entry) => sum + Math.round(items.get(entry.id).preco * 100) * entry.quantidade, 0);
      const line = el('div', 'summary-line');
      line.append(el('span', '', 'Serviços com valor informado'), el('strong', '', core.money.format(cents / 100)));
      summary.append(line);
    }
    if (cart.length) {
      const hasUnpriced = cart.some(entry => { const item = items.get(entry.id); return item.tipo === 'produto' || item.preco === null || item.observacaoPreco || item.aPartirDe; });
      summary.append(el('p', 'summary-note', hasUnpriced ? 'Peças e serviços sob consulta são combinados com a loja. Este não é o valor final do atendimento.' : 'Combine o atendimento e o pagamento diretamente com a loja.'));
    }
    const checkout = document.getElementById('cart-checkout');
    checkout.hidden = !cart.length;
    checkout.href = core.whatsappUrl(config.whatsapp, core.messageForCart(cart, config));
    if (previousFocus) {
      const restored = holder.querySelector(`[data-cart-action="${previousFocus.action}"][data-id="${previousFocus.id}"]`);
      if (restored && !restored.disabled) restored.focus();
      else (holder.querySelector('button:not(:disabled)') || document.getElementById('continue-browsing')).focus();
    }
  }
  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add-item]');
    if (add) {
      const item = items.get(add.dataset.addItem);
      if (!item) return;
      const entry = cart.find(row => row.id === item.id);
      if (entry && entry.quantidade >= 99) { notify('Limite de 99 unidades por item.'); return; }
      if (entry) entry.quantidade++;
      else cart.push({ id: item.id, quantidade: 1 });
      saveCart();
      notify(`${item.nome} adicionado ao carrinho.`);
    }
    const control = event.target.closest('[data-cart-action]');
    if (control) {
      const entry = cart.find(row => row.id === control.dataset.id);
      if (!entry) return;
      if (control.dataset.cartAction === 'remove') cart = cart.filter(row => row.id !== entry.id);
      else entry.quantidade += control.dataset.cartAction === 'increase' ? 1 : -1;
      saveCart();
    }
  });
  document.querySelectorAll('[data-open-cart]').forEach(button => button.addEventListener('click', () => {
    renderCart();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  document.getElementById('close-cart').addEventListener('click', () => dialog.close());
  document.getElementById('continue-browsing').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) { try { cart = core.normalizeCart(JSON.parse(event.newValue), config); } catch { cart = []; } renderCart(); }
  });
  renderCart();

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: .08 });
    document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));
    document.documentElement.classList.toggle('has-motion', !reducedMotion.matches);
    reducedMotion.addEventListener('change', () => document.documentElement.classList.toggle('has-motion', !reducedMotion.matches));
  }
  document.querySelectorAll('.interactive-card, .main-hero').forEach(surface => {
    surface.addEventListener('pointermove', event => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const bounds = surface.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      surface.style.setProperty('--mx', `${x * 100}%`);
      surface.style.setProperty('--my', `${y * 100}%`);
      if (surface.classList.contains('main-hero')) {
        surface.style.setProperty('--px', `${(x - .5) * 18}px`);
        surface.style.setProperty('--py', `${(y - .5) * 12}px`);
      }
    }, { passive: true });
    surface.addEventListener('pointerleave', () => { surface.style.setProperty('--px', '0px'); surface.style.setProperty('--py', '0px'); });
  });
  function updateScroll() {
    scrollPending = false;
    const range = document.documentElement.scrollHeight - innerHeight;
    document.querySelector('.scroll-progress').style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0})`;
    document.querySelector('.site-header').classList.toggle('is-scrolled', scrollY > 35);
    const activeSection = document.getElementById('sobre').getBoundingClientRect().top <= 180 ? 'sobre' : document.getElementById('servicos').getBoundingClientRect().top <= 180 ? 'servicos' : document.getElementById('catalogo').getBoundingClientRect().top <= 180 ? 'catalogo' : '';
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === activeSection) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('[data-parallax]').style.setProperty('--sy', reducedMotion.matches ? '0px' : `${Math.min(35, scrollY * .06)}px`);
  }
  function scheduleScroll() { if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); } }
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  updateScroll();
})();
