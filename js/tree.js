/**
 * Spiritual tree bridge for Nafs.
 * Maps lifetime Iman/Nafs journey → GrowingTree canvas progress/health.
 */
(() => {
  "use strict";

  /** Journey day → stage id (for captions). */
  const STAGE_RULES = [
    { id: 0, minDay: 0, key: "treeStageSoil" },
    { id: 1, minDay: 1, key: "treeStageSeed" },
    { id: 2, minDay: 2, key: "treeStageSproutTiny" },
    { id: 3, minDay: 3, key: "treeStageSprout" },
    { id: 4, minDay: 7, key: "treeStageTreelet" },
    { id: 5, minDay: 30, key: "treeStageSapling" },
    { id: 6, minDay: 180, key: "treeStageYoung" },
  ];

  /** Discrete milestones → continuous growth curve. */
  const GROWTH_MARKS = [
    { day: 0, progress: 0.01 },
    { day: 1, progress: 0.08 },
    { day: 2, progress: 0.2 },
    { day: 3, progress: 0.32 },
    { day: 7, progress: 0.52 },
    { day: 30, progress: 0.74 },
    { day: 180, progress: 1 },
  ];

  /** Baseline for a brand-new user — soil + faint life, not a blank canvas. */
  const DORMANT_PROGRESS = 0.01;

  function parseDay(key) {
    const [y, m, d] = String(key).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function dayDiff(from, to) {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.floor((b - a) / 86400000);
  }

  function totalsFromDays(days) {
    let me = 0;
    let nafs = 0;
    let firstKey = null;
    Object.keys(days || {}).forEach((key) => {
      const row = days[key] || {};
      const m = Number(row.me) || 0;
      const n = Number(row.nafs) || 0;
      if (m + n <= 0) return;
      me += m;
      nafs += n;
      if (!firstKey || key < firstKey) firstKey = key;
    });
    return { me, nafs, firstKey, total: me + nafs };
  }

  function stageForJourneyDay(journeyDay, hasMarks) {
    if (!hasMarks) return STAGE_RULES[0];
    let chosen = STAGE_RULES[1];
    for (const rule of STAGE_RULES) {
      if (rule.id === 0) continue;
      if (journeyDay >= rule.minDay) chosen = rule;
    }
    return chosen;
  }

  function healthFromVitality(vitality, total) {
    if (!total) return "dormant";
    if (vitality >= 0.78) return "living";
    if (vitality >= 0.58) return "mostly";
    if (vitality >= 0.42) return "mixed";
    if (vitality >= 0.22) return "withered";
    return "rotten";
  }

  function progressFromJourneyDay(journeyDay, hasMarks) {
    if (!hasMarks) return DORMANT_PROGRESS;
    const day = Math.max(0, journeyDay);
    for (let i = 0; i < GROWTH_MARKS.length - 1; i += 1) {
      const a = GROWTH_MARKS[i];
      const b = GROWTH_MARKS[i + 1];
      if (day <= b.day) {
        const t = (day - a.day) / Math.max(1, b.day - a.day);
        return a.progress + (b.progress - a.progress) * t;
      }
    }
    return 1;
  }

  function hashSeed(text) {
    const source = String(text || "nafs");
    let h = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      h ^= source.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 12345;
  }

  function compute(days, now = new Date()) {
    const { me, nafs, firstKey, total } = totalsFromDays(days);
    const first = firstKey ? parseDay(firstKey) : null;
    const ageDays = first ? Math.max(0, dayDiff(first, now)) : 0;
    const journeyDay = first ? ageDays + 1 : 0;
    let stage = stageForJourneyDay(journeyDay, total > 0);
    let vitality = total ? me / total : 0.5;
    let poison = total ? nafs / total : 0;
    let progress = progressFromJourneyDay(journeyDay, total > 0);

    const host = typeof location !== "undefined" ? location.hostname : "";
    const local = host === "localhost" || host === "127.0.0.1";
    if (local && typeof location !== "undefined") {
      const params = new URLSearchParams(location.search);
      if (params.has("treeStage")) {
        const n = Number(params.get("treeStage"));
        if (Number.isInteger(n) && n >= 0 && n <= 6) {
          stage = STAGE_RULES.find((rule) => rule.id === n) || stage;
          progress = GROWTH_MARKS.find((mark) => mark.day === (STAGE_RULES[n]?.minDay || 0))?.progress;
          if (progress == null) {
            const map = [0.01, 0.08, 0.2, 0.32, 0.52, 0.74, 1];
            progress = map[n] ?? progress;
          }
        }
      }
      if (params.has("treeProgress")) {
        const v = Number(params.get("treeProgress"));
        if (!Number.isNaN(v)) progress = Math.max(0, Math.min(1, v));
      }
      if (params.has("treeVitality")) {
        const v = Number(params.get("treeVitality"));
        if (!Number.isNaN(v)) {
          vitality = Math.max(0, Math.min(1, v));
          poison = 1 - vitality;
        }
      }
    }

    const health =
      total > 0 ? healthFromVitality(vitality, total) : "dormant";
    const seed = hashSeed(firstKey || "nafs-seed");

    return {
      me,
      nafs,
      total,
      firstKey,
      ageDays,
      journeyDay,
      stage: stage.id,
      stageKey: stage.key,
      vitality,
      poison,
      health,
      progress,
      seed,
    };
  }

  let growing = null;

  function mount(canvas) {
    if (!canvas || typeof window.GrowingTree !== "function") return false;
    if (growing) {
      growing.destroy();
      growing = null;
    }
    // Match empty-state compute so the first rAF frame isn't a health flash.
    growing = new window.GrowingTree({
      canvas,
      progress: DORMANT_PROGRESS,
      seed: 12345,
      animated: true,
      vitality: 0.5,
      poison: 0,
    });
    return true;
  }

  function paint(tree) {
    if (!growing) return;
    growing.setProgress(
      Number.isFinite(tree.progress) ? tree.progress : DORMANT_PROGRESS
    );
    growing.setHealth(
      Number.isFinite(tree.vitality) ? tree.vitality : 0.5,
      Number.isFinite(tree.poison) ? tree.poison : 0
    );
    if (tree.seed && tree.seed !== growing.seed) {
      growing.regenerate(tree.seed);
    }
  }

  function getGrowing() {
    return growing;
  }

  function destroy() {
    if (growing) growing.destroy();
    growing = null;
  }

  window.NAFS_tree = {
    STAGE_RULES,
    compute,
    healthFromVitality,
    mount,
    paint,
    getGrowing,
    destroy,
  };
})();
