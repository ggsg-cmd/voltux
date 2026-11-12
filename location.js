import "./vendor/location-globe/location-globe.js";
const mount = () => {
  const widget = document.querySelector("netflash-location");
  if (widget)
    widget.config = {
      name: "Voltux Informática",
      ...(window.VOLTUX_CONFIG?.localizacao || {}),
    };
};
if (document.readyState !== "complete")
  document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
