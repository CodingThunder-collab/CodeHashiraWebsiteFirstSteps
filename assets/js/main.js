(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Placeholder subscribe form until an email service is connected.
    const form = document.querySelector(".subscribe form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const note = form.parentElement.querySelector(".form-note");
        if (note) note.textContent = "Thanks! Subscriptions open soon — keep sharpening. ⚔";
        form.reset();
      });
    }

    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
