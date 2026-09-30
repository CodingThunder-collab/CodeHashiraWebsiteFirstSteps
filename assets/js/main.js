// Theme toggle: remembers the reader's choice, falls back to the OS setting.
(function () {
  const root = document.documentElement;
  const KEY = "ch-theme";

  try {
    const saved = localStorage.getItem(KEY);
    if (saved) root.setAttribute("data-theme", saved);
  } catch (e) { /* storage unavailable */ }

  function isDark() {
    const set = root.getAttribute("data-theme");
    if (set) return set === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncIcon(btn) {
    btn.textContent = isDark() ? "☀" : "☾";
    btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
  }

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector(".theme-toggle");
    if (btn) {
      syncIcon(btn);
      btn.addEventListener("click", function () {
        const next = isDark() ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
        syncIcon(btn);
      });
    }

    // Placeholder subscribe form until an email service is connected.
    const form = document.querySelector(".subscribe form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const note = form.parentElement.querySelector(".form-note");
        if (note) note.textContent = "Thanks! Subscriptions open soon — check back for the next seed. 🌱";
        form.reset();
      });
    }

    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
