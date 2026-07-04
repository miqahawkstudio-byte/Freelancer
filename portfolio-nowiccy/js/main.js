/* ==========================================================================
   czuły punkt Nowiccy — main.js
   Bazowe mechanizmy wspólne dla wszystkich podstron:
   1. Menu mobilne (hamburger)
   2. Scroll reveal (animacja pojawiania się sekcji)
   Kolejne moduły (lightbox, filtry portfolio) dojdą w dalszych etapach.
   ========================================================================== */

(function () {
  "use strict";

  /* ----- 1. MENU MOBILNE ----- */
  var navToggle = document.querySelector(".nav-toggle");
  var navList = document.querySelector(".nav-list");

  if (navToggle && navList) {
    navToggle.addEventListener("click", function () {
      var isOpen = navList.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    // Zamknij menu po kliknięciu linku (na mobile)
    navList.addEventListener("click", function (e) {
      if (e.target.closest(".nav-link")) {
        navList.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });

    // Zamknij menu klawiszem Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navList.classList.contains("is-open")) {
        navList.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        navToggle.focus();
      }
    });
  }

  /* ----- 2. SCROLL REVEAL ----- */
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback dla starych przeglądarek — pokaż wszystko od razu
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
