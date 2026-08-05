/**
 * NAFS GrowingTree v2 Renderer
 *
 * Designed for:
 *   NAFS_treeGenerator v2
 *
 * Canvas renderer for:
 *   - roots
 *   - trunk
 *   - curved branches
 *   - twigs
 *   - leaf clusters
 *   - organic leaf reveal
 *   - wind
 *   - vitality / poison colors
 *   - atmospheric particles
 *   - seed / soil
 */

(() => {
  "use strict";

  // ============================================================
  // COLORS
  // ============================================================

  const DEFAULT_COLORS = {
    trunk: "#4a3828",
    trunkLight: "#765b3d",
    trunkHighlight: "#987653",

    branch: "#5a4634",
    branchLight: "#72583f",

    root: "#5a4633",
    rootLight: "#765b3f",

    leafLime: "#9ccc5a",
    leaf: "#3f9a5c",
    leafDark: "#2a7044",
    leafHighlight: "#c5e87a",

    leafDry: "#d4a84a",
    leafAutumn: "#c56a2e",
    leafDead: "#6b4a32",

    // Young sprout stem — lignifies to brown wood by ~20% progress.
    stemGreen: "#3f7a45",
    stemGreenLight: "#5a9458",
    stemGreenHighlight: "#7eb86a",
    woodRotten: "#2a2018",
    woodRottenLight: "#3d3228",

    shadow: "rgba(42, 34, 24, 0.16)",
    deepShadow: "rgba(30, 23, 17, 0.24)",

    glow: "rgba(255, 228, 150, 0.14)",

    particle: "rgba(120, 150, 120, 0.28)",

    soil: "#6d5a42",
    soilDark: "#4d4030",
    soilLight: "#806b4e",

    seed: "#7a5b35",
    seedLight: "#c4a56a",
  };


  // ============================================================
  // BASIC UTILITIES
  // ============================================================

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    t = clamp(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    t = clamp(t);

    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBack(t) {
    t = clamp(t);

    const c1 = 1.70158;
    const c3 = c1 + 1;

    return 1 +
      c3 * Math.pow(t - 1, 3) +
      c1 * Math.pow(t - 1, 2);
  }


  // ============================================================
  // COLOR UTILITIES
  // ============================================================

  function parseColor(color) {
    if (!color || typeof color !== "string") {
      return [128, 128, 128];
    }

    if (color.startsWith("#")) {
      const value = color.slice(1);

      if (value.length !== 6) {
        return [128, 128, 128];
      }

      return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
      ];
    }

    // getLeafColor chains lerpColor; intermediate results are rgb(...).
    const match = color.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
    );

    if (match) {
      return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      ];
    }

    return [128, 128, 128];
  }

  function lerpColor(a, b, t) {
    if (typeof a !== "string" || typeof b !== "string") {
      return t < 0.5 ? a : b;
    }

    const canLerp = (c) =>
      c.startsWith("#") || /^rgba?\(/i.test(c);

    if (!canLerp(a) || !canLerp(b)) {
      return t < 0.5 ? a : b;
    }

    const A = parseColor(a);
    const B = parseColor(b);
    const amount = clamp(t);

    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * amount)},${Math.round(A[1] + (B[1] - A[1]) * amount)},${Math.round(A[2] + (B[2] - A[2]) * amount)})`;
  }

  /** Numeric RGB lerp — avoids string churn in the leaf hot path. */
  function lerpRgb(a, b, t) {
    const amount = clamp(t);
    return [
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount,
    ];
  }

  function rgbToCss(rgb) {
    return `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
  }


  // ============================================================
  // LEAF COLOR
  // ============================================================

  function getLeafColor(
    colors,
    tint,
    vitality,
    poison
  ) {
    let palette = colors._leafRgb;
    if (!palette) {
      palette = colors._leafRgb = {
        leafDark: parseColor(colors.leafDark),
        leaf: parseColor(colors.leaf),
        leafLime: parseColor(colors.leafLime),
        leafHighlight: parseColor(colors.leafHighlight),
        leafDry: parseColor(colors.leafDry),
        leafAutumn: parseColor(colors.leafAutumn),
        leafDead: parseColor(colors.leafDead),
      };
    }

    const healthyBase = lerpRgb(palette.leafDark, palette.leaf, tint);

    const healthyBright = lerpRgb(
      healthyBase,
      palette.leafLime,
      clamp(vitality * 0.55 + tint * 0.2)
    );

    const healthy = lerpRgb(
      healthyBright,
      palette.leafHighlight,
      clamp(vitality - 0.45) * 0.7
    );

    poison = clamp(poison);

    if (poison < 0.28) {
      return rgbToCss(lerpRgb(healthy, palette.leafHighlight, vitality * 0.25));
    }

    if (poison < 0.55) {
      return rgbToCss(lerpRgb(healthy, palette.leafDry, (poison - 0.28) / 0.27));
    }

    if (poison < 0.78) {
      return rgbToCss(lerpRgb(palette.leafDry, palette.leafAutumn, (poison - 0.55) / 0.23));
    }

    return rgbToCss(lerpRgb(palette.leafAutumn, palette.leafDead, (poison - 0.78) / 0.22));
  }


  // ============================================================
  // WOOD LIGNIFICATION
  // ============================================================

  /**
   * Young growth is a green live stem at ~1% progress,
   * then carefully lignifies to brown wood by ~20%.
   * 0 = green sprout, 1 = mature bark.
   */
  function woodLignify(progress) {
    return easeInOutCubic(
      clamp((progress - 0.01) / 0.19)
    );
  }


  // ============================================================
  // BRANCH PROGRESS
  // ============================================================

  function branchProgress(branch, progress) {
    const start = Number(branch.growthStart) || 0;
    const end = Number(branch.growthEnd) || 1;

    const span = Math.max(
      0.0001,
      end - start
    );

    const raw = clamp(
      (progress - start) / span
    );

    return easeOutCubic(raw);
  }


  // ============================================================
  // ROOT PROGRESS
  // ============================================================

  function rootProgress(root, progress) {
    const start = Number(root.growthStart) || 0;
    const end = Number(root.growthEnd) || 1;

    const span = Math.max(
      0.0001,
      end - start
    );

    return easeOutCubic(
      clamp(
        (progress - start) / span
      )
    );
  }


  // ============================================================
  // POINT ON POLYLINE
  // ============================================================

  function getCurveMetrics(points) {
    if (!points || points.length < 2) {
      return {
        lengths: [],
        total: 0,
      };
    }

    const lengths = [];
    let total = 0;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];

      const length = Math.hypot(
        b.x - a.x,
        b.y - a.y
      );

      lengths.push(length);
      total += length;
    }

    return {
      lengths,
      total,
    };
  }


  function pointOnPolyline(
    points,
    metrics,
    progress
  ) {
    if (!points || points.length === 0) {
      return {
        x: 0,
        y: 0,
        angle: 0,
      };
    }

    if (points.length === 1) {
      return {
        x: points[0].x,
        y: points[0].y,
        angle: 0,
      };
    }

    const p = clamp(progress);

    if (p <= 0) {
      const a = points[0];
      const b = points[1];

      return {
        x: a.x,
        y: a.y,
        angle: Math.atan2(
          b.y - a.y,
          b.x - a.x
        ),
      };
    }

    if (p >= 1) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];

      return {
        x: b.x,
        y: b.y,
        angle: Math.atan2(
          b.y - a.y,
          b.x - a.x
        ),
      };
    }

    const target =
      metrics.total * p;

    let travelled = 0;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];

      const segment =
        metrics.lengths[i - 1];

      if (
        travelled + segment >= target
      ) {
        const local =
          segment <= 0
            ? 0
            : (target - travelled) / segment;

        return {
          x: lerp(a.x, b.x, local),
          y: lerp(a.y, b.y, local),
          angle: Math.atan2(
            b.y - a.y,
            b.x - a.x
          ),
        };
      }

      travelled += segment;
    }

    const a = points[points.length - 2];
    const b = points[points.length - 1];

    return {
      x: b.x,
      y: b.y,
      angle: Math.atan2(
        b.y - a.y,
        b.x - a.x
      ),
    };
  }


  // ============================================================
  // WIND
  // ============================================================

  /** X sway shared by stroke geometry, tips, and leaves — one formula. */
  function windXAtIndex(i, pointCount, wind, branch, time) {
    if (!wind) return 0;
    const last = Math.max(1, pointCount - 1);
    return (
      Math.sin(
        time * 0.7 + (branch.swayPhase || 0) + i * 0.4
      ) *
      wind *
      (i / last)
    );
  }

  /** Same sway sampled by normalized distance along the branch [0, 1]. */
  function windXAtAlong(along, wind, branch, time, pointCount) {
    if (!wind) return 0;
    const last = Math.max(1, (pointCount || 2) - 1);
    const t = clamp(along);
    return windXAtIndex(t * last, last + 1, wind, branch, time);
  }

  function getWindOffset(
    branch,
    progress,
    time,
    windStrength
  ) {
    if (!windStrength || progress <= 0.01) {
      return 0;
    }

    const depth =
      Number(branch.depth) || 0;

    const sensitivity =
      Number(branch.swayAmount) ||
      (0.005 + depth * 0.008);

    const speed =
      Number(branch.swaySpeed) ||
      0.8;

    const phase =
      Number(branch.swayPhase) || 0;

    const growthFactor =
      clamp(
        (progress - 0.25) / 0.75
      );

    return (
      Math.sin(
        time * speed +
        phase
      ) *
      sensitivity *
      windStrength *
      growthFactor
    );
  }


  // ============================================================
  // CURVE PATH
  // ============================================================

  function tracePolyline(
    ctx,
    points,
    metrics,
    progress,
    wind,
    branch,
    time
  ) {
    if (!points || points.length < 2) {
      return;
    }

    const p = clamp(progress);
    const target = metrics.total * p;
    let travelled = 0;

    ctx.moveTo(
      points[0].x + windXAtIndex(0, points.length, wind, branch, time),
      points[0].y
    );

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const segment = metrics.lengths[i - 1];

      if (travelled + segment <= target) {
        // Only advance to segment end — re-stroking `a` added a wind kink.
        ctx.lineTo(
          b.x + windXAtIndex(i, points.length, wind, branch, time),
          b.y
        );
        travelled += segment;
        continue;
      }

      const remaining = target - travelled;
      const local =
        segment <= 0
          ? 0
          : clamp(remaining / segment);

      ctx.lineTo(
        lerp(a.x, b.x, local) +
          windXAtIndex(i - 1 + local, points.length, wind, branch, time),
        lerp(a.y, b.y, local)
      );

      break;
    }
  }


  // ============================================================
  // SOIL
  // ============================================================

  function drawSoil(
    ctx,
    colors,
    vitality,
    progress
  ) {
    const soil = lerpColor(
      colors.soilDark,
      colors.soil,
      clamp(vitality)
    );

    const visibility =
      clamp(
        0.35 +
        progress * 0.65
      );

    ctx.save();

    ctx.globalAlpha = visibility;

    // Ground shadow.
    ctx.fillStyle =
      colors.shadow;

    ctx.beginPath();

    ctx.ellipse(
      0,
      12,
      78,
      9,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // Main soil mound.
    ctx.fillStyle = soil;

    ctx.beginPath();

    ctx.moveTo(-64, 2);

    ctx.bezierCurveTo(
      -42,
      -15,
      -17,
      -22,
      0,
      -22
    );

    ctx.bezierCurveTo(
      17,
      -22,
      42,
      -15,
      64,
      2
    );

    ctx.bezierCurveTo(
      41,
      13,
      18,
      16,
      0,
      16
    );

    ctx.bezierCurveTo(
      -18,
      16,
      -41,
      13,
      -64,
      2
    );

    ctx.closePath();

    ctx.fill();

    // Upper soil ridge.
    ctx.strokeStyle =
      "rgba(255,255,255,0.07)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(-40, 0);

    ctx.quadraticCurveTo(
      0,
      -11,
      40,
      0
    );

    ctx.stroke();

    // Tiny soil particles.
    if (progress > 0.12) {
      ctx.fillStyle =
        colors.soilLight;

      ctx.globalAlpha =
        0.15 * vitality;

      for (let i = 0; i < 12; i++) {
        const x =
          Math.sin(i * 91.17) * 45;

        const y =
          Math.cos(i * 41.37) * 7;

        const r =
          0.5 +
          (i % 3) * 0.35;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          r,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    }

    ctx.restore();
  }


  // ============================================================
  // FULL-BLEED SOIL (focus mode, screen space)
  // ============================================================

  /**
   * Wide ground band across the canvas. Height matches the old mound;
   * width fills the stage (used in tree-focus).
   */
  function drawFullBleedSoil(
    ctx,
    width,
    height,
    groundY,
    colors,
    vitality,
    progress,
    alpha = 1
  ) {
    const soil = lerpColor(
      colors.soilDark,
      colors.soil,
      clamp(vitality)
    );

    const visibility = clamp(0.4 + progress * 0.6) * clamp(alpha);
    const soilH = Math.max(34, Math.min(78, height * 0.145));
    const crest = groundY - soilH * 0.42;

    ctx.save();
    ctx.globalAlpha = visibility;

    // Soft contact shadow under the soil lip.
    ctx.fillStyle = colors.deepShadow;
    ctx.beginPath();
    ctx.ellipse(
      width * 0.5,
      groundY + soilH * 0.18,
      width * 0.48,
      soilH * 0.22,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Full-width ground with a gentle living crest.
    ctx.fillStyle = soil;
    ctx.beginPath();
    ctx.moveTo(0, height + 2);
    ctx.lineTo(0, groundY + 6);
    ctx.quadraticCurveTo(
      width * 0.18,
      crest,
      width * 0.5,
      crest + soilH * 0.08
    );
    ctx.quadraticCurveTo(
      width * 0.82,
      crest,
      width,
      groundY + 6
    );
    ctx.lineTo(width, height + 2);
    ctx.closePath();
    ctx.fill();

    // Ridge highlight.
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 4);
    ctx.quadraticCurveTo(
      width * 0.5,
      crest + soilH * 0.2,
      width,
      groundY + 4
    );
    ctx.stroke();

    // Sparse grit.
    if (progress > 0.08) {
      ctx.fillStyle = colors.soilLight;
      ctx.globalAlpha = 0.14 * clamp(vitality);
      for (let i = 0; i < 28; i += 1) {
        const x = ((i * 97.3) % 1) * width;
        const y =
          groundY -
          soilH * 0.15 +
          ((i * 41.7) % 1) * soilH * 0.55;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + (i % 3) * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }


  // ============================================================
  // PULSING SUN + CLOUDS (screen space)
  // ============================================================

  function drawCloudPuff(ctx, x, y, scale, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale * 0.78);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(-18, 4, 14, 0, Math.PI * 2);
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(16, 3, 13, 0, Math.PI * 2);
    ctx.arc(4, -8, 11, 0, Math.PI * 2);
    ctx.arc(-8, -4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Sun dims as Nafs/poison rises; clouds drift in and veil it.
   */
  function drawSun(
    ctx,
    width,
    height,
    time,
    vitality,
    progress,
    poison = 0
  ) {
    if (progress < 0.01) return;

    poison = clamp(poison);
    vitality = clamp(vitality);

    const pulse =
      0.88 +
      Math.sin(time * 1.35) * 0.12 +
      Math.sin(time * 0.55) * 0.04;

    // High Nafs kills brightness; vitality keeps a little warmth.
    const clarity = clamp(1 - poison * 0.92 + vitality * 0.08);
    const dim = clamp(0.18 + clarity * 0.82);

    const x = width * 0.78;
    const y = height * 0.13;
    const baseR = Math.min(width, height) * 0.075;
    const r = baseR * (0.92 + pulse * 0.08);
    const glow = clamp(0.2 + vitality * 0.45) * dim;

    ctx.save();
    ctx.translate(x, y);

    // Soft halo — fades hard under heavy poison.
    const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 3.2);
    halo.addColorStop(
      0,
      `rgba(255, 214, 120, ${0.3 * glow * pulse})`
    );
    halo.addColorStop(
      0.45,
      `rgba(255, 196, 90, ${0.12 * glow})`
    );
    halo.addColorStop(1, "rgba(255, 196, 90, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Rays shrink/fade with poison.
    const rayAlpha = 0.18 * glow * pulse * clarity;
    if (rayAlpha > 0.02) {
      const rayCount = 10;
      ctx.strokeStyle = `rgba(255, 210, 110, ${rayAlpha})`;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.lineCap = "round";
      for (let i = 0; i < rayCount; i += 1) {
        const a =
          (i / rayCount) * Math.PI * 2 +
          time * 0.12;
        const inner = r * 1.25;
        const outer =
          r *
          (1.55 + clarity * 0.45 + Math.sin(time * 2 + i) * 0.14);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
    }

    // Core — shifts cooler/greyer as poison rises.
    const core = ctx.createRadialGradient(
      -r * 0.2,
      -r * 0.25,
      r * 0.1,
      0,
      0,
      r
    );
    const hot = lerpColor("#fff6d2", "#d8d2c4", poison * 0.85);
    const mid = lerpColor("#ffd56a", "#9a9488", poison * 0.9);
    const rim = lerpColor("#e8a83a", "#6a6560", poison * 0.95);
    core.addColorStop(0, hot);
    core.addColorStop(0.45, mid);
    core.addColorStop(1, rim);

    ctx.globalAlpha = (0.35 + glow * 0.5) * dim;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Clouds gather over the sun as Nafs grows.
    const cover = clamp((poison - 0.08) / 0.72);
    if (cover <= 0.01) return;

    const drift = Math.sin(time * 0.35) * (8 + cover * 10);
    const cloudColor = lerpColor(
      "#f2efe6",
      "#7a7670",
      poison * 0.75
    );
    const cloudShade = lerpColor(
      "#e4dfd4",
      "#5c5854",
      poison * 0.8
    );

    const puffs = [
      { x: -42, y: 6, s: 1.05, phase: 0.0, tint: cloudColor },
      { x: -8, y: -4, s: 1.25, phase: 1.1, tint: cloudShade },
      { x: 28, y: 8, s: 1.1, phase: 2.0, tint: cloudColor },
      { x: 52, y: -2, s: 0.9, phase: 2.7, tint: cloudShade },
      { x: -58, y: -10, s: 0.85, phase: 0.6, tint: cloudShade },
    ];

    const scaleBase = Math.min(width, height) / 280;

    puffs.forEach((puff, index) => {
      // Heavier Nafs → more puffs opaque and overlapping the disc.
      const show = clamp(cover * 1.35 - index * 0.12);
      if (show <= 0.02) return;

      const bob =
        Math.sin(time * 0.7 + puff.phase) * (2 + cover * 3);

      drawCloudPuff(
        ctx,
        x + puff.x * scaleBase + drift * (0.4 + index * 0.12),
        y + puff.y * scaleBase + bob,
        puff.s * scaleBase * (0.95 + cover * 0.35),
        show * (0.45 + poison * 0.5),
        puff.tint
      );
    });

    // Final veil so the sun almost vanishes at max poison.
    if (cover > 0.55) {
      ctx.save();
      const veil = ctx.createRadialGradient(
        x,
        y,
        r * 0.4,
        x,
        y,
        r * 4
      );
      const veilAlpha = (cover - 0.55) / 0.45;
      veil.addColorStop(
        0,
        `rgba(90, 88, 84, ${0.22 * veilAlpha})`
      );
      veil.addColorStop(1, "rgba(90, 88, 84, 0)");
      ctx.fillStyle = veil;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }


  // ============================================================
  // SEED
  // ============================================================

  function drawSeed(
    ctx,
    progress,
    vitality,
    colors
  ) {
    const appear =
      clamp(
        progress / 0.035
      );

    const disappear =
      clamp(
        1 -
        (progress - 0.045) /
        0.09
      );

    const alpha =
      appear *
      disappear;

    if (alpha <= 0.001) {
      return;
    }

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.translate(
      0,
      -4
    );

    const scale =
      0.7 +
      easeOutBack(
        appear
      ) *
      0.3;

    ctx.scale(
      scale,
      scale
    );

    ctx.fillStyle =
      lerpColor(
        colors.seed,
        colors.seedLight,
        vitality * 0.4
      );

    ctx.beginPath();

    ctx.ellipse(
      0,
      0,
      8.2,
      5.6,
      -0.15,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(210,180,120,0.55)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(-3, -1.2);

    ctx.quadraticCurveTo(
      0,
      -3.2,
      3,
      -1
    );

    ctx.stroke();

    ctx.restore();
  }


  // ============================================================
  // ROOT DRAWING
  // ============================================================

  function drawRoot(
    ctx,
    root,
    progress,
    time,
    colors,
    windStrength
  ) {
    const local =
      rootProgress(
        root,
        progress
      );

    if (local <= 0.001) {
      return;
    }

    const points =
      root.points;

    if (!points || points.length < 2) {
      return;
    }

    const metrics =
      root._metrics ||
      (
        root._metrics =
          getCurveMetrics(points)
      );

    const depth =
      Number(root.depth) || 0;

    const width =
      Math.max(
        0.45,
        root.width *
        (
          1 -
          depth * 0.22
        )
      );

    const wind =
      windStrength *
      (Number(root.windSensitivity) || 0.03);

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle =
      depth === 0
        ? colors.root
        : colors.rootLight;

    ctx.lineWidth =
      width *
      (1 - local * 0.15);

    ctx.globalAlpha =
      depth === 0
        ? 0.95
        : 0.72;

    ctx.beginPath();

    tracePolyline(
      ctx,
      points,
      metrics,
      local,
      wind,
      root,
      time
    );

    ctx.stroke();

    // Root highlight.
    if (depth <= 1) {
      ctx.strokeStyle =
        colors.trunkLight;

      ctx.globalAlpha =
        0.16;

      ctx.lineWidth =
        Math.max(
          0.4,
          width * 0.25
        );

      ctx.beginPath();

      tracePolyline(
        ctx,
        points,
        metrics,
        local,
        wind * 0.6,
        root,
        time
      );

      ctx.stroke();
    }

    ctx.restore();
  }


  // ============================================================
  // BRANCH DRAWING
  // ============================================================

  function drawBranch(
    ctx,
    branch,
    progress,
    time,
    colors,
    windStrength,
    tips,
    vitality,
    poison
  ) {
    const local =
      branchProgress(
        branch,
        progress
      );

    if (local <= 0.001) {
      return null;
    }

    // ----------------------------------------------------------
    // Parent attachment
    // ----------------------------------------------------------

    let start = {
      x: branch.startX,
      y: branch.startY,
    };

    let parentState = null;

    if (branch.parent != null) {
      parentState = tips.get(branch.parent);

      if (!parentState || !parentState.shiftedPoints) {
        return null;
      }

      const attachT = clamp(
        Number(branch.attachT) || 1
      );

      // Wait until the parent has grown to this fork.
      if (parentState.local < attachT * 0.9) {
        return null;
      }

      const attach = pointOnPolyline(
        parentState.shiftedPoints,
        parentState.shiftedMetrics,
        Math.min(parentState.local, attachT)
      );

      start = {
        x: attach.x,
        y: attach.y,
      };
    }

    // ----------------------------------------------------------
    // Geometry
    // ----------------------------------------------------------

    const points =
      branch.points;

    if (!points || points.length < 2) {
      return null;
    }

    const metrics =
      branch._metrics ||
      (
        branch._metrics =
          getCurveMetrics(points)
      );

    const depth =
      Number(branch.depth) || 0;

    const wind =
      getWindOffset(
        branch,
        progress,
        time,
        windStrength
      );

    // Offset generated geometry so children remain attached
    // to the live fork on the parent (not always the tip).
    // Bake wind into the polyline so tip / forks / stroke share one shape.
    const dx =
      start.x -
      branch.startX;

    const dy =
      start.y -
      branch.startY;

    let shiftedPoints = branch._shiftedPoints;
    if (!shiftedPoints || shiftedPoints.length !== points.length) {
      shiftedPoints = branch._shiftedPoints = new Array(points.length);
      for (let i = 0; i < points.length; i += 1) {
        shiftedPoints[i] = { x: 0, y: 0 };
      }
    }
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      shiftedPoints[i].x =
        p.x + dx + windXAtIndex(i, points.length, wind, branch, time);
      shiftedPoints[i].y = p.y + dy;
    }

    const shiftedMetrics =
      metrics;

    const tip =
      pointOnPolyline(
        shiftedPoints,
        shiftedMetrics,
        local
      );

    // ----------------------------------------------------------
    // Width
    // ----------------------------------------------------------

    const baseWidth =
      Math.max(
        0.65,
        Number(branch.width) || 1
      );

    const depthScale =
      Math.max(
        0.48,
        1 - depth * 0.075
      );

    const width =
      baseWidth *
      depthScale *
      (
        1 -
        local * 0.12
      );

    // ----------------------------------------------------------
    // Color — green sprout stem → brown wood by 20% progress
    // ----------------------------------------------------------

    let wood;

    if (depth === 0) {
      wood = colors.trunk;
    } else if (depth <= 2) {
      wood = lerpColor(
        colors.trunk,
        colors.branch,
        0.35
      );
    } else {
      wood = colors.branch;
    }

    const lignify = woodLignify(progress);

    const greenStem =
      depth === 0
        ? colors.stemGreen
        : depth <= 2
          ? lerpColor(
              colors.stemGreen,
              colors.stemGreenLight,
              0.45
            )
          : colors.stemGreenLight;

    // Live green sprout → brown wood, then rot toward dead bark if poison leads.
    let color = lerpColor(greenStem, wood, lignify);

    const rot = clamp(poison * 0.85 - vitality * 0.35);
    if (rot > 0.02) {
      color = lerpColor(
        color,
        depth === 0 ? colors.woodRotten : colors.woodRottenLight,
        easeInOutCubic(rot)
      );
    }

    const barkHighlight = lerpColor(
      colors.stemGreenHighlight,
      depth === 0
        ? colors.trunkHighlight
        : colors.branchLight,
      lignify
    );

    // ----------------------------------------------------------
    // Draw
    // ----------------------------------------------------------

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle =
      color;

    ctx.lineWidth =
      width;

    ctx.globalAlpha =
      0.96;

    ctx.beginPath();

    // Wind already baked into shiftedPoints — stroke the shared geometry.
    tracePolyline(
      ctx,
      shiftedPoints,
      shiftedMetrics,
      local,
      0,
      branch,
      time
    );

    ctx.stroke();

    // ----------------------------------------------------------
    // Secondary bark highlight
    // ----------------------------------------------------------

    if (
      depth <= 2 &&
      local > 0.18
    ) {
      ctx.strokeStyle = barkHighlight;

      ctx.globalAlpha =
        depth === 0
          ? 0.19
          : 0.12;

      ctx.lineWidth =
        Math.max(
          0.45,
          width * 0.23
        );

      ctx.beginPath();

      tracePolyline(
        ctx,
        shiftedPoints,
        shiftedMetrics,
        local,
        0,
        branch,
        time
      );

      ctx.stroke();
    }

    // ----------------------------------------------------------
    // Tiny branch-tip highlight
    // ----------------------------------------------------------

    if (
      depth >= 4 &&
      local > 0.75
    ) {
      ctx.fillStyle =
        colors.branchLight;

      ctx.globalAlpha =
        0.18;

      ctx.beginPath();

      ctx.arc(
        tip.x,
        tip.y,
        Math.max(
          0.5,
          width * 0.35
        ),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();

    const state = {
      tip,
      local,
      start,
      dx,
      dy,
      shiftedPoints,
      shiftedMetrics,
      sway: wind,
    };

    tips.set(
      branch.id,
      state
    );

    return state;
  }


  // ============================================================
  // LEAF CONDITION / REVEAL
  // ============================================================

  /**
   * Per-leaf sickness from Iman/Nafs balance + leaf variation.
   * Higher Nafs vs Iman → more likely diseased.
   */
  function getLeafCondition(leaf, vitality, poison) {
    const tint = Number(leaf.tint) || 0;
    const shape = Number(leaf.shape) || 0;
    const phase = Number(leaf.phase) || 0;

    const seed =
      typeof leaf.conditionSeed === "number"
        ? leaf.conditionSeed
        : (tint * 0.63 + shape * 0.21 + phase * 0.17) % 1;

    // Poison pulls toward disease; vitality pulls toward health.
    const spiritualBalance = poison - vitality;
    const variation = (seed - 0.5) * 0.22;

    return clamp(
      0.5 +
      spiritualBalance * 0.95 +
      variation
    );
  }

  /**
   * Leaves can start as soon as the twig begins forming.
   * branchProgress: 0 = no branch, 1 = fully grown.
   */
  function leafReveal(leaf, cluster, progress, branchProgress) {
    const clusterStart = Number(cluster.growthStart) || 0;
    const clusterEnd =
      Number(cluster.growthEnd) ||
      clusterStart + 0.12;

    const earlyPull =
      cluster.earlyPull != null
        ? Number(cluster.earlyPull)
        : 0.16;

    // Sprout clusters use earlyPull: 0 so they open right at growthStart (5%).
    const earlyStart = Math.max(0, clusterStart - earlyPull);
    const span = Math.max(0.08, clusterEnd - earlyStart);
    const raw = clamp((progress - earlyStart) / span);

    // Also gate on how far the parent branch has grown.
    const branchFactor = clamp(
      ((Number(branchProgress) || 0) - 0.05) / 0.45
    );

    const local = easeOutCubic(raw) * branchFactor;

    if (local <= 0) {
      return { local: 0, scale: 0, opacity: 0 };
    }

    // Soft unfold: 0 → 1.12 → 1
    let scale;
    if (local < 0.65) {
      scale = (local / 0.65) * 1.12;
    } else {
      scale = 1.12 - ((local - 0.65) / 0.35) * 0.12;
    }

    return {
      local,
      scale: Math.max(0, scale),
      opacity: local,
    };
  }


  // ============================================================
  // SINGLE LEAF
  // ============================================================

  function drawSingleLeaf(
    ctx,
    leaf,
    cluster,
    branch,
    branchState,
    progress,
    time,
    colors,
    vitality,
    poison,
    windStrength
  ) {
    if (!branchState || branchState.local < 0.2) {
      return;
    }

    const reveal = leafReveal(
      leaf,
      cluster,
      progress,
      branchState.local
    );

    if (reveal.opacity <= 0.01) {
      return;
    }

    // Follow the same parent-attachment shift + branch sway as the stroke.
    const dx = branchState.dx || 0;
    const dy = branchState.dy || 0;
    const along = Number(leaf.along ?? cluster.along ?? 0.9);
    const swayX = windXAtAlong(
      along,
      branchState.sway || 0,
      branch,
      time,
      branch.points?.length
    );

    const leafX = cluster.x + leaf.x + dx + swayX;
    const leafY = cluster.y + leaf.y + dy;

    const leafWind =
      Math.sin(time * 1.25 + (leaf.phase || 0)) *
      (0.035 + (cluster.windSensitivity || 0.5) * 0.045) *
      windStrength;

    const condition = getLeafCondition(leaf, vitality, poison);

    // Very early sprout stays greener; after ~8% health colors apply fully.
    const healthBlend = clamp((progress - 0.05) / 0.08);
    const leafPoison = lerp(
      Math.min(condition, 0.15),
      condition,
      healthBlend
    );
    const leafVitality = lerp(
      Math.max(vitality, 0.75),
      vitality,
      healthBlend
    );

    const fill = getLeafColor(
      colors,
      Number(leaf.tint) || 0,
      leafVitality,
      leafPoison
    );

    const baseWidth = 4.8 + (Number(leaf.shape) || 0) * 2.5;
    const baseHeight = 3.1 + (1 - (Number(leaf.shape) || 0)) * 1.7;
    const scale = reveal.scale * (leaf.scale || 1);

    ctx.save();

    ctx.translate(leafX, leafY);
    ctx.rotate((leaf.rotation || 0) + leafWind);
    ctx.scale(scale, scale * (leaf.stretch || 1));

    ctx.globalAlpha =
      reveal.opacity * (0.8 + vitality * 0.2);

    ctx.fillStyle = fill;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      baseWidth * 0.3,
      -baseHeight * 0.88,
      baseWidth * 0.82,
      -baseHeight * 0.42,
      baseWidth,
      0
    );
    ctx.bezierCurveTo(
      baseWidth * 0.82,
      baseHeight * 0.45,
      baseWidth * 0.28,
      baseHeight * 0.78,
      0,
      0
    );
    ctx.closePath();
    ctx.fill();

    if (vitality > 0.45 && leafPoison < 0.55) {
      ctx.strokeStyle = colors.leafHighlight;
      ctx.globalAlpha = reveal.opacity * 0.24 * vitality;
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.moveTo(0.3, 0);
      ctx.quadraticCurveTo(
        baseWidth * 0.46,
        -0.15,
        baseWidth * 0.88,
        0.02
      );
      ctx.stroke();
    }

    ctx.restore();
  }


  // ============================================================
  // LEAF CLUSTER
  // ============================================================

  function drawLeafCluster(
    ctx,
    cluster,
    branch,
    branchState,
    progress,
    time,
    colors,
    vitality,
    poison,
    windStrength
  ) {
    if (!branchState || branchState.local < 0.05) {
      return;
    }

    const clusterStart = Number(cluster.growthStart) || 0;
    const clusterEnd =
      Number(cluster.growthEnd) ||
      clusterStart + 0.12;

    const earlyPull =
      cluster.earlyPull != null
        ? Number(cluster.earlyPull)
        : 0.16;

    // Match leafReveal window so shadow shows with first leaves.
    const earlyStart = Math.max(0, clusterStart - earlyPull);
    const reveal = clamp(
      (progress - earlyStart) /
      Math.max(0.08, clusterEnd - earlyStart)
    );

    if (reveal <= 0) {
      return;
    }

    const shadowAlpha =
      easeOutCubic(reveal) * 0.07 * vitality;

    // Cluster shadow follows the shifted + swayed branch, same as leaves.
    const dx = branchState.dx || 0;
    const dy = branchState.dy || 0;
    const swayX = windXAtAlong(
      Number(cluster.along) || 0.9,
      branchState.sway || 0,
      branch,
      time,
      branch.points?.length
    );

    if (shadowAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      ctx.fillStyle = colors.deepShadow;
      ctx.beginPath();
      ctx.ellipse(
        cluster.x + dx + swayX + 2,
        cluster.y + dy + 3,
        (cluster.radius || 8) * 0.9,
        (cluster.radius || 8) * 0.55,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    if (!Array.isArray(cluster.leaves)) {
      return;
    }

    cluster.leaves.forEach((leaf) => {
      drawSingleLeaf(
        ctx,
        leaf,
        cluster,
        branch,
        branchState,
        progress,
        time,
        colors,
        vitality,
        poison,
        windStrength
      );
    });
  }


  // ============================================================
  // ATMOSPHERIC PARTICLES
  // ============================================================

  function drawParticles(
    ctx,
    particles,
    progress,
    time,
    colors,
    windStrength
  ) {
    if (
      !particles ||
      particles.length === 0 ||
      progress < 0.4
    ) {
      return;
    }

    const visibility =
      clamp(
        (progress - 0.4) /
        0.6
      );

    particles.forEach(
      (particle) => {
        const fall =
          (
            time *
            particle.speed
          ) % 190;

        const x =
          particle.x +
          Math.sin(
            time * 0.35 +
            particle.phase
          ) *
          particle.drift *
          windStrength;

        const y =
          particle.y -
          fall;

        ctx.save();

        ctx.globalAlpha =
          particle.opacity *
          visibility;

        ctx.fillStyle =
          colors.particle;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          particle.radius,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
      }
    );
  }


  // ============================================================
  // GLOW
  // ============================================================

  function drawGlow(
    ctx,
    progress,
    vitality,
    colors
  ) {
    if (
      progress < 0.5 ||
      vitality < 0.35
    ) {
      return;
    }

    const amount =
      clamp(
        (progress - 0.5) /
        0.5
      ) *
      vitality;

    ctx.save();

    const gradient =
      ctx.createRadialGradient(
        0,
        -90,
        8,
        0,
        -90,
        125
      );

    gradient.addColorStop(
      0,
      `rgba(255,230,160,${0.12 * amount})`
    );

    gradient.addColorStop(
      0.45,
      `rgba(190,230,140,${0.04 * amount})`
    );

    gradient.addColorStop(
      1,
      "rgba(255,230,160,0)"
    );

    ctx.fillStyle =
      gradient;

    ctx.beginPath();

    ctx.arc(
      0,
      -90,
      125,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }


  // ============================================================
  // CANOPY ATMOSPHERE
  // ============================================================

  function drawCanopyAmbientLight(
    ctx,
    model,
    progress,
    vitality
  ) {
    if (
      progress < 0.65 ||
      vitality < 0.45
    ) {
      return;
    }

    if (
      !model.bounds
    ) {
      return;
    }

    const width =
      model.bounds.maxX -
      model.bounds.minX;

    const height =
      model.bounds.maxY -
      model.bounds.minY;

    const radius =
      Math.max(
        width,
        height
      ) * 0.32;

    const centerX =
      (
        model.bounds.minX +
        model.bounds.maxX
      ) / 2;

    const centerY =
      model.bounds.minY +
      height * 0.38;

    const alpha =
      clamp(
        (progress - 0.65) /
        0.35
      ) *
      vitality *
      0.045;

    ctx.save();

    const gradient =
      ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );

    gradient.addColorStop(
      0,
      `rgba(200,235,130,${alpha})`
    );

    gradient.addColorStop(
      1,
      "rgba(200,235,130,0)"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      model.bounds.minX,
      model.bounds.minY,
      width,
      height
    );

    ctx.restore();
  }


  // ============================================================
  // MAIN RENDERER
  // ============================================================

  function renderTree(
    ctx,
    model,
    options = {}
  ) {
    if (
      !ctx ||
      !model
    ) {
      return;
    }

    const progress = clamp(
      Number.isFinite(Number(options.progress))
        ? Number(options.progress)
        : 0
    );

    const time = Number(options.time) || 0;

    const animated = options.animated !== false;

    const vitality = clamp(
      Number.isFinite(Number(options.vitality))
        ? Number(options.vitality)
        : 0.7
    );

    const poison = clamp(
      Number.isFinite(Number(options.poison))
        ? Number(options.poison)
        : 0.3
    );

    const windStrength =
      animated
        ? clamp(
            Number(
              options.windStrength
            ) || 1
          )
        : 0;

    const colors = {
      ...DEFAULT_COLORS,
      ...(options.colors || {}),
    };

    // ----------------------------------------------------------
    // Background atmospheric glow
    // ----------------------------------------------------------

    drawGlow(
      ctx,
      progress,
      vitality,
      colors
    );

    drawCanopyAmbientLight(
      ctx,
      model,
      progress,
      vitality
    );

    // ----------------------------------------------------------
    // Ground
    // ----------------------------------------------------------

    if (!options.skipSoil) {
      drawSoil(
        ctx,
        colors,
        vitality,
        progress
      );
    }

    // ----------------------------------------------------------
    // Seed
    // ----------------------------------------------------------

    drawSeed(
      ctx,
      progress,
      vitality,
      colors
    );

    // ----------------------------------------------------------
    // Roots
    // ----------------------------------------------------------

    const roots =
      Array.isArray(model.roots) ? model.roots : [];
    const orderedRoots = Array.isArray(model.orderedRoots)
      ? model.orderedRoots
      : roots
          .slice()
          .sort((a, b) => (a.depth || 0) - (b.depth || 0));

    orderedRoots.forEach((root) => {
      drawRoot(ctx, root, progress, time, colors, windStrength);
    });

    // ----------------------------------------------------------
    // Branches
    // ----------------------------------------------------------

    const branches =
      Array.isArray(model.branches) ? model.branches : [];
    const orderedBranches = Array.isArray(model.orderedBranches)
      ? model.orderedBranches
      : branches
          .slice()
          .sort(
            (a, b) =>
              (a.depth || 0) - (b.depth || 0) || a.id - b.id
          );

    const tips = new Map();

    orderedBranches.forEach((branch) => {
      drawBranch(
        ctx,
        branch,
        progress,
        time,
        colors,
        windStrength,
        tips,
        vitality,
        poison
      );
    });

    // ----------------------------------------------------------
    // Leaf clusters
    // ----------------------------------------------------------

    const clusters =
      Array.isArray(model.leafClusters) ? model.leafClusters : [];

    const branchesById =
      model.branchesById instanceof Map
        ? model.branchesById
        : new Map(branches.map((branch) => [branch.id, branch]));

    clusters.forEach(
      (cluster) => {
        const branch =
          branchesById.get(
            cluster.branchId
          );

        const branchState =
          tips.get(
            cluster.branchId
          );

        if (
          !branch ||
          !branchState
        ) {
          return;
        }

        drawLeafCluster(
          ctx,
          cluster,
          branch,
          branchState,
          progress,
          time,
          colors,
          vitality,
          poison,
          windStrength
        );
      }
    );

    // ----------------------------------------------------------
    // Particles
    // ----------------------------------------------------------

    drawParticles(
      ctx,
      model.particles || [],
      progress,
      time,
      colors,
      windStrength
    );
  }


  // ============================================================
  // PUBLIC API
  // ============================================================

  window.NAFS_treeRenderer = {
    DEFAULT_COLORS,

    clamp,

    lerp,

    easeOutCubic,

    easeInOutCubic,

    easeOutBack,

    branchProgress,

    rootProgress,

    renderTree,

    getLeafColor,

    pointOnPolyline,

    drawSun,

    drawFullBleedSoil,
  };

})();