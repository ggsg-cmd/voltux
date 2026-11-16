/** Netflash: globo decorativo + transição para um mapa oficial. Sem dependências. */
const base = new URL("./", import.meta.url);
export function coordinates(value) {
  const lat = value?.lat,
    lng = value?.lng;
  return typeof lat === "number" &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}
export function embedSource(value) {
  if (value?.embedUrl)
    try {
      const url = new URL(value.embedUrl);
      if (
        url.origin === "https://www.google.com" &&
        url.pathname === "/maps/embed" &&
        url.searchParams.has("pb") &&
        !url.username &&
        !url.password
      )
        return url.href;
    } catch {}
  if (
    typeof value?.googleMapsKey === "string" &&
    value.googleMapsKey.trim() &&
    value?.address
  ) {
    const url = new URL("https://www.google.com/maps/embed/v1/place");
    url.search = new URLSearchParams({
      key: value.googleMapsKey.trim(),
      q: value.address,
      maptype: "satellite",
      zoom: "18",
      language: "pt-BR",
    });
    const center = coordinates(value);
    if (center) url.searchParams.set("center", `${center.lat},${center.lng}`);
    return url.href;
  }
  return "";
}
export function mapsLink(value) {
  const center = coordinates(value);
  if (center) {
    const url = new URL("https://www.google.com/maps/@");
    url.search = new URLSearchParams({
      api: "1",
      map_action: "map",
      center: `${center.lat},${center.lng}`,
      zoom: "18",
      basemap: "satellite",
    });
    return url.href;
  }
  if (value?.address) {
    const url = new URL("https://www.google.com/maps/search/");
    url.search = new URLSearchParams({ api: "1", query: value.address });
    return url.href;
  }
  return "";
}
export class LocationGlobe extends (globalThis.HTMLElement || class {}) {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }
  set config(value) {
    this._config = value && typeof value === "object" ? value : {};
    if (this.isConnected) this.mount();
  }
  get config() {
    return this._config;
  }
  connectedCallback() {
    this.mount();
  }
  disconnectedCallback() {
    this.cleanup();
  }
  cleanup() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.listeners?.abort();
    this.generation = (this.generation || 0) + 1;
  }
  mount() {
    this.cleanup();
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${new URL("vendor--location-globe--location-globe.css", base).href}"><section class="location"><div class="stage"><div class="stars" aria-hidden="true"></div><div class="orbit" aria-hidden="true"></div><div class="earth"><canvas width="230" height="230" aria-hidden="true"></canvas><span class="pin" aria-hidden="true"></span></div><div class="map-slot"></div><div class="stage-label"><span class="kicker">DO MUNDO ATÉ VOCÊ</span><span class="stage-status" role="status" aria-live="polite">Nossa localização</span></div></div><div class="address-panel"><div><span class="badge"></span><h3></h3><p class="address"></p><p class="note"></p></div><div class="actions"><a target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a><button type="button">Ver localização</button></div></div></section>`;
    this.stage = this.shadowRoot.querySelector(".stage");
    this.earth = this.shadowRoot.querySelector(".earth");
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.info = this.shadowRoot.querySelector(".stage-status");
    const credit=document.createElement('small');credit.className='globe-credit';credit.textContent='Globo: NASA Earth Observatory';this.shadowRoot.querySelector('.stage-label').append(credit);
    const config = this.config,
      address = typeof config.address === "string" ? config.address.trim() : "";
    this.shadowRoot.querySelector("h3").textContent =
      config.name || "Encontre nossa loja";
    this.shadowRoot.querySelector(".address").textContent =
      address || "Endereço a definir na versão personalizada.";
    this.shadowRoot.querySelector(".badge").textContent = config.demo
      ? "LOCALIZAÇÃO DEMONSTRATIVA"
      : "NOSSO ENDEREÇO";
    this.shadowRoot.querySelector(".pin").hidden = !coordinates(config);
    this.shadowRoot.querySelector(".note").textContent = config.demo
      ? "Barbearia fictícia. Este exemplo não indica um estabelecimento real."
      : embedSource(config)
        ? "Ao visualizar o mapa, o conteúdo é carregado pelo Google."
        : "Confira o endereço e abra o mapa para ver a região e traçar sua rota.";
    const link = this.shadowRoot.querySelector("a"),
      href = mapsLink(config);
    link.hidden = !href;
    if (href) link.href = href;
    this.button = this.shadowRoot.querySelector("button");
    this.button.addEventListener(
      "click",
      () => {
        if (this.dataset.state === "playing") this.finish();
        else this.start();
      },
      { signal },
    );
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.motion.addEventListener(
      "change",
      () => {
        if (this.motion.matches) this.finish();
      },
      { signal },
    );
    this.dataset.state = "idle";
    this.visible = false;
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0].isIntersecting;
        if (this.visible && this.dataset.state === "idle") this.start();
      },
      { threshold: 0.18 },
    );
    this.observer.observe(this);
  }
  async texture() {
    if (this.pixels) return;
    const image = new Image();
    image.src = globalThis.NETFLASH_EARTH_TEXTURE || new URL("vendor--location-globe--earth.jpg", base).href;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, 1024, 512);
    this.pixels = ctx.getImageData(0, 0, 1024, 512).data;
    const size = 230;
    this.sphere = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = (x - size / 2) / (size / 2 - 2),
          ny = (size / 2 - y) / (size / 2 - 2),
          square = nx * nx + ny * ny;
        if (square <= 1)
          this.sphere.push([4 * (y * size + x), nx, ny, Math.sqrt(1 - square)]);
      }
  }
  draw(lon, lat) {
    if (!this.pixels) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const out = ctx.createImageData(230, 230),
      r = Math.PI / 180,
      cl = Math.cos(lat * r),
      sl = Math.sin(lat * r),
      co = Math.cos(lon * r),
      so = Math.sin(lon * r);
    for (const [i, x, y, z] of this.sphere) {
      const wy = y * cl + z * sl,
        tz = z * cl - y * sl,
        wx = x * co + tz * so,
        wz = tz * co - x * so;
      const u = Math.min(
          1023,
          Math.max(
            0,
            Math.floor((Math.atan2(wx, wz) / (2 * Math.PI) + 0.5) * 1024),
          ),
        ),
        v = Math.min(
          511,
          Math.max(
            0,
            Math.floor(
              (0.5 - Math.asin(Math.max(-1, Math.min(1, wy))) / Math.PI) * 512,
            ),
          ),
        ),
        j = 4 * (v * 1024 + u),
        light = Math.max(0.25, 0.5 + 0.5 * (-x * 0.3 + y * 0.15 + z * 0.9));
      out.data[i] = this.pixels[j] * light;
      out.data[i + 1] = this.pixels[j + 1] * light;
      out.data[i + 2] = this.pixels[j + 2] * light;
      out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }
  async start() {
    cancelAnimationFrame(this.frame);
    const generation = this.generation;
    this.shadowRoot.querySelector(".map-slot").replaceChildren();
    this.stage.classList.remove("arrived", "map-visible");
    this.dataset.state = "playing";
    this.button.textContent = "Pular animação";
    this.info.textContent = "Uma conexão com o nosso lugar.";
    try {
      await this.texture();
    } catch {
      /* O globo CSS continua visível se a textura não carregar. */
    }
    if (
      generation !== this.generation ||
      !this.isConnected ||
      this.dataset.state !== "playing"
    )
      return;
    if (this.motion.matches) {
      this.finish();
      return;
    }
    const target = coordinates(this.config) || { lat: -15, lng: -47 };
    let elapsed = 0,
      last = performance.now(),
      lastDraw = 0;
    const animate = (now) => {
      if (this.dataset.state !== "playing") return;
      const delta = Math.min(now - last, 60);
      last = now;
      if (this.visible && document.visibilityState !== "hidden")
        elapsed += delta;
      const progress = Math.min(elapsed / 3400, 1),
        ease = 1 - Math.pow(1 - progress, 3);
      if (now - lastDraw > 45) {
        this.draw(target.lng - 420 * (1 - ease), 15 + (target.lat - 15) * ease);
        lastDraw = now;
      }
      if (progress >= 1) {
        this.finish();
        return;
      }
      this.frame = requestAnimationFrame(animate);
    };
    this.frame = requestAnimationFrame(animate);
  }
  finish() {
    cancelAnimationFrame(this.frame);
    if (!this.stage) return;
    this.dataset.state = "arrived";
    this.button.textContent = "Rever o globo";
    const target = coordinates(this.config) || { lat: -15, lng: -47 };
    this.draw(target.lng, target.lat);
    this.stage.classList.add("arrived");
    const url = embedSource(this.config);
    this.info.textContent = this.config.demo
      ? "Demonstração de localização"
      : this.config.address
        ? "Seu caminho até a loja."
        : "Um novo endereço pode começar aqui.";
    const slot = this.shadowRoot.querySelector(".map-slot");
    if (url && !slot.firstChild) {
      const iframe = document.createElement("iframe");
      iframe.title = `Vista de satélite: ${this.config.name || "localização da loja"}`;
      iframe.src = url;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      iframe.addEventListener(
        "load",
        () => {
          if (iframe.isConnected) this.stage.classList.add("map-visible");
        },
        { once: true },
      );
      slot.append(iframe);
      this.info.textContent = "Abrindo a visualização do Google Maps…";
    }
  }
}
if (globalThis.customElements && !customElements.get("netflash-location"))
  customElements.define("netflash-location", LocationGlobe);
