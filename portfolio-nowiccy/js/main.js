/* ==========================================================================
   czuły punkt Nowiccy — main.js
   Bazowe mechanizmy wspólne dla wszystkich podstron:
   1. Menu mobilne (hamburger)
   2. Scroll reveal (animacja pojawiania się sekcji)
   3. Filtr kategorii portfolio (działa tylko, gdy strona ma .filter-bar)
   4. Lightbox galerii (działa tylko, gdy strona ma .gallery)
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

  /* ----- 3. FILTR KATEGORII PORTFOLIO ----- */
  var filterBar = document.querySelector(".filter-bar");
  var galleryItems = document.querySelectorAll(".gallery-item");
  var emptyMsg = document.querySelector(".gallery-empty");

  if (filterBar && galleryItems.length) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;

      filterBar.querySelectorAll(".filter-btn").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });

      var filter = btn.getAttribute("data-filter");
      var visible = 0;

      galleryItems.forEach(function (item) {
        var show = filter === "all" || item.getAttribute("data-cat") === filter;
        item.classList.toggle("is-hidden", !show);
        if (show) visible++;
      });

      if (emptyMsg) emptyMsg.hidden = visible > 0;
    });
  }

  /* ----- 4. LIGHTBOX GALERII ----- */
  var lightbox = document.getElementById("lightbox");
  var gallery = document.querySelector(".gallery");

  if (lightbox && gallery) {
    var stage = lightbox.querySelector(".lightbox-stage");
    var caption = lightbox.querySelector(".lightbox-caption");
    var currentIndex = -1;
    var lastFocused = null;

    // Lista aktualnie widocznych kart (uwzględnia filtr)
    function visibleItems() {
      return Array.prototype.filter.call(
        document.querySelectorAll(".gallery-item"),
        function (item) { return !item.classList.contains("is-hidden"); }
      );
    }

    function render(index) {
      var items = visibleItems();
      if (!items.length) return;
      currentIndex = (index + items.length) % items.length;
      var item = items[currentIndex];

      stage.innerHTML = "";
      var img = item.querySelector("img");
      if (img) {
        // Prawdziwe zdjęcie: pokaż pełny wariant (data-full ma pierwszeństwo przed src)
        var full = document.createElement("img");
        full.src = img.getAttribute("data-full") || img.src;
        full.alt = img.alt || "";
        stage.appendChild(full);
      } else {
        // Placeholder: sklonuj szary box do podglądu
        var ph = item.querySelector(".ph");
        if (ph) stage.appendChild(ph.cloneNode(true));
      }

      var title = item.querySelector(".work-title");
      var cat = item.querySelector(".work-cat");
      caption.textContent = (title ? title.textContent : "") + (cat ? " — " + cat.textContent : "");
    }

    function openLightbox(index) {
      lastFocused = document.activeElement;
      render(index);
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      lightbox.querySelector(".lightbox-close").focus();
    }

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    }

    gallery.addEventListener("click", function (e) {
      var trigger = e.target.closest(".gallery-trigger");
      if (!trigger) return;
      var item = trigger.closest(".gallery-item");
      var index = visibleItems().indexOf(item);
      if (index !== -1) openLightbox(index);
    });

    lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", function () { render(currentIndex - 1); });
    lightbox.querySelector(".lightbox-next").addEventListener("click", function () { render(currentIndex + 1); });

    // Klik w tło zamyka podgląd
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") render(currentIndex - 1);
      if (e.key === "ArrowRight") render(currentIndex + 1);
    });
  }
})();
