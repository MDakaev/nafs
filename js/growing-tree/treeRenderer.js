/**
 * Canvas drawing helpers for GrowingTree.
 */
(() => {
  "use strict";

  const DEFAULT_COLORS = {
    trunk: "#4a3828",
    trunkLight: "#6a5238",
    branch: "#5a4634",
    leaf: "#3f8a66",
    leafDark: "#2d6a4c",
    leafHighlight: "#6fbf88",
    leafDry: "#c4a84a",
    leafDead: "#3a3228",
    shadow: "rgba(42, 34, 24, 0.16)",
    glow: "rgba(255, 228, 150, 0.16)",
    particle: "rgba(120, 150, 120, 0.35)",
    soil: "#6d5a42",
    soilDark: "#4d4030",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpColor(a, b, t) {
    const parse = (hex) => {
      const h = hex.replace("#", "");
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    };
    if (!a.startsWith("#") || !b.startsWith("#")) return t < 0.5 ? a : b;
    const A = parse(a);
    const B = parse(b);
    const m = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
    return `rgb(${m(0)},${m(1)},${m(2)})`;
  }

  function branchLocalProgress(branch, progress) {
    const span = Math.max(0.0001, branch.growthEnd - branch.growthStart);
    return easeInOutCubic(clamp((progress - branch.growthStart) / span, 0, 1));
  }

  function leafReveal(leaf, progress) {
    const start = leaf.growthStart;
    const local = easeInOutCubic(clamp((progress - start) / 0.14, 0, 1));
    // 0 → 1.15 → 1
    const scale = local < 0.7 ? (local / 0.7) * 1.15 : 1.15 - ((local - 0.7) / 0.3) * 0.15;
    return { local, scale: Math.max(0, scale), opacity: local };
  }

  function pointAt(branch, t, sway) {
    const angle = branch.angle + sway;
    const bend = branch.bend * (1 - t) * t * 4;
    const a = angle + bend;
    const len = branch.length * t;
    return {
      x: branch.startX + Math.cos(a) * len,
      y: branch.startY + Math.sin(a) * len,
      angle: a,
    };
  }

  function drawSoil(ctx, vitality) {
    const soil = lerpColor(DEFAULT_COLORS.soilDark, DEFAULT_COLORS.soil, vitality);
    ctx.save();
    ctx.fillStyle = "rgba(30,24,18,0.1)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 78, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = soil;
    ctx.beginPath();
    ctx.moveTo(-66, 0);
    ctx.bezierCurveTo(-40, -18, -18, -24, 0, -24);
    ctx.bezierCurveTo(18, -24, 40, -18, 66, 0);
    ctx.bezierCurveTo(40, 10, 18, 14, 0, 14);
    ctx.bezierCurveTo(-18, 14, -40, 10, -66, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-42, -2);
    ctx.quadraticCurveTo(0, -12, 42, -2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSeed(ctx, progress, vitality) {
    const show = clamp(progress / 0.12, 0, 1);
    if (show <= 0) return;
    ctx.save();
    ctx.globalAlpha = show;
    ctx.translate(0, -6);
    const body = lerpColor("#5a4228", "#7a5b35", vitality);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(210,180,120,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2.5, -1.5);
    ctx.quadraticCurveTo(0, -3.5, 2.5, -1.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBranch(ctx, branch, progress, time, animated, colors, wind) {
    const local = branchLocalProgress(branch, progress);
    if (local <= 0.001) return null;

    const depthFactor = branch.depth / 6;
    const swayAmp = animated && progress >= 0.999 ? (0.012 + depthFactor * 0.045) * wind : 0;
    const sway =
      Math.sin(time * (0.7 + branch.swaySpeed) + branch.swayPhase) * swayAmp;

    const tip = pointAt(branch, local, sway);
    const mid = pointAt(branch, local * 0.55, sway * 0.7);

    const width = branch.width * (0.55 + 0.45 * (1 - depthFactor));
    const color =
      branch.depth === 0
        ? colors.trunk
        : branch.depth < 2
          ? lerpColor(colors.trunk, colors.branch, 0.45)
          : colors.branch;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, width * (1 - local * 0.12));
    ctx.beginPath();
    ctx.moveTo(branch.startX, branch.startY);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.stroke();

    if (branch.depth === 0 && local > 0.2) {
      ctx.strokeStyle = colors.trunkLight;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = Math.max(0.6, width * 0.35);
      ctx.beginPath();
      ctx.moveTo(branch.startX + 1.2, branch.startY);
      ctx.quadraticCurveTo(mid.x + 1.1, mid.y, tip.x + 0.8, tip.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    return { tip, local, sway };
  }

  function drawLeaf(ctx, leaf, branch, tipState, progress, time, animated, colors, vitality, poison) {
    if (!tipState || tipState.local < 0.82) return;
    const reveal = leafReveal(leaf, progress);
    if (reveal.opacity <= 0.01) return;

    const wind = animated && progress >= 0.999 ? 1 : 0;
    const sway =
      Math.sin(time * 1.35 + leaf.phase) * (0.05 + leaf.scale * 0.04) * wind;
    const tip = tipState.tip;
    const alongX = branch.startX + (tip.x - branch.startX) * leaf.offset;
    const alongY = branch.startY + (tip.y - branch.startY) * leaf.offset;
    const x = alongX + Math.cos(tip.angle + Math.PI / 2) * leaf.side * 2.2;
    const y = alongY + Math.sin(tip.angle + Math.PI / 2) * leaf.side * 2.2;

    const live = lerpColor(colors.leafDark, colors.leafHighlight, leaf.tint * 0.55 + vitality * 0.25);
    const dry = colors.leafDry;
    const dead = colors.leafDead;
    const fill =
      poison > 0.55
        ? lerpColor(live, dead, clamp((poison - 0.35) / 0.65, 0, 1))
        : poison > 0.3
          ? lerpColor(live, dry, clamp((poison - 0.3) / 0.35, 0, 0.8))
          : live;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(leaf.rotation + sway);
    ctx.scale(reveal.scale * leaf.scale, reveal.scale * leaf.scale * leaf.stretch);
    ctx.globalAlpha = reveal.opacity * (0.78 + vitality * 0.22);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(3.2, -2.2, 7.5, -1.2, 9.5, 0.2);
    ctx.bezierCurveTo(7.2, 2.4, 3.0, 3.0, 0, 0);
    ctx.closePath();
    ctx.fill();
    if (vitality > 0.55) {
      ctx.strokeStyle = colors.leafHighlight;
      ctx.globalAlpha = reveal.opacity * 0.25;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(1.2, 0.1);
      ctx.quadraticCurveTo(4.5, -0.2, 8.2, 0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(ctx, particles, progress, time, colors) {
    if (progress < 0.55) return;
    const alphaBoost = clamp((progress - 0.55) / 0.45, 0, 1);
    particles.forEach((p) => {
      const y = p.y - ((time * p.speed) % 210);
      const x = p.x + Math.sin(time * 0.4 + p.phase) * p.drift;
      ctx.beginPath();
      ctx.fillStyle = colors.particle;
      ctx.globalAlpha = p.opacity * alphaBoost;
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, progress, vitality) {
    if (progress < 0.7 || vitality < 0.35) return;
    const a = ((progress - 0.7) / 0.3) * vitality * 0.55;
    ctx.save();
    const g = ctx.createRadialGradient(0, -90, 10, 0, -90, 120);
    g.addColorStop(0, `rgba(255,230,160,${0.18 * a})`);
    g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -90, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Render a generated tree into ctx.
   * Local tree space: origin at soil, Y up negative.
   */
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
    if (p < 0.18) drawSeed(ctx, p, vitality);

    const tips = new Map();
    model.branches.forEach((branch) => {
      const drawn = drawBranch(ctx, branch, p, time, animated, colors, wind);
      if (drawn) tips.set(branch.id, drawn);
    });

    model.leaves.forEach((leaf) => {
      const branch = model.branches.find((item) => item.id === leaf.branchId);
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
