/**
 * Canvas drawing for GrowingTree — oak-like growth, connected branches, living leaves.
 */
(() => {
  "use strict";

  const DEFAULT_COLORS = {
    trunk: "#4a3828",
    trunkLight: "#6b5238",
    branch: "#5a4634",
    // Healthy (Iman): lime → emerald
    leafLime: "#9ccc5a",
    leaf: "#3f9a5c",
    leafDark: "#2a7044",
    leafHighlight: "#c5e87a",
    // Spoiled (Nafs): ochre → rust → brown
    leafDry: "#d4a84a",
    leafAutumn: "#c56a2e",
    leafDead: "#6b4a32",
    shadow: "rgba(42, 34, 24, 0.16)",
    glow: "rgba(255, 228, 150, 0.14)",
    particle: "rgba(120, 150, 120, 0.28)",
    soil: "#6d5a42",
    soilDark: "#4d4030",
    seed: "#7a5b35",
    seedLight: "#c4a56a",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function lerpColor(a, b, t) {
    const parse = (hex) => {
      const h = hex.replace("#", "");
      if (h.length !== 6) return [128, 128, 128];
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    };
    if (!String(a).startsWith("#") || !String(b).startsWith("#")) return t < 0.5 ? a : b;
    const A = parse(a);
    const B = parse(b);
    const m = (i) => Math.round(A[i] + (B[i] - A[i]) * clamp(t, 0, 1));
    return `rgb(${m(0)},${m(1)},${m(2)})`;
  }

  function branchLocalProgress(branch, progress) {
    const span = Math.max(0.0001, branch.growthEnd - branch.growthStart);
    return easeOutCubic(clamp((progress - branch.growthStart) / span, 0, 1));
  }

  function leafReveal(leaf, progress) {
    const span = Math.max(0.0001, (leaf.growthEnd || leaf.growthStart + 0.12) - leaf.growthStart);
    const local = easeOutCubic(clamp((progress - leaf.growthStart) / span, 0, 1));
    // Soft unfold: 0 → 1.12 → 1
    const scale = local < 0.65 ? (local / 0.65) * 1.12 : 1.12 - ((local - 0.65) / 0.35) * 0.12;
    return { local, scale: Math.max(0, scale), opacity: local };
  }

  /** Healthy vs spoiled leaf fill from Iman vitality / Nafs poison. */
  function leafFill(colors, tint, vitality, poison) {
    const healthy = lerpColor(
      lerpColor(colors.leafDark, colors.leaf, tint),
      colors.leafLime,
      clamp(vitality * 0.55 + tint * 0.2, 0, 1)
    );
    const highlight = lerpColor(healthy, colors.leafHighlight, clamp(vitality - 0.45, 0, 1) * 0.7);
    if (poison < 0.28) return lerpColor(healthy, highlight, vitality * 0.35);

    if (poison < 0.55) {
      return lerpColor(highlight, colors.leafDry, clamp((poison - 0.28) / 0.27, 0, 1));
    }
    if (poison < 0.78) {
      return lerpColor(colors.leafDry, colors.leafAutumn, clamp((poison - 0.55) / 0.23, 0, 1));
    }
    return lerpColor(colors.leafAutumn, colors.leafDead, clamp((poison - 0.78) / 0.22, 0, 1));
  }

  function pointAlong(branch, t, sway, startOverride) {
    const sx = startOverride ? startOverride.x : branch.startX;
    const sy = startOverride ? startOverride.y : branch.startY;
    const angle = branch.angle + sway;
    // Two-bend organic path (kink mid-segment).
    const bend = (branch.bend || 0) * Math.sin(t * Math.PI);
    const kink = (branch.kink || 0) * (t < 0.5 ? t * 2 : (1 - t) * 2) * 0.65;
    const a = angle + bend + kink;
    const len = branch.length * t;
    return {
      x: sx + Math.cos(a) * len,
      y: sy + Math.sin(a) * len,
      angle: a,
    };
  }

  function drawSoil(ctx, vitality) {
    const soil = lerpColor(DEFAULT_COLORS.soilDark, DEFAULT_COLORS.soil, vitality);
    ctx.save();
    ctx.fillStyle = "rgba(30,24,18,0.1)";
    ctx.beginPath();
    ctx.ellipse(0, 11, 74, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = soil;
    ctx.beginPath();
    ctx.moveTo(-62, 2);
    ctx.bezierCurveTo(-36, -16, -14, -22, 0, -22);
    ctx.bezierCurveTo(14, -22, 36, -16, 62, 2);
    ctx.bezierCurveTo(38, 12, 16, 15, 0, 15);
    ctx.bezierCurveTo(-16, 15, -38, 12, -62, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.quadraticCurveTo(0, -10, 38, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawSeed(ctx, progress, vitality) {
    // Visible at the very start; fades as the sprout takes over.
    const show = clamp(1 - (progress - 0.08) / 0.14, 0, 1) * clamp(progress / 0.04, 0, 1);
    if (show <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = show;
    ctx.translate(0, -5);
    ctx.fillStyle = lerpColor(DEFAULT_COLORS.seed, DEFAULT_COLORS.seedLight, vitality * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.2, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(210,180,120,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -1.2);
    ctx.quadraticCurveTo(0, -3.2, 3, -1);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw one branch. If parent tip is available, start from there so growth
   * never floats in empty air.
   */
  function drawBranch(ctx, branch, progress, time, animated, colors, tips, wind) {
    const local = branchLocalProgress(branch, progress);
    if (local <= 0.001) return null;

    // Wait until parent has extended enough that this limb can attach.
    let start = { x: branch.startX, y: branch.startY };
    if (branch.parent != null) {
      const parentTip = tips.get(branch.parent);
      if (!parentTip || parentTip.local < 0.7) return null;
      start = { x: parentTip.tip.x, y: parentTip.tip.y };
    }

    const depthFactor = branch.depth / 6;
    const swayAmp = animated && progress >= 0.995 ? (0.01 + depthFactor * 0.04) * wind : 0;
    const sway = Math.sin(time * (0.65 + branch.swaySpeed) + branch.swayPhase) * swayAmp;

    const tip = pointAlong(branch, local, sway, start);
    const mid = pointAlong(branch, local * 0.5, sway * 0.75, start);

    const width = Math.max(0.75, branch.width * (1 - depthFactor * 0.35));
    const color =
      branch.depth === 0
        ? colors.trunk
        : branch.depth < 2
          ? lerpColor(colors.trunk, colors.branch, 0.4)
          : colors.branch;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    // Tapers toward the tip.
    ctx.lineWidth = width * (1 - local * 0.18);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.stroke();

    if (branch.depth === 0 && local > 0.25) {
      ctx.strokeStyle = colors.trunkLight;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = Math.max(0.6, width * 0.32);
      ctx.beginPath();
      ctx.moveTo(start.x + 1.4, start.y);
      ctx.quadraticCurveTo(mid.x + 1.1, mid.y, tip.x + 0.7, tip.y);
      ctx.stroke();
    }
    ctx.restore();

    return { tip, local, sway, start };
  }

  function drawLeaf(ctx, leaf, branch, tipState, progress, time, animated, colors, vitality, poison) {
    if (!tipState || tipState.local < 0.22) return;
    const reveal = leafReveal(leaf, progress);
    if (reveal.opacity <= 0.02) return;

    // Leaf rides on the currently grown portion of its branch (never ahead of tip).
    const along = clamp(leaf.offset, 0.05, tipState.local);
    const start = tipState.start || { x: branch.startX, y: branch.startY };
    const wind = animated && progress >= 0.995 ? 1 : 0;
    const sway = Math.sin(time * 1.4 + leaf.phase) * (0.04 + leaf.scale * 0.035) * wind;
    const pos = pointAlong(branch, along, tipState.sway * 0.85, start);
    const x = pos.x + Math.cos(pos.angle + Math.PI / 2) * leaf.side * leaf.lateral;
    const y = pos.y + Math.sin(pos.angle + Math.PI / 2) * leaf.side * leaf.lateral;

    const fill = leafFill(colors, leaf.tint, vitality, poison);
    const w = (leaf.kind === "cotyledon" ? 8.5 : leaf.kind === "sprout" ? 7.2 : 5.4) + leaf.shape * 2.4;
    const h = (leaf.kind === "cotyledon" ? 5.2 : leaf.kind === "sprout" ? 4.4 : 3.4) + (1 - leaf.shape) * 1.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(leaf.rotation + sway);
    ctx.scale(reveal.scale * leaf.scale, reveal.scale * leaf.scale * leaf.stretch);
    ctx.globalAlpha = reveal.opacity * (0.82 + vitality * 0.18);
    ctx.fillStyle = fill;
    // Soft botanical oval (cotyledon / rounded leaf from the reference).
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(w * 0.35, -h * 0.85, w * 0.85, -h * 0.35, w, 0);
    ctx.bezierCurveTo(w * 0.85, h * 0.4, w * 0.3, h * 0.75, 0, 0);
    ctx.closePath();
    ctx.fill();

    if (vitality > 0.5 && poison < 0.45) {
      ctx.strokeStyle = colors.leafHighlight;
      ctx.globalAlpha = reveal.opacity * 0.28 * vitality;
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(w * 0.12, 0);
      ctx.quadraticCurveTo(w * 0.5, -0.15, w * 0.88, 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(ctx, particles, progress, time, colors) {
    if (progress < 0.45) return;
    const alphaBoost = clamp((progress - 0.45) / 0.55, 0, 1);
    particles.forEach((p) => {
      const y = p.y - ((time * p.speed) % 190);
      const x = p.x + Math.sin(time * 0.35 + p.phase) * p.drift;
      ctx.beginPath();
      ctx.fillStyle = colors.particle;
      ctx.globalAlpha = p.opacity * alphaBoost;
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, progress, vitality) {
    if (progress < 0.55 || vitality < 0.4) return;
    const a = ((progress - 0.55) / 0.45) * vitality * 0.5;
    ctx.save();
    const g = ctx.createRadialGradient(0, -85, 8, 0, -85, 115);
    g.addColorStop(0, `rgba(255,230,160,${0.16 * a})`);
    g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -85, 115, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function renderTree(ctx, model, options) {
    const {
      progress,
      time = 0,
      animated = true,
      vitality = 0.7,
      poison = 0.3,
      colors: colorOverrides = {},
    } = options;
    const colors = { ...DEFAULT_COLORS, ...colorOverrides };
    const p = clamp(Number(progress) || 0, 0, 1);
    const wind = animated ? 1 : 0;

    drawGlow(ctx, p, vitality);
    drawSoil(ctx, vitality);
    drawSeed(ctx, p, vitality);

    // Draw in depth order so parents establish tips before children attach.
    const ordered = model.branches.slice().sort((a, b) => a.depth - b.depth || a.id - b.id);
    const tips = new Map();
    ordered.forEach((branch) => {
      const drawn = drawBranch(ctx, branch, p, time, animated, colors, tips, wind);
      if (drawn) tips.set(branch.id, drawn);
    });

    const byId = new Map(model.branches.map((b) => [b.id, b]));
    model.leaves.forEach((leaf) => {
      const branch = byId.get(leaf.branchId);
      const tipState = tips.get(leaf.branchId);
      if (!branch || !tipState) return;
      drawLeaf(ctx, leaf, branch, tipState, p, time, animated, colors, vitality, poison);
    });

    drawParticles(ctx, model.particles, p, time, colors);
  }

  window.NAFS_treeRenderer = {
    DEFAULT_COLORS,
    clamp,
    easeInOutCubic,
    renderTree,
    branchLocalProgress,
  };
})();
