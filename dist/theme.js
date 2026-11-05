(() => {
  const storageKey = "sentinel-composer-theme";
  const root = document.documentElement;
  let theme = "dark";

  try {
    if (localStorage.getItem(storageKey) === "light") theme = "light";
  } catch {
    // Storage can be unavailable. The switch still works for this page.
  }

  function applyTheme() {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === "light" ? "#f6f7fb" : "#060608";
    document.querySelectorAll("img[data-light-src]").forEach((image) => {
      image.src = theme === "light" ? image.dataset.lightSrc : image.dataset.darkSrc;
    });
    const toggle = document.querySelector("#theme-toggle");
    if (toggle) {
      const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }
  }

  applyTheme();
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      theme = theme === "dark" ? "light" : "dark";
      applyTheme();
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // Keep the current theme usable when the browser blocks persistence.
      }
      document.dispatchEvent(new Event("themechange"));
    });
  });
})();
