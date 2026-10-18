/* ==========================================================
   Castel Dog – script commun aux deux pages
   1. Année du pied de page
   2. Menu mobile
   3. Onglets des tarifs (index.html)
   4. Calendrier et formulaire de rendez-vous (rendez-vous.html)
   ========================================================== */

(function () {
  "use strict";

  /* ---------- 1. Année ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- 2. Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 3. Onglets des tarifs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  if (tabs.length) {
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });

    var selectTab = function (index, focus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { selectTab(i); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); selectTab(next, true); }
      });
    });
    selectTab(0);
  }

  /* ---------- 4. Rendez-vous ---------- */
  var calEl = document.getElementById("calendar");
  if (!calEl) return;

  var STORAGE_KEY = "casteldog-rdv";
  // Créneaux d'une heure, de 9 h à 17 h (fermeture à 18 h)
  var SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  var MONTHS_AHEAD = 6;
  var DOW = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

  var PRESTATIONS = {
    toilettage: "Toilettage complet", bain: "Bain et séchage", epilation: "Épilation",
    griffes: "Coupe des griffes", oreilles: "Nettoyage des oreilles",
    chiot: "Toilettage pour chiots", pension: "Pension canine"
  };

  var titleEl = document.getElementById("cal-title");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");
  var slotsEl = document.getElementById("slots");
  var summaryEl = document.getElementById("summary");
  var form = document.getElementById("rdv-form");
  var errorEl = document.getElementById("form-error");
  var confirmEl = document.getElementById("confirmation");
  var confirmText = document.getElementById("confirm-text");
  var newBtn = document.getElementById("new-rdv");

  var today = startOfDay(new Date());
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var minView = new Date(view);
  var maxView = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 1);
  var selectedDate = null; // "AAAA-MM-JJ"
  var selectedSlot = null; // "HH:MM"

  /* Utilitaires */
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function toKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(d) {
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function isClosed(d) { var g = d.getDay(); return g === 0 || g === 1; } // dimanche, lundi

  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveBooking(b) {
    var all = loadBookings();
    all.push(b);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) { /* stockage indisponible */ }
  }
  function isBooked(dateKey, slot) {
    return loadBookings().some(function (b) { return b.date === dateKey && b.slot === slot; });
  }

  /* Calendrier */
  function renderCalendar() {
    var y = view.getFullYear(), m = view.getMonth();
    titleEl.textContent = view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    prevBtn.disabled = view <= minView;
    nextBtn.disabled = view >= maxView;

    calEl.innerHTML = "";
    DOW.forEach(function (d) {
      var h = document.createElement("div");
      h.className = "cal-dow";
      h.textContent = d;
      calEl.appendChild(h);
    });

    var offset = (new Date(y, m, 1).getDay() + 6) % 7; // semaine qui commence le lundi
    for (var i = 0; i < offset; i++) {
      var blank = document.createElement("span");
      blank.className = "cal-empty";
      calEl.appendChild(blank);
    }

    var daysInMonth = new Date(y, m + 1, 0).getDate();
    for (var day = 1; day <= daysInMonth; day++) {
      var date = new Date(y, m, day);
      var key = toKey(date);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      btn.textContent = day;
      btn.setAttribute("aria-label", longDate(date));
      btn.dataset.date = key;

      var closed = isClosed(date);
      var past = date < today;
      var full = !closed && !past && allSlotsUnavailable(date);

      if (closed) btn.classList.add("is-closed");
      if (+date === +today) btn.classList.add("is-today");
      if (closed || past || full) {
        btn.disabled = true;
        if (closed) btn.setAttribute("aria-label", longDate(date) + ", fermé");
        if (full) btn.setAttribute("aria-label", longDate(date) + ", complet");
      }
      btn.setAttribute("aria-pressed", String(key === selectedDate));
      calEl.appendChild(btn);
    }
  }

  function slotUnavailable(date, slot) {
    var key = toKey(date);
    if (isBooked(key, slot)) return true;
    if (+startOfDay(date) === +today) { // aujourd'hui : on ne propose que les heures à venir
      var h = parseInt(slot.slice(0, 2), 10);
      if (h <= new Date().getHours()) return true;
    }
    return false;
  }
  function allSlotsUnavailable(date) {
    return SLOTS.every(function (s) { return slotUnavailable(date, s); });
  }

  /* Créneaux */
  function renderSlots() {
    slotsEl.innerHTML = "";
    if (!selectedDate) {
      slotsEl.innerHTML = '<p class="empty">Sélectionnez d’abord un jour dans le calendrier.</p>';
      return;
    }
    var date = fromKey(selectedDate);
    SLOTS.forEach(function (slot) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot";
      b.textContent = slot.replace(":", " h ").replace(" h 00", " h");
      b.dataset.slot = slot;
      b.disabled = slotUnavailable(date, slot);
      b.setAttribute("aria-pressed", String(slot === selectedSlot));
      slotsEl.appendChild(b);
    });
  }

  function renderSummary() {
    if (selectedDate && selectedSlot) {
      summaryEl.textContent = capitalize(longDate(fromKey(selectedDate))) + " à " + selectedSlot.replace(":", " h ").replace(" h 00", " h");
      summaryEl.classList.add("is-set");
    } else if (selectedDate) {
      summaryEl.textContent = capitalize(longDate(fromKey(selectedDate))) + ". Choisissez maintenant un créneau.";
      summaryEl.classList.remove("is-set");
    } else {
      summaryEl.textContent = "Aucun créneau choisi pour l’instant.";
      summaryEl.classList.remove("is-set");
    }
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Événements */
  prevBtn.addEventListener("click", function () {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    renderCalendar();
  });
  nextBtn.addEventListener("click", function () {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    renderCalendar();
  });

  calEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".cal-day");
    if (!btn || btn.disabled) return;
    selectedDate = btn.dataset.date;
    selectedSlot = null;
    renderCalendar();
    renderSlots();
    renderSummary();
    clearError();
  });

  slotsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".slot");
    if (!btn || btn.disabled) return;
    selectedSlot = btn.dataset.slot;
    renderSlots();
    renderSummary();
    clearError();
  });

  /* Formulaire */
  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; }
  function clearError() { errorEl.hidden = true; errorEl.textContent = ""; }

  function validate() {
    var ok = true, firstBad = null;
    ["prestation", "chien", "taille", "nom", "tel"].forEach(function (id) {
      var el = document.getElementById(id);
      var value = el.value.trim();
      var bad = !value;
      if (id === "tel" && value) bad = value.replace(/[\s.\-+()]/g, "").length < 9 || /[^\d\s.\-+()]/.test(value);
      el.closest(".field").classList.toggle("has-error", bad);
      el.setAttribute("aria-invalid", String(bad));
      if (bad) { ok = false; if (!firstBad) firstBad = el; }
    });
    return { ok: ok, firstBad: firstBad };
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    if (!selectedDate || !selectedSlot) {
      showError("Choisissez un jour et un créneau avant d’envoyer votre demande.");
      return;
    }
    var v = validate();
    if (!v.ok) {
      showError("Merci de compléter les champs en rouge (le numéro de téléphone doit être valide).");
      v.firstBad.focus();
      return;
    }

    var data = {
      date: selectedDate,
      slot: selectedSlot,
      prestation: form.prestation.value,
      chien: form.chien.value.trim(),
      taille: form.taille.value,
      nom: form.nom.value.trim(),
      tel: form.tel.value.trim(),
      message: form.message.value.trim(),
      createdAt: new Date().toISOString()
    };

    /* ------------------------------------------------------------
       ENVOI RÉEL : ce site n'a pas de serveur. Pour recevoir les
       demandes par e-mail, remplacez le bloc ci-dessous par un appel
       vers un service de formulaire (Formspree, Web3Forms…) ou votre
       propre API, par exemple :
         fetch("https://formspree.io/f/XXXXXXXX", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(data)
         });
       ------------------------------------------------------------ */
    saveBooking(data);

    confirmText.textContent =
      data.chien + " est attendu le " + longDate(fromKey(data.date)) + " à " +
      data.slot.replace(":", " h ").replace(" h 00", " h") + " pour : " + PRESTATIONS[data.prestation].toLowerCase() + ".";
    form.hidden = true;
    summaryEl.hidden = true;
    confirmEl.hidden = false;
    confirmEl.focus();

    selectedSlot = null;
    renderCalendar();
    renderSlots();
  });

  newBtn.addEventListener("click", function () {
    form.reset();
    form.hidden = false;
    summaryEl.hidden = false;
    confirmEl.hidden = true;
    selectedDate = null;
    selectedSlot = null;
    renderCalendar();
    renderSlots();
    renderSummary();
  });

  /* Pré-sélection depuis un lien (rendez-vous.html?prestation=pension) */
  var params = new URLSearchParams(window.location.search);
  var pre = params.get("prestation");
  if (pre && PRESTATIONS[pre]) form.prestation.value = pre;

  renderCalendar();
  renderSlots();
  renderSummary();
})();
