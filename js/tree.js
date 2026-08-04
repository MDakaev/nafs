/**
 * Spiritual tree model + SVG stage mounting for Nafs.
 * Size grows with journey age (always). Vitality comes from lifetime Iman vs Nafs.
 */
(() => {
  "use strict";

  /** Journey day → stage id (0 = dormant soil). */
  const STAGE_RULES = [
    { id: 0, minDay: 0, key: "treeStageSoil", file: "./assets/tree/00-soil.svg" },
    { id: 1, minDay: 1, key: "treeStageSeed", file: "./assets/tree/01-seed.svg" },
    { id: 2, minDay: 2, key: "treeStageSproutTiny", file: "./assets/tree/02-sprout-tiny.svg" },
    { id: 3, minDay: 3, key: "treeStageSprout", file: "./assets/tree/03-sprout.svg" },
    { id: 4, minDay: 7, key: "treeStageTreelet", file: "./assets/tree/04-treelet.svg" },
    { id: 5, minDay: 30, key: "treeStageSapling", file: "./assets/tree/05-sapling.svg" },
    { id: 6, minDay: 180, key: "treeStageYoung", file: "./assets/tree/06-young.svg" },
  ];

  let framesReady = false;
  let mountEl = null;

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
    let stage = stageForJourneyDay(journeyDay, total > 0);
    let vitality = total ? me / total : 0.5;
    let poison = total ? nafs / total : 0;

    // Localhost preview helpers: ?treeStage=0..6 & ?treeVitality=0..1
    const host = typeof location !== "undefined" ? location.hostname : "";
    const local = host === "localhost" || host === "127.0.0.1";
    if (local && typeof location !== "undefined") {
      const params = new URLSearchParams(location.search);
      if (params.has("treeStage")) {
        const n = Number(params.get("treeStage"));
        if (Number.isInteger(n) && n >= 0 && n <= 6) {
          stage = STAGE_RULES.find((rule) => rule.id === n) || stage;
        }
      }
      if (params.has("treeVitality")) {
        const v = Number(params.get("treeVitality"));
        if (!Number.isNaN(v)) {
          vitality = Math.max(0, Math.min(1, v));
          poison = 1 - vitality;
        }
      }
    }

    const health = healthFromVitality(vitality, total || (local && stage.id > 0 ? 1 : 0));

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

  function uniquifyIds(markup, stage) {
    return markup
      .replace(/\bid="skySoft"/g, `id="skySoft-${stage}"`)
      .replace(/url\(#skySoft\)/g, `url(#skySoft-${stage})`);
  }

  async function mount(root) {
    mountEl = root;
    if (!mountEl) return false;
    mountEl.innerHTML = "";
    mountEl.classList.add("tree-canvas");

    const results = await Promise.all(
      STAGE_RULES.map(async (rule) => {
        try {
          const res = await fetch(rule.file, { cache: "force-cache" });
          if (!res.ok) throw new Error(String(res.status));
          const text = await res.text();
          return { rule, text };
        } catch {
          return { rule, text: null };
        }
      })
    );

    results.forEach(({ rule, text }) => {
      const frame = document.createElement("div");
      frame.className = "tree-frame";
      frame.dataset.stage = String(rule.id);
      if (text) {
        frame.innerHTML = uniquifyIds(text, rule.id);
      } else {
        frame.innerHTML =
          '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="150" r="18" fill="#6d5a42" opacity=".5"/></svg>';
      }
      mountEl.appendChild(frame);
    });

    framesReady = true;
    return true;
  }

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  /** Apply active stage + layer opacities from vitality/poison. */
  function paint(tree) {
    if (!mountEl || !framesReady) return;
    const stage = String(tree.stage ?? 0);
    const vitality = clamp01(Number(tree.vitality) || 0);
    const poison = clamp01(Number(tree.poison) || 0);
    const total = Number(tree.total) || 0;

    mountEl.querySelectorAll(".tree-frame").forEach((frame) => {
      frame.classList.toggle("is-active", frame.dataset.stage === stage);
    });

    const active = mountEl.querySelector(`.tree-frame[data-stage="${stage}"]`);
    if (!active) return;

    const alive = total ? clamp01(0.45 + vitality * 0.55) : 0.55;
    const dry = total ? clamp01(poison * 0.95) : 0;
    const dead = total ? clamp01(Math.pow(poison, 1.25) * 1.05) : 0;
    const marks = total ? clamp01(poison) : 0;
    const light = total ? clamp01(0.15 + vitality * 0.85) : 0.2;

    const set = (selector, value) => {
      active.querySelectorAll(selector).forEach((el) => {
        el.style.opacity = String(value);
      });
    };

    set(".layer-alive", alive);
    set(".layer-dry", dry);
    set(".layer-dead", dead);
    set(".layer-poison", marks);
    set(".layer-light", light);
    set(".layer-soil", 1);
  }

  window.NAFS_tree = {
    STAGE_RULES,
    compute,
    healthFromVitality,
    mount,
    paint,
    get ready() {
      return framesReady;
    },
  };
})();
