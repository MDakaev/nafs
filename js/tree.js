/**
 * Spiritual tree model for Nafs.
 * Size grows with journey age (always). Vitality comes from lifetime Iman vs Nafs.
 */
(() => {
  "use strict";

  /** Journey day → stage id (0 = dormant soil). */
  const STAGE_RULES = [
    { id: 0, minDay: 0, key: "treeStageSoil" },
    { id: 1, minDay: 1, key: "treeStageSeed" },
    { id: 2, minDay: 2, key: "treeStageSproutTiny" },
    { id: 3, minDay: 3, key: "treeStageSprout" },
    { id: 4, minDay: 7, key: "treeStageTreelet" },
    { id: 5, minDay: 30, key: "treeStageSapling" },
    { id: 6, minDay: 180, key: "treeStageYoung" },
  ];

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

  /** Health band from vitality 0..1 (share of Iman). */
  function healthFromVitality(vitality, total) {
    if (!total) return "dormant";
    if (vitality >= 0.78) return "living";
    if (vitality >= 0.58) return "mostly";
    if (vitality >= 0.42) return "mixed";
    if (vitality >= 0.22) return "withered";
    return "rotten";
  }

  function compute(days, now = new Date()) {
    const { me, nafs, firstKey, total } = totalsFromDays(days);
    const first = firstKey ? parseDay(firstKey) : null;
    const ageDays = first ? Math.max(0, dayDiff(first, now)) : 0;
    const journeyDay = first ? ageDays + 1 : 0;
    const stage = stageForJourneyDay(journeyDay, total > 0);
    const vitality = total ? me / total : 0.5;
    const poison = total ? nafs / total : 0;
    const health = healthFromVitality(vitality, total);

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
    };
  }

  window.NAFS_tree = {
    STAGE_RULES,
    compute,
    healthFromVitality,
  };
})();
