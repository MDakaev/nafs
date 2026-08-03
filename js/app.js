/**
 * Nafs app runtime.
 * Depends on:
 * - js/config.js
 * - js/analytics.js
 * - js/i18n.js
 * - js/motivations.js
 */
(() => {
  "use strict";

  // Local persistence key. Bump only when the stored shape changes incompatibly.
  const STORAGE = "nafs.merged.v1";

  const $ = (id) => document.getElementById(id);
  const t = (key) => window.NAFS_t(key, state.lang);
  const analytics = () => window.NAFS_analytics || { track() {}, params() {}, enabled: false };

  /** Motivations for the active language. */
  function motivations() {
    return window.NAFS_MOTIVATIONS[state.lang] || window.NAFS_MOTIVATIONS.ru;
  }

  /** YYYY-MM-DD key used for daily counters. */
  const dayKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const defaults = {
    days: {},
    last: null,
    settings: { haptic: true },
    theme: "light",
    lang: "ru",
    motivation: 0,
    resetPeriod: "day",
  };

  let state;
  try {
    state = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE) || "{}") };
  } catch {
    state = structuredClone(defaults);
  }
  state.settings = { ...defaults.settings, ...(state.settings || {}) };
  state.lang = state.lang === "en" ? "en" : "ru";
  if (!Number.isInteger(state.motivation)) {
    state.motivation = Math.floor(Math.random() * motivations().length);
  }

  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function today() {
    const key = dayKey();
    state.days[key] ||= { me: 0, nafs: 0 };
    return state.days[key];
  }

  /** Russian/English-ish plural helper for mark counts. */
  function pluralMarks(n) {
    if (state.lang === "en") return n === 1 ? t("mark1") : t("marks");
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return t("mark1");
    if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return t("mark2");
    return t("marks");
  }

  function showToast(text) {
    const toast = $("toast");
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1300);
  }

  /** Apply static translated strings marked with data-i18n. */
  function applyStaticI18n() {
    document.documentElement.lang = state.lang;
    document.title = t("appTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
    document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.langChoice === state.lang);
    });
  }

  function renderSpeech(animate = false) {
    const list = motivations();
    const [title, body] = list[state.motivation % list.length];
    if (animate) {
      $("speechTitle").style.animation = "none";
      $("speechBody").style.animation = "none";
      void $("speechTitle").offsetWidth;
      $("speechTitle").style.animation = "";
      $("speechBody").style.animation = "";
    }
    $("speechTitle").textContent = title;
    $("speechBody").textContent = body;
    $("drawerQuote").textContent = `${title} ${body}`;
  }

  function nextSpeech() {
    const list = motivations();
    let next;
    do {
      next = Math.floor(Math.random() * list.length);
    } while (next === state.motivation && list.length > 1);
    state.motivation = next;
    save();
    renderSpeech(true);
  }

  /**
   * Home scorecard.
   * Card color shifts from near-black (nafs lead) to green (user lead).
   */
  function renderHome() {
    const { me, nafs } = today();
    const total = me + nafs;
    const diff = me - nafs;
    const advantage = total ? diff / total : 0;
    const greenShare = (advantage + 1) / 2;
    const mix = (from, to, amount) =>
      from.map((value, index) => Math.round(value + (to[index] - value) * amount));
    const start = mix([5, 6, 5], [28, 100, 63], greenShare);
    const end = mix([13, 14, 13], [58, 139, 91], greenShare);

    $("meCount").textContent = me;
    $("nafsCount").textContent = nafs;
    $("delta").textContent = Math.abs(diff);
    $("deltaCaption").textContent =
      diff === 0 ? t("captionEven") : diff > 0 ? t("captionMe") : t("captionNafs");
    $("cardStatus").textContent =
      total === 0
        ? t("statusQuiet")
        : diff > 0
          ? t("statusAhead")
          : diff < 0
            ? t("statusRecover")
            : t("statusEven");
    $("balanceFill").style.width = `${total ? (me / total) * 100 : 50}%`;
    $("balanceCard").style.background =
      `linear-gradient(145deg,rgb(${start.join(",")}),rgb(${end.join(",")}))`;
  }

  function mark(side) {
    const key = dayKey();
    const current = today();
    current[side] += 1;
    state.last = { key, side };
    save();
    renderHome();
    $("delta").classList.remove("pop");
    void $("delta").offsetWidth;
    $("delta").classList.add("pop");
    if (state.settings.haptic) navigator.vibrate?.(12);
    showToast(side === "me" ? t("toastMe") : t("toastNafs"));
    analytics().track(side === "me" ? "mark_me" : "mark_nafs", { side });
    nextSpeech();
  }

  function undo() {
    if (!state.last) return showToast(t("toastUndoEmpty"));
    const { key, side } = state.last;
    if (state.days[key]?.[side] > 0) state.days[key][side] -= 1;
    state.last = null;
    save();
    renderHome();
    showToast(t("toastUndo"));
  }

  function valuesForDate(date) {
    // Honest history only: missing days stay at zero.
    return state.days[dayKey(date)] || { me: 0, nafs: 0 };
  }

  function buildHistory(period) {
    const now = new Date();
    const weekNames = t("week");
    const monthNames = t("months");

    if (period === "day") {
      const val = valuesForDate(now);
      return {
        title: t("todayTitle"),
        caption: t("chartToday"),
        groups: [{ label: t("todayLabel"), ...val }],
      };
    }

    if (period === "week") {
      const groups = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        groups.push({ label: weekNames[d.getDay()], ...valuesForDate(d) });
      }
      return { title: t("weekTitle"), caption: t("chartWeek"), groups };
    }

    if (period === "month") {
      const groups = [];
      for (let start = 27; start >= 0; start -= 7) {
        let me = 0;
        let nafs = 0;
        for (let j = 0; j < 7; j += 1) {
          const d = new Date(now);
          d.setDate(now.getDate() - (start - j));
          const v = valuesForDate(d);
          me += v.me;
          nafs += v.nafs;
        }
        groups.push({
          label: `${Math.max(1, now.getDate() - start)}–${Math.max(1, now.getDate() - start + 6)}`,
          me,
          nafs,
        });
      }
      return { title: t("monthTitle"), caption: t("chartMonth"), groups };
    }

    const groups = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      let me = 0;
      let nafs = 0;
      for (let i = 1; i <= days; i += 1) {
        const d = new Date(month.getFullYear(), month.getMonth(), i);
        if (d > now) break;
        const v = valuesForDate(d);
        me += v.me;
        nafs += v.nafs;
      }
      groups.push({ label: monthNames[month.getMonth()], me, nafs });
    }
    return { title: t("yearTitle"), caption: t("chartYear"), groups };
  }

  function renderHistory(period = "day") {
    const data = buildHistory(period);
    const totalMe = data.groups.reduce((sum, v) => sum + v.me, 0);
    const totalNafs = data.groups.reduce((sum, v) => sum + v.nafs, 0);
    const total = totalMe + totalNafs;
    const delta = totalMe - totalNafs;
    const max = Math.max(1, ...data.groups.flatMap((v) => [v.me, v.nafs]));

    $("historyTitle").textContent = data.title;
    $("chartCaption").textContent = data.caption;
    $("chartTotal").textContent = `${total} ${pluralMarks(total)}`;
    $("sumMe").textContent = totalMe;
    $("sumNafs").textContent = totalNafs;
    $("sumDelta").textContent = delta > 0 ? `+${delta}` : String(delta);
    $("sumDelta").style.color = delta > 0 ? "var(--green)" : "var(--muted)";
    $("historyNote").textContent =
      total === 0
        ? t("historyEmpty")
        : delta > 0
          ? t("historyAhead")
          : delta < 0
            ? t("historyBehind")
            : t("historyEven");
    $("chart").innerHTML = data.groups
      .map(
        (group) => `
        <div class="chart-group">
          <div class="bars">
            <i class="bar me" style="height:${Math.max(2, (group.me / max) * 100)}%"></i>
            <i class="bar nafs" style="height:${Math.max(2, (group.nafs / max) * 100)}%"></i>
          </div>
          <span class="chart-label">${group.label}</span>
        </div>`
      )
      .join("");
  }

  function openPage(name) {
    document.querySelectorAll(".page").forEach((p) => {
      p.classList.toggle("active", p.id === `${name}Page`);
    });
    if (name === "history") {
      renderHistory(document.querySelector(".period.active").dataset.period);
    }
  }

  function openMenu() {
    $("drawer").classList.add("open");
    $("scrim").classList.add("open");
  }

  function closeLayers() {
    $("drawer").classList.remove("open");
    document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("open"));
    $("scrim").classList.remove("open");
  }

  function openSheet(id) {
    $("drawer").classList.remove("open");
    $(id).classList.add("open");
    $("scrim").classList.add("open");
  }

  function applyTheme(choice) {
    state.theme = choice;
    const actual =
      choice === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : choice;
    document.documentElement.dataset.theme = actual;
    document.querySelectorAll("[data-theme-choice]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.themeChoice === choice);
    });
    $("themeMenuCaption").textContent =
      choice === "dark" ? t("themeDark") : choice === "system" ? t("themeSystem") : t("themeLight");
    document.querySelector('meta[name="theme-color"]').content =
      actual === "dark" ? "#101713" : "#e8e5d9";
    save();
    analytics().track("theme_change", { theme: choice, actual });
  }

  function setLanguage(lang) {
    state.lang = lang === "en" ? "en" : "ru";
    save();
    analytics().track("language_change", { lang: state.lang });
    analytics().params({ lang: state.lang });
    refreshAll();
  }

  /** Clear marks for a fixed period: day / week / month / all. */
  function clearMarks(period) {
    const now = new Date();
    if (period === "all") {
      state.days = {};
      state.last = null;
      return "toastReset";
    }

    const keep = {};
    Object.entries(state.days).forEach(([key, value]) => {
      const [y, m, d] = key.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      let remove = false;
      if (period === "day") {
        remove = key === dayKey(now);
      } else if (period === "week") {
        const oldest = new Date(now);
        oldest.setHours(0, 0, 0, 0);
        oldest.setDate(now.getDate() - 6);
        remove = date >= oldest && date <= now;
      } else if (period === "month") {
        remove = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }
      if (!remove) keep[key] = value;
    });
    state.days = keep;
    if (state.last && !state.days[state.last.key]) state.last = null;
    return period === "day"
      ? "toastResetDay"
      : period === "week"
        ? "toastResetWeek"
        : "toastResetMonth";
  }

  function openDonation(kind) {
    const url = window.NAFS_CONFIG?.donations?.[kind];
    if (!url) {
      showToast(t("toastDonateMissing"));
      return;
    }
    analytics().track("donate_click", { method: kind });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // --- PWA install helpers ---
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  let deferredPrompt = null;

  function renderInstallCopy() {
    const steps = $("installSteps");
    const primary = $("installPrimary");
    if (isStandalone) {
      $("installLead").textContent = t("installAlready");
      steps.innerHTML = `<div><b>${t("installReadyTitle")}</b>${t("installReadyBody")}</div>`;
      primary.hidden = true;
      $("installMenuCaption").textContent = t("menuInstalled");
      $("installBanner").classList.remove("show");
      return;
    }
    primary.hidden = false;
    if (isIos) {
      $("installLead").textContent = t("installIosLead");
      steps.innerHTML = `
        <div><b>${t("installIos1Title")}</b>${t("installIos1Body")}</div>
        <div><b>${t("installIos2Title")}</b>${t("installIos2Body")}</div>
        <div><b>${t("installIos3Title")}</b>${t("installIos3Body")}</div>`;
      primary.textContent = t("gotIt");
      primary.onclick = () => {
        closeLayers();
        showToast(t("toastInstallHint"));
      };
    } else if (deferredPrompt) {
      $("installLead").textContent = t("installLead");
      steps.innerHTML = `<div><b>${t("installOneTitle")}</b>${t("installOneBody")}</div>`;
      primary.textContent = t("install");
      primary.onclick = async () => {
        analytics().track("install_click", { source: "sheet" });
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        closeLayers();
        showToast(result.outcome === "accepted" ? t("toastAdding") : t("toastLater"));
        analytics().track("install_prompt_result", { outcome: result.outcome });
        updateInstallVisibility();
      };
    } else {
      $("installLead").textContent = t("installLead");
      steps.innerHTML = `<div><b>${t("installMenuTitle")}</b>${
        isAndroid ? t("installAndroidBody") : t("installOtherBody")
      }</div>`;
      primary.textContent = t("gotIt");
      primary.onclick = () => closeLayers();
    }
  }

  function updateInstallVisibility() {
    renderInstallCopy();
    const dismissed = localStorage.getItem("nafs.install.dismissed") === "1";
    const showBanner =
      !isStandalone && !dismissed && (Boolean(deferredPrompt) || isIos || isAndroid);
    $("installBanner").classList.toggle("show", showBanner);
  }

  function refreshAll() {
    applyStaticI18n();
    applyTheme(state.theme);
    renderSpeech();
    renderHome();
    renderHistory(document.querySelector(".period.active")?.dataset.period || "day");
    updateInstallVisibility();
    document.querySelectorAll("[data-reset-period]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.resetPeriod === (state.resetPeriod || "day"));
    });
    const now = new Date();
    const monthNames = t("months");
    const weekNames = t("week");
    $("todayLabel").innerHTML =
      `${now.getDate()} ${monthNames[now.getMonth()]}<br>${weekNames[now.getDay()]}`;
  }

  // --- Events ---
  document.querySelectorAll("[data-mark]").forEach((b) => {
    b.addEventListener("click", () => mark(b.dataset.mark));
  });
  document.querySelectorAll(".period").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".period").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderHistory(b.dataset.period);
    });
  });
  document.querySelectorAll("[data-menu]").forEach((b) => {
    b.addEventListener("click", () => {
      const action = b.dataset.menu;
      if (action === "history") {
        closeLayers();
        openPage("history");
      } else {
        openSheet(`${action}Sheet`);
      }
    });
  });
  document.querySelectorAll("[data-donate]").forEach((b) => {
    b.addEventListener("click", () => openDonation(b.dataset.donate));
  });
  document.querySelectorAll("[data-setting]").forEach((b) => {
    b.addEventListener("click", () => {
      const key = b.dataset.setting;
      state.settings[key] = !state.settings[key];
      b.classList.toggle("on", state.settings[key]);
      save();
    });
  });
  document.querySelectorAll("[data-theme-choice]").forEach((b) => {
    b.addEventListener("click", () => applyTheme(b.dataset.themeChoice));
  });
  document.querySelectorAll("[data-lang-choice]").forEach((b) => {
    b.addEventListener("click", () => setLanguage(b.dataset.langChoice));
  });
  $("openMenu").addEventListener("click", openMenu);
  $("closeMenu").addEventListener("click", closeLayers);
  $("scrim").addEventListener("click", closeLayers);
  $("backHome").addEventListener("click", () => openPage("home"));
  $("speech").addEventListener("click", nextSpeech);
  $("undo").addEventListener("click", undo);
  document.querySelectorAll("[data-reset-period]").forEach((b) => {
    b.addEventListener("click", () => {
      state.resetPeriod = b.dataset.resetPeriod;
      document.querySelectorAll("[data-reset-period]").forEach((x) => {
        x.classList.toggle("selected", x.dataset.resetPeriod === state.resetPeriod);
      });
      save();
    });
  });
  $("resetData").addEventListener("click", () => {
    const period = state.resetPeriod || "day";
    const toastKey = clearMarks(period);
    save();
    renderHome();
    if (document.querySelector("#historyPage")?.classList.contains("active")) {
      renderHistory(document.querySelector(".period.active")?.dataset.period || "day");
    }
    closeLayers();
    showToast(t(toastKey));
    analytics().track("reset_marks", { period });
  });
  $("installBannerBtn").addEventListener("click", () => {
    analytics().track("install_click", { source: "banner" });
    openSheet("installSheet");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    analytics().track("install_prompt_available");
    updateInstallVisibility();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    showToast(t("toastInstalled"));
    analytics().track("app_installed");
    updateInstallVisibility();
  });

  if ("serviceWorker" in navigator) {
    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NAFS_SW_UPDATED") reloadOnce();
    });
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // Sync toggles with stored settings on boot.
  document.querySelectorAll("[data-setting]").forEach((b) => {
    b.classList.toggle("on", Boolean(state.settings[b.dataset.setting]));
  });

  refreshAll();
})();
