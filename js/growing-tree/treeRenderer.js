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

  function parseHex(hex) {
    if (!hex || typeof hex !== "string") {
      return [128, 128, 128];
    }

    const value = hex.replace("#", "");

    if (value.length !== 6) {
      return [128, 128, 128];
    }

    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  function lerpColor(a, b, t) {
    if (
      typeof a !== "string" ||
      typeof b !== "string" ||
      !a.startsWith("#") ||
      !b.startsWith("#")
    ) {
      return t < 0.5 ? a : b;
    }

    const A = parseHex(a);
    const B = parseHex(b);

    const amount = clamp(t);

    return `rgb(
      ${Math.round(A[0] + (B[0] - A[0]) * amount)},
      ${Math.round(A[1] + (B[1] - A[1]) * amount)},
      ${Math.round(A[2] + (B[2] - A[2]) * amount)}
    )`;
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
    const healthyBase = lerpColor(
      colors.leafDark,
      colors.leaf,
      tint
    );

    const healthyBright = lerpColor(
      healthyBase,
      colors.leafLime,
      clamp(
        vitality * 0.55 +
        tint * 0.2
      )
    );

    const healthy = lerpColor(
      healthyBright,
      colors.leafHighlight,
      clamp(vitality - 0.45) * 0.7
    );

    poison = clamp(poison);

    if (poison < 0.28) {
      return lerpColor(
        healthy,
        colors.leafHighlight,
        vitality * 0.25
      );
    }

    if (poison < 0.55) {
      return lerpColor(
        healthy,
        colors.leafDry,
        (poison - 0.28) / 0.27
      );
    }

    if (poison < 0.78) {
      return lerpColor(
        colors.leafDry,
        colors.leafAutumn,
        (poison - 0.55) / 0.23
      );
    }

    return lerpColor(
      colors.leafAutumn,
      colors.leafDead,
      (poison - 0.78) / 0.22
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

    const target =
      metrics.total * p;

    let travelled = 0;

    ctx.moveTo(
      points[0].x,
      points[0].y
    );

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];

      const segment =
        metrics.lengths[i - 1];

      if (
        travelled + segment <= target
      ) {
        const wa =
          Math.sin(
            time * 0.7 +
            (branch.swayPhase || 0) +
            i * 0.4
          ) *
          wind *
          (i / points.length);

        ctx.lineTo(
          a.x + wa,
          a.y
        );

        ctx.lineTo(
          b.x + wa,
          b.y
        );

        travelled += segment;
        continue;
      }

      const remaining =
        target - travelled;

      const local =
        segment <= 0
          ? 0
          : clamp(
              remaining / segment
            );

      const wa =
        Math.sin(
          time * 0.7 +
          (branch.swayPhase || 0) +
          i * 0.4
        ) *
        wind *
        (i / points.length);

      ctx.lineTo(
        lerp(a.x, b.x, local) + wa,
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
    tips
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

    if (branch.parent != null) {
      const parent =
        tips.get(branch.parent);

      if (!parent) {
        return null;
      }

      // Branches start after their parent has mostly formed.
      if (parent.local < 0.72) {
        return null;
      }

      start = {
        x: parent.tip.x,
        y: parent.tip.y,
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

    // ----------------------------------------------------------
    // Find current tip.
    // ----------------------------------------------------------

    const grownTip =
      pointOnPolyline(
        points,
        metrics,
        local
      );

    // Offset generated geometry so children remain attached
    // to the actual parent tip.
    const dx =
      start.x -
      branch.startX;

    const dy =
      start.y -
      branch.startY;

    const shiftedPoints =
      points.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));

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
    // Color
    // ----------------------------------------------------------

    let color;

    if (depth === 0) {
      color = colors.trunk;
    } else if (depth <= 2) {
      color =
        lerpColor(
          colors.trunk,
          colors.branch,
          0.35
        );
    } else {
      color = colors.branch;
    }

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

    tracePolyline(
      ctx,
      shiftedPoints,
      shiftedMetrics,
      local,
      wind,
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
      ctx.strokeStyle =
        depth === 0
          ? colors.trunkHighlight
          : colors.branchLight;

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
        wind * 0.7,
        branch,
        time + 0.15
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
      sway: wind,
    };

    tips.set(
      branch.id,
      state
    );

    return state;
  }


  // ============================================================
  // LEAF REVEAL
  // ============================================================

  function leafReveal(
    leaf,
    cluster,
    progress
  ) {
    const start =
      Number(
        cluster.growthStart
      ) || 0;

    const end =
      Number(
        cluster.growthEnd
      ) ||
      start + 0.12;

    const span =
      Math.max(
        0.0001,
        end - start
      );

    const raw =
      clamp(
        (progress - start) /
        span
      );

    const local =
      easeOutCubic(raw);

    // Small botanical "unfold".
    let scale;

    if (local < 0.65) {
      scale =
        (local / 0.65) *
        1.12;
    } else {
      scale =
        1.12 -
        (
          (local - 0.65) /
          0.35
        ) *
        0.12;
    }

    return {
      local,
      scale: Math.max(
        0,
        scale
      ),
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
    if (
      !branchState ||
      branchState.local < 0.2
    ) {
      return;
    }

    const reveal =
  leafReveal(
    leaf,
    cluster,
    progress,
    branchState.local
  );

    if (
      reveal.opacity <= 0.01
    ) {
      return;
    }

    // ----------------------------------------------------------
    // Cluster position
    // ----------------------------------------------------------

    const clusterX =
      cluster.x;

    const clusterY =
      cluster.y;

    const leafX =
      clusterX +
      leaf.x;

    const leafY =
      clusterY +
      leaf.y;

    // ----------------------------------------------------------
    // Wind
    // ----------------------------------------------------------

    const leafWind =
      Math.sin(
        time * 1.25 +
        leaf.phase
      ) *
      (
        0.035 +
        (cluster.windSensitivity || 0.5) *
        0.045
      ) *
      windStrength;

    // ----------------------------------------------------------
    // Color
    // ----------------------------------------------------------

    function getLeafCondition(
  leaf,
  cluster,
  vitality,
  poison
) {
  const seed =
    typeof leaf.conditionSeed === "number"
      ? leaf.conditionSeed
      : (
          leaf.tint * 0.63 +
          leaf.shape * 0.21 +
          (leaf.phase || 0) * 0.17
        ) % 1;

  /*
   * Чем выше Nafs относительно Iman,
   * тем больше вероятность болезни.
   */
  const spiritualBalance =
    poison - vitality;

  /*
   * Индивидуальная случайность.
   */
  const variation =
    (seed - 0.5) * 0.38;

  return clamp(
    0.5 +
    spiritualBalance * 0.72 +
    variation
  );
}

    // ----------------------------------------------------------
    // Shape
    // ----------------------------------------------------------

    const baseWidth =
      4.8 +
      leaf.shape * 2.5;

    const baseHeight =
      3.1 +
      (1 - leaf.shape) * 1.7;

    const scale =
      reveal.scale *
      (leaf.scale || 1);

    ctx.save();

    ctx.translate(
      leafX,
      leafY
    );

    ctx.rotate(
      (leaf.rotation || 0) +
      leafWind
    );

    ctx.scale(
      scale,
      scale *
      (leaf.stretch || 1)
    );

    ctx.globalAlpha =
      reveal.opacity *
      (
        0.80 +
        vitality * 0.20
      );

    ctx.fillStyle =
      fill;

    // ----------------------------------------------------------
    // Leaf body
    // ----------------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
      0,
      0
    );

    ctx.bezierCurveTo(
      baseWidth * 0.30,
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

    // ----------------------------------------------------------
    // Leaf vein
    // ----------------------------------------------------------

    if (
      vitality > 0.45 &&
      poison < 0.55
    ) {
      ctx.strokeStyle =
        colors.leafHighlight;

      ctx.globalAlpha =
        reveal.opacity *
        0.24 *
        vitality;

      ctx.lineWidth =
        0.42;

      ctx.beginPath();

      ctx.moveTo(
        0.3,
        0
      );

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
    if (
      !branchState ||
      branchState.local < 0.05
    ) {
      return;
    }

    const reveal =
      clamp(
        (
          progress -
          cluster.growthStart
        ) /
        Math.max(
          0.0001,
          cluster.growthEnd -
          cluster.growthStart
        )
      );

    if (reveal <= 0) {
      return;
    }

    // ----------------------------------------------------------
    // Cluster shadow
    // ----------------------------------------------------------

    const shadowAlpha =
      easeOutCubic(
        reveal
      ) *
      0.07 *
      vitality;

    if (shadowAlpha > 0.001) {
      ctx.save();

      ctx.globalAlpha =
        shadowAlpha;

      ctx.fillStyle =
        colors.deepShadow;

      ctx.beginPath();

      ctx.ellipse(
        cluster.x + 2,
        cluster.y + 3,
        cluster.radius * 0.9,
        cluster.radius * 0.55,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }

    // ----------------------------------------------------------
    // Leaves
    // ----------------------------------------------------------

    if (
      Array.isArray(
        cluster.leaves
      )
    ) {
      cluster.leaves.forEach(
        (leaf) => {
          function leafReveal(
  leaf,
  cluster,
  progress,
  branchProgress
) {
  /*
   * Листья начинают появляться уже тогда,
   * когда веточка только начинает формироваться.
   *
   * branchProgress:
   * 0    = ветки нет
   * 1    = ветка полностью выросла
   */

  const clusterStart =
    Number(cluster.growthStart) || 0;

  const clusterEnd =
    Number(cluster.growthEnd) ||
    clusterStart + 0.12;

  /*
   * Не ждём полного роста ветки.
   *
   * Чем раньше появляется ветка,
   * тем раньше может начать раскрываться лист.
   */
  const earlyStart =
    Math.max(
      0,
      clusterStart - 0.16
    );

  const span =
    Math.max(
      0.08,
      clusterEnd - earlyStart
    );

  const raw =
    clamp(
      (progress - earlyStart) /
      span
    );

  /*
   * Дополнительно ограничиваем появление
   * текущим ростом самой ветки.
   */
  const branchFactor =
    clamp(
      (branchProgress - 0.05) /
      0.45
    );

  const local =
    easeOutCubic(
      raw
    ) *
    branchFactor;

  if (local <= 0) {
    return {
      local: 0,
      scale: 0,
      opacity: 0,
    };
  }

  /*
   * Маленький "раскрывшийся" лист:
   *
   * 0 → 1.12 → 1
   */
  let scale;

  if (local < 0.65) {
    scale =
      (local / 0.65) *
      1.12;
  } else {
    scale =
      1.12 -
      (
        (local - 0.65) /
        0.35
      ) *
      0.12;
  }

  return {
    local,
    scale: Math.max(0, scale),
    opacity: local,
  };
}
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
        }
      );
    }
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

    const progress =
      clamp(
        Number(
          options.progress
        ) || 0
      );

    const time =
      Number(
        options.time
      ) || 0;

    const animated =
      options.animated !== false;

    const vitality =
      clamp(
        Number(
          options.vitality
        ) || 0
      );

    const poison =
      clamp(
        Number(
          options.poison
        ) || 0
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

    drawSoil(
      ctx,
      colors,
      vitality,
      progress
    );

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
      Array.isArray(
        model.roots
      )
        ? model.roots
        : [];

    const orderedRoots =
      roots
        .slice()
        .sort(
          (a, b) =>
            (a.depth || 0) -
            (b.depth || 0)
        );

    orderedRoots.forEach(
      (root) => {
        drawRoot(
          ctx,
          root,
          progress,
          time,
          colors,
          windStrength
        );
      }
    );

    // ----------------------------------------------------------
    // Branches
    // ----------------------------------------------------------

    const branches =
      Array.isArray(
        model.branches
      )
        ? model.branches
        : [];

    const orderedBranches =
      branches
        .slice()
        .sort(
          (a, b) =>
            (a.depth || 0) -
              (b.depth || 0) ||
            a.id - b.id
        );

    const tips =
      new Map();

    orderedBranches.forEach(
      (branch) => {
        drawBranch(
          ctx,
          branch,
          progress,
          time,
          colors,
          windStrength,
          tips
        );
      }
    );

    // ----------------------------------------------------------
    // Leaf clusters
    // ----------------------------------------------------------

    const clusters =
      Array.isArray(
        model.leafClusters
      )
        ? model.leafClusters
        : [];

    const branchesById =
      new Map(
        branches.map(
          (branch) => [
            branch.id,
            branch,
          ]
        )
      );

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
  };

})();