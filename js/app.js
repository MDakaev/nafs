/**
 * Nafs app runtime.
 * Depends on:
 * - js/config.js
 * - js/analytics.js
 * - js/i18n.js
 * - js/motivations.js
 * - js/tree.js
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
    treeFocus: false,
  };

  let state;
  try {
    state = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE) || "{}") };
  } catch {
    state = structuredClone(defaults);
  }
  state.settings = { ...defaults.settings, ...(state.settings || {}) };
  state.lang = state.lang === "en" ? "en" : "ru";
  // Never restore tree-focus across reloads — it can leave the home grid collapsed.
  state.treeFocus = false;
  let treeDebugOverride = false;
  if (!Number.isInteger(state.motivation)) {
    state.motivation = Math.floor(Math.random() * motivations().length);
  }

  /** Localhost-only: seed history so tree stages can be previewed via ?demoTree=1 */
  function maybeSeedDemoTree() {
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    if (!local || !new URLSearchParams(location.search).has("demoTree")) return;
    if (Object.keys(state.days || {}).length) return;
    const now = new Date();
    const days = {};
    for (let i = 45; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = dayKey(date);
      days[key] = {
        me: 1 + ((i * 3) % 5),
        nafs: 1 + ((i * 2) % 4),
      };
    }
    state.days = days;
    save();
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

  /**
   * @param {string} title
   * @param {string} [body]
   * @param {number} [ms]
   */
  function showToast(title, body, ms = 1300) {
    const toast = $("toast");
    toast.replaceChildren();
    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = title;
    toast.appendChild(titleEl);
    if (body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "toast-body";
      bodyEl.textContent = body;
      toast.appendChild(bodyEl);
    }
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), ms);
  }

  function markDhikr() {
    return window.NAFS_MARK_DHIKR[state.lang] || window.NAFS_MARK_DHIKR.ru;
  }

  function showMarkDhikr(side) {
    const pack = markDhikr();
    if (side === "me") {
      const options = pack.iman;
      renderSpeechItem(options[Math.floor(Math.random() * options.length)], true, {
        dhikr: true,
      });
    } else {
      renderSpeechItem(pack.nafs, true, { dhikr: true });
    }
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

  function renderSpeechItem(item, animate = false, opts = {}) {
    const title = item[0] || "";
    const body = item[1] || "";
    const speech = $("speech");
    speech.classList.toggle("is-dhikr", Boolean(opts.dhikr));
    speech.classList.toggle("is-empty-body", !body);
    if (animate) {
      $("speechTitle").style.animation = "none";
      $("speechBody").style.animation = "none";
      void $("speechTitle").offsetWidth;
      $("speechTitle").style.animation = "";
      $("speechBody").style.animation = "";
    }
    $("speechTitle").textContent = title;
    $("speechBody").textContent = body;
    $("drawerQuote").textContent = body ? `${title} ${body}` : title;
  }

  function renderSpeech(animate = false) {
    const list = motivations();
    renderSpeechItem(list[state.motivation % list.length], animate, { dhikr: false });
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

  const healthCaption = {
    living: "treeHealthLiving",
    mostly: "treeHealthMostly",
    mixed: "treeHealthMixed",
    withered: "treeHealthWithered",
    rotten: "treeHealthRotten",
    dormant: "treeHealthDormant",
  };

  function renderTree({ resize = false } = {}) {
    const tree = window.NAFS_tree?.compute(state.days) || {
      stage: 0,
      stageKey: "treeStageSoil",
      vitality: 0.5,
      poison: 0,
      health: "dormant",
      total: 0,
      progress: 0.01,
      seed: 12345,
    };
    const stageEl = $("treeStage");
    if (!stageEl) return;
    stageEl.dataset.stage = String(tree.stage);
    stageEl.dataset.health = tree.health;
    stageEl.style.setProperty("--tree-vitality", String(tree.vitality));
    stageEl.style.setProperty("--tree-poison", String(tree.poison));
    if (!treeDebugOverride) {
      window.NAFS_tree?.paint?.(tree);
    }
    $("treeCaption").textContent =
      `${t(tree.stageKey)} · ${t(healthCaption[tree.health] || "treeHealthDormant")}`;
    stageEl.setAttribute("aria-expanded", state.treeFocus ? "true" : "false");
    stageEl.setAttribute("aria-label", state.treeFocus ? t("treeClose") : t("treeOpen"));
    const home = $("homePage");
    if (home && !home.classList.contains("rows-animating")) {
      home.classList.toggle("tree-focus", state.treeFocus);
    }
    if (resize) {
      const growing = window.NAFS_tree?.getGrowing?.();
      requestAnimationFrame(() => growing?.resize?.());
    }
  }

  /** Snapshot of compact home rows — used to reverse the focus animation. */
  let compactHomeRows = null;
  let treeFocusAnim = 0;

  function readHomeRowHeights() {
    return {
      upper: Math.round($("homeUpper").getBoundingClientRect().height),
      tree: Math.round($("treeStage").getBoundingClientRect().height),
      lower: Math.round($("homeLower").getBoundingClientRect().height),
    };
  }

  function setHomePixelRows(rows) {
    $("homePage").style.gridTemplateRows =
      `${rows.upper}px ${rows.tree}px ${rows.lower}px`;
  }

  function clearHomePixelRows() {
    $("homePage").style.gridTemplateRows = "";
  }

  /** Resolve CSS `--tree-h` to pixels (handles clamp() via probe element). */
  function readCssTreeHeight() {
    const page = $("homePage");
    if (!page) return 130;
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;height:var(--tree-h)";
    page.appendChild(probe);
    const height = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return height > 0 ? height : 130;
  }

  function cancelTreeFocusAnimation() {
    const page = $("homePage");
    treeFocusAnim += 1;
    clearTimeout(toggleTreeFocus.timer);
    if (!page) return;
    page.classList.remove("rows-animating");
    clearHomePixelRows();
    page.classList.toggle("tree-focus", state.treeFocus);
    compactHomeRows = null;
  }

  function pulseTreeResize(durationMs) {
    // GrowingTree._tick already resizes when the parent size changes each frame.
    // One forced resize at the end is enough to settle after the CSS transition.
    const growing = window.NAFS_tree?.getGrowing?.();
    if (!growing) return;
    const id = ++treeFocusAnim;
    clearTimeout(pulseTreeResize.timer);
    pulseTreeResize.timer = setTimeout(() => {
      if (id !== treeFocusAnim) return;
      growing.resize(true);
    }, durationMs);
  }

  /** Smooth mini → full tree: animate pixel grid rows + continuous canvas fit. */
  function toggleTreeFocus({ force = false } = {}) {
    const page = $("homePage");
    if (!page) return;
    if (page.classList.contains("rows-animating")) {
      if (!force) return;
      cancelTreeFocusAnimation();
    }

    const opening = !state.treeFocus;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : 1100;

    // Freeze current layout to concrete pixels (fr/auto can't interpolate).
    const from = readHomeRowHeights();
    if (!reduceMotion) {
      page.classList.add("rows-animating");
      setHomePixelRows(from);
      void page.offsetHeight;
    }

    state.treeFocus = opening;
    save();

    // Sync chrome (caption/aria) without fighting the row animation.
    const stageEl = $("treeStage");
    if (stageEl) {
      stageEl.setAttribute("aria-expanded", opening ? "true" : "false");
      stageEl.setAttribute("aria-label", opening ? t("treeClose") : t("treeOpen"));
    }
    page.classList.toggle("tree-focus", opening);

    if (reduceMotion) {
      clearHomePixelRows();
      compactHomeRows = null;
      window.NAFS_tree?.getGrowing?.()?.resize?.(true);
      if (!treeDebugOverride) renderTree();
      analytics().track(opening ? "tree_open" : "tree_close");
      return;
    }

    const to = opening
      ? {
          upper: 0,
          tree: from.upper + from.tree + from.lower,
          lower: 0,
        }
      : compactHomeRows || {
          upper: Math.max(120, from.tree * 0.55),
          tree: readCssTreeHeight(),
          lower: Math.max(220, from.tree * 0.9),
        };

    if (opening) compactHomeRows = from;

    // Double rAF so the browser commits the "from" rows before transitioning.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHomePixelRows(to);
        pulseTreeResize(duration);
        if (state.settings.haptic) navigator.vibrate?.(10);
        analytics().track(opening ? "tree_open" : "tree_close");

        clearTimeout(toggleTreeFocus.timer);
        toggleTreeFocus.timer = setTimeout(() => {
          page.classList.remove("rows-animating");
          clearHomePixelRows();
          window.NAFS_tree?.getGrowing?.()?.resize?.(true);
          if (!treeDebugOverride) renderTree();
        }, duration + 48);
      });
    });
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
    const card = $("balanceCard");
    card.style.setProperty("--balance-start", `rgb(${start.join(",")})`);
    card.style.setProperty("--balance-end", `rgb(${end.join(",")})`);
    renderTree();
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
    showMarkDhikr(side);
    analytics().track(side === "me" ? "mark_me" : "mark_nafs", { side });
  }

  function undo() {
    if (!state.last) return showToast(t("toastUndoEmpty"));
    const { key, side } = state.last;
    if (state.days[key]?.[side] > 0) state.days[key][side] -= 1;
    state.last = null;
    save();
    renderHome();
    renderSpeech();
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
        let firstDay = null;
        let lastDay = null;
        for (let j = 0; j < 7; j += 1) {
          const d = new Date(now);
          d.setDate(now.getDate() - (start - j));
          if (!firstDay) firstDay = d;
          lastDay = d;
          const v = valuesForDate(d);
          me += v.me;
          nafs += v.nafs;
        }
        groups.push({
          label: `${firstDay.getDate()}–${lastDay.getDate()}`,
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
    const chart = $("chart");
    chart.dataset.period = period;
    chart.innerHTML = data.groups
      .map((group) => {
        const label =
          period === "year" && group.label.length > 3
            ? group.label.slice(0, 3)
            : group.label;
        return `
        <div class="chart-group">
          <div class="bars">
            <i class="bar me" style="height:${Math.max(2, (group.me / max) * 100)}%"></i>
            <i class="bar nafs" style="height:${Math.max(2, (group.nafs / max) * 100)}%"></i>
          </div>
          <span class="chart-label">${label}</span>
        </div>`;
      })
      .join("");
  }

  function openPage(name) {
    if (name !== "home" && state.treeFocus) {
      state.treeFocus = false;
      cancelTreeFocusAnimation();
      renderTree();
    }
    document.querySelectorAll(".page").forEach((p) => {
      p.classList.toggle("active", p.id === `${name}Page`);
    });
    if (name === "history") {
      const activePeriod = document.querySelector(".period.active");
      renderHistory(activePeriod?.dataset.period || "day");
    }
    if (name === "home") {
      window.NAFS_tree?.getGrowing?.()?.resume?.();
    }
  }

  function syncLayerA11y() {
    const drawer = $("drawer");
    const scrim = $("scrim");
    const drawerOpen = drawer.classList.contains("open");
    const sheetOpen = [...document.querySelectorAll(".sheet")].some((s) =>
      s.classList.contains("open")
    );
    drawer.inert = !drawerOpen;
    document.querySelectorAll(".sheet").forEach((sheet) => {
      sheet.inert = !sheet.classList.contains("open");
    });
    if (scrim) scrim.inert = !(drawerOpen || sheetOpen);
  }

  function openMenu() {
    $("drawer").classList.add("open");
    $("scrim").classList.add("open");
    syncLayerA11y();
  }

  function closeLayers() {
    $("drawer").classList.remove("open");
    document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("open"));
    $("scrim").classList.remove("open");
    syncLayerA11y();
  }

  function openSheet(id) {
    $("drawer").classList.remove("open");
    $(id).classList.add("open");
    $("scrim").classList.add("open");
    syncLayerA11y();
  }

  const GUIDE_SEEN_KEY = "nafs.guide.seen";
  const GUIDE_PAD = 10;
  const GUIDE_STEPS = [
    { target: "#speech", titleKey: "guide1Title", bodyKey: "guide1Body", radius: 18 },
    { target: ".actions", titleKey: "guide2Title", bodyKey: "guide2Body", radius: 18 },
    { target: "#balanceCard", titleKey: "guide3Title", bodyKey: "guide3Body", radius: 20 },
    { target: "#treeStage", titleKey: "guide4Title", bodyKey: "guide4Body", radius: 22 },
    { target: "#openMenu", titleKey: "guide5Title", bodyKey: "guide5Body", radius: 14 },
    { target: null, titleKey: "guide6Title", bodyKey: "guide6Body" },
  ];

  let guideStep = -1;
  let guideActive = false;

  function isGuideSeen() {
    return localStorage.getItem(GUIDE_SEEN_KEY) === "1";
  }

  function markGuideSeen() {
    localStorage.setItem(GUIDE_SEEN_KEY, "1");
  }

  function exitTreeFocusIfNeeded() {
    if (!state.treeFocus) return;
    state.treeFocus = false;
    cancelTreeFocusAnimation();
    renderTree();
  }

  function positionGuideStep() {
    const overlay = $("guideOverlay");
    const hole = $("guideHole");
    const card = $("guideCard");
    if (!overlay || !hole || !card || guideStep < 0) return;

    const step = GUIDE_STEPS[guideStep];
    const shell = $("app");
    const shellRect = shell.getBoundingClientRect();

    $("guideProgress").textContent = `${guideStep + 1} / ${GUIDE_STEPS.length}`;
    $("guideTitle").textContent = t(step.titleKey);
    $("guideBody").textContent = t(step.bodyKey);
    const isLast = guideStep === GUIDE_STEPS.length - 1;
    $("guideNext").textContent = t(isLast ? "guideDone" : "guideNext");
    $("guideSkip").hidden = isLast;

    let holeRect = null;
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        const rect = el.getBoundingClientRect();
        holeRect = {
          top: rect.top - shellRect.top - GUIDE_PAD,
          left: rect.left - shellRect.left - GUIDE_PAD,
          width: rect.width + GUIDE_PAD * 2,
          height: rect.height + GUIDE_PAD * 2,
          radius: step.radius ?? 16,
        };
      }
    }

    if (holeRect) {
      hole.classList.remove("is-hidden");
      hole.style.top = `${Math.max(0, holeRect.top)}px`;
      hole.style.left = `${Math.max(0, holeRect.left)}px`;
      hole.style.width = `${holeRect.width}px`;
      hole.style.height = `${holeRect.height}px`;
      hole.style.borderRadius = `${holeRect.radius}px`;
    } else {
      // Zero-size hole keeps the full-screen dim via box-shadow.
      hole.classList.add("is-hidden");
      hole.style.top = "50%";
      hole.style.left = "50%";
      hole.style.width = "0";
      hole.style.height = "0";
      hole.style.borderRadius = "0";
    }

    card.style.top = "";
    card.style.bottom = "";
    const cardHeight = card.offsetHeight || 180;
    const shellH = shellRect.height;
    const gap = 14;
    const safeTop = 16;
    const safeBottom = 16;

    if (holeRect) {
      const spaceBelow = shellH - (holeRect.top + holeRect.height) - gap - safeBottom;
      const spaceAbove = holeRect.top - gap - safeTop;
      if (spaceBelow >= cardHeight + 8 || spaceBelow >= spaceAbove) {
        const top = Math.min(holeRect.top + holeRect.height + gap, shellH - cardHeight - safeBottom);
        card.style.top = `${Math.max(safeTop, top)}px`;
      } else {
        const bottom = Math.max(safeBottom, shellH - holeRect.top + gap);
        card.style.bottom = `${bottom}px`;
      }
    } else {
      card.style.top = `${Math.max(safeTop, (shellH - cardHeight) / 2)}px`;
    }
  }

  function endGuide() {
    if (!guideActive) return;
    guideActive = false;
    guideStep = -1;
    markGuideSeen();
    const overlay = $("guideOverlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }
    window.removeEventListener("resize", positionGuideStep);
    window.removeEventListener("orientationchange", positionGuideStep);
  }

  function showGuideStep(index) {
    if (index < 0 || index >= GUIDE_STEPS.length) {
      endGuide();
      return;
    }
    guideStep = index;
    requestAnimationFrame(() => {
      positionGuideStep();
      requestAnimationFrame(positionGuideStep);
    });
  }

  function startGuide() {
    if (guideActive) return;
    closeLayers();
    exitTreeFocusIfNeeded();
    openPage("home");

    const overlay = $("guideOverlay");
    if (!overlay) return;
    guideActive = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    window.addEventListener("resize", positionGuideStep);
    window.addEventListener("orientationchange", positionGuideStep);
    showGuideStep(0);
    $("guideNext")?.focus?.();
    analytics().track("guide_start");
  }

  function advanceGuide() {
    if (!guideActive) return;
    if (guideStep >= GUIDE_STEPS.length - 1) {
      analytics().track("guide_complete");
      endGuide();
      return;
    }
    showGuideStep(guideStep + 1);
  }

  function skipGuide() {
    if (!guideActive) return;
    analytics().track("guide_skip", { step: guideStep + 1 });
    endGuide();
  }

  function applyTheme(choice, { track = true } = {}) {
    const prev = state.theme;
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
    if (prev !== choice) save();
    if (track && prev !== choice) analytics().track("theme_change", { theme: choice, actual });
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
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        remove = date >= oldest && date <= end;
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
    applyTheme(state.theme, { track: false });
    renderSpeech();
    renderHome();
    if (document.querySelector("#historyPage")?.classList.contains("active")) {
      renderHistory(document.querySelector(".period.active")?.dataset.period || "day");
    }
    updateInstallVisibility();
    document.querySelectorAll("[data-reset-period]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.resetPeriod === (state.resetPeriod || "day"));
    });
    const now = new Date();
    const monthNames = t("months");
    const weekNames = t("week");
    $("todayLabel").innerHTML =
      `${now.getDate()} ${monthNames[now.getMonth()]}<br>${weekNames[now.getDay()]}`;
    if (guideActive) positionGuideStep();
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
  $("openMenu").addEventListener("click", () => {
    if (state.treeFocus) {
      state.treeFocus = false;
      cancelTreeFocusAnimation();
      renderTree();
    }
    openMenu();
  });
  $("closeMenu").addEventListener("click", closeLayers);
  $("scrim").addEventListener("click", closeLayers);
  $("backHome").addEventListener("click", () => openPage("home"));
  $("speech").addEventListener("click", nextSpeech);
  $("speech").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      nextSpeech();
    }
  });
  $("treeStage").addEventListener("click", toggleTreeFocus);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && guideActive) {
      event.preventDefault();
      skipGuide();
      return;
    }
    if (event.key === "Escape" && state.treeFocus) {
      toggleTreeFocus({ force: true });
    }
  });
  $("guideNext")?.addEventListener("click", advanceGuide);
  $("guideSkip")?.addEventListener("click", skipGuide);
  $("openGuide")?.addEventListener("click", () => {
    startGuide();
  });
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
  $("installBannerDismiss").addEventListener("click", () => {
    localStorage.setItem("nafs.install.dismissed", "1");
    $("installBanner").classList.remove("show");
    analytics().track("install_banner_dismiss");
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
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    if (local) {
      // A previously installed worker would keep serving stale dev files.
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        if (!regs.length) return;
        Promise.all(regs.map((reg) => reg.unregister()))
          .then(() => caches?.keys?.())
          .then((keys) => Promise.all((keys || []).map((key) => caches.delete(key))))
          .then(() => location.reload())
          .catch(() => {});
      });
    } else {
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
  }

  // Sync toggles with stored settings on boot.
  document.querySelectorAll("[data-setting]").forEach((b) => {
    b.classList.toggle("on", Boolean(state.settings[b.dataset.setting]));
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__nafsResizeTimer);
    window.__nafsResizeTimer = setTimeout(() => {
      const page = $("homePage");
      if (page?.classList.contains("rows-animating")) {
        cancelTreeFocusAnimation();
      }
      window.NAFS_tree?.getGrowing?.()?.resize?.(true);
    }, 150);
  });

  const systemThemeMq = matchMedia("(prefers-color-scheme: dark)");
  const onSystemThemeChange = () => {
    if (state.theme === "system") applyTheme("system", { track: false });
  };
  if (systemThemeMq.addEventListener) {
    systemThemeMq.addEventListener("change", onSystemThemeChange);
  } else if (systemThemeMq.addListener) {
    systemThemeMq.addListener(onSystemThemeChange);
  }

  syncLayerA11y();

  /** Dev only: ?treeDebug=1 on localhost shows progress/health controls. */
  function setupTreeDebug() {
    const params = new URLSearchParams(location.search);
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    const enabled = local && params.has("treeDebug");
    const panel = $("treeDebug");
    if (!panel) return;
    if (!enabled) {
      panel.hidden = true;
      panel.classList.remove("show");
      return;
    }
    panel.hidden = false;
    panel.classList.add("show");

    const progressSlider = $("treeDebugProgress");
    const progressLabel = $("treeDebugProgressLabel");
    const vitalitySlider = $("treeDebugVitality");
    const vitalityLabel = $("treeDebugVitalityLabel");
    const poisonSlider = $("treeDebugPoison");
    const poisonLabel = $("treeDebugPoisonLabel");
    const seedLabel = $("treeDebugSeed");

    const syncProgressLabel = () => {
      progressLabel.textContent = `${Number(progressSlider.value) || 0}%`;
    };
    const syncHealthLabels = () => {
      vitalityLabel.textContent = `${Number(vitalitySlider.value) || 0}%`;
      poisonLabel.textContent = `${Number(poisonSlider.value) || 0}%`;
    };
    const applyHealth = () => {
      treeDebugOverride = true;
      syncHealthLabels();
      const vitality = (Number(vitalitySlider.value) || 0) / 100;
      const poison = (Number(poisonSlider.value) || 0) / 100;
      const growing = window.NAFS_tree?.getGrowing?.();
      growing?.setHealth(vitality, poison);

      const stageEl = $("treeStage");
      if (stageEl) {
        stageEl.style.setProperty("--tree-vitality", String(vitality));
        stageEl.style.setProperty("--tree-poison", String(poison));
        const health =
          window.NAFS_tree?.healthFromVitality?.(vitality, 1) || "mixed";
        stageEl.dataset.health = health;
        const caption = $("treeCaption");
        if (caption) {
          const stageKey =
            stageEl.dataset.stage != null
              ? (
                  window.NAFS_tree?.STAGE_RULES || []
                ).find((rule) => String(rule.id) === stageEl.dataset.stage)?.key
              : null;
          if (stageKey) {
            caption.textContent = `${t(stageKey)} · ${t(
              healthCaption[health] || "treeHealthDormant"
            )}`;
          }
        }
      }
    };

    progressSlider.addEventListener("input", () => {
      treeDebugOverride = true;
      syncProgressLabel();
      const growing = window.NAFS_tree?.getGrowing?.();
      growing?.setProgress((Number(progressSlider.value) || 0) / 100);
    });

    vitalitySlider.addEventListener("input", applyHealth);
    poisonSlider.addEventListener("input", applyHealth);

    $("treeDebugGrow").addEventListener("click", () => {
      treeDebugOverride = true;
      const growing = window.NAFS_tree?.getGrowing?.();
      if (!growing) return;
      const start = growing.progress;
      const from = performance.now();
      const duration = 4200;
      const step = (now) => {
        const t = Math.min(1, (now - from) / duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const value = start + (1 - start) * eased;
        growing.setProgress(value);
        progressSlider.value = String(Math.round(value * 100));
        syncProgressLabel();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    $("treeDebugRegen").addEventListener("click", () => {
      treeDebugOverride = true;
      const growing = window.NAFS_tree?.getGrowing?.();
      const seed = growing?.regenerate();
      if (seedLabel) seedLabel.textContent = String(seed || "");
    });

    const growing = window.NAFS_tree?.getGrowing?.();
    if (growing) {
      if (seedLabel) seedLabel.textContent = String(growing.seed);
      progressSlider.value = String(Math.round((growing.progress || 0) * 100));
      vitalitySlider.value = String(Math.round((growing.vitality ?? 0.7) * 100));
      poisonSlider.value = String(Math.round((growing.poison ?? 0.3) * 100));
    }
    syncProgressLabel();
    syncHealthLabels();
  }

  maybeSeedDemoTree();
  Promise.resolve(window.NAFS_tree?.mount?.($("treeCanvas")))
    .catch(() => {})
    .finally(() => {
      refreshAll();
      syncLayerA11y();
      setupTreeDebug();
      requestAnimationFrame(() => {
        window.NAFS_tree?.getGrowing?.()?.resize?.(true);
      });
      analytics().params({ lang: state.lang, theme: state.theme });
      analytics().hit();
      if (!isGuideSeen()) {
        setTimeout(() => {
          if (!isGuideSeen() && !guideActive) startGuide();
        }, 450);
      }
    });
})();
