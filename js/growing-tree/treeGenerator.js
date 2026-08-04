/**
 * NAFS GrowingTree v2
 * Procedural oak-like tree generator.
 *
 * Deterministic:
 * same seed -> same tree.
 *
 * Public API:
 *   window.NAFS_treeGenerator.generateTree(seed)
 */

(() => {
  "use strict";

  const MAX_DEPTH = 7;
  const MAX_BRANCHES = 520;
  const MAX_ROOTS = 90;
  const MAX_LEAF_CLUSTERS = 220;

  const PI2 = Math.PI * 2;

  // ------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mix(rng, min, max) {
    return min + (max - min) * rng();
  }

  function easeInOutCubic(t) {
    t = clamp(t);

    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    t = clamp(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= PI2;
    while (angle < -Math.PI) angle += PI2;
    return angle;
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function pointAt(x, y, angle, length) {
    return {
      x: x + Math.cos(angle) * length,
      y: y + Math.sin(angle) * length,
    };
  }

  function perpendicular(angle) {
    return {
      x: -Math.sin(angle),
      y: Math.cos(angle),
    };
  }

  // ------------------------------------------------------------
  // Seeded random
  // ------------------------------------------------------------

  function createRng(seed) {
    let value = (Number(seed) || 1) >>> 0;

    if (value === 0) value = 1;

    return () => {
      value += 0x6d2b79f5;

      let t = value;

      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------
  // Growth stages
  // ------------------------------------------------------------

  const STAGES = {
    SEED: { start: 0.0, end: 0.03 },
    // 1–10%: recognisable sprout
    SPROUT: { start: 0.01, end: 0.1 },
    // 10–20%: tiny but complete little tree
    MINI_TREE: { start: 0.1, end: 0.2 },
    // 20%+: size + canopy densification
    GROWING: { start: 0.2, end: 0.55 },
    CANOPY: { start: 0.45, end: 0.85 },
    MATURE: { start: 0.75, end: 1.0 },
  };

  function getGrowthStage(progress) {
    progress = clamp(progress);
    if (progress < STAGES.SPROUT.start) return "seed";
    if (progress < STAGES.MINI_TREE.start) return "sprout";
    if (progress < STAGES.GROWING.start) return "miniTree";
    if (progress < STAGES.CANOPY.start) return "growing";
    if (progress < STAGES.MATURE.start) return "canopy";
    return "mature";
  }

  /**
   * Growth windows so a sprout/mini-tree silhouette exists early,
   * then later progress densifies twigs + leaves.
   */
  function scheduleBranchGrowth(depth, role) {
    if (depth === 0) {
      return { start: 0.01, end: 0.07 };
    }
    if (depth === 1) {
      if (role === "leader") return { start: 0.045, end: 0.1 };
      return { start: 0.055, end: 0.11 };
    }
    if (depth === 2) {
      if (role === "leader") return { start: 0.085, end: 0.15 };
      return { start: 0.09, end: 0.16 };
    }
    if (depth === 3) {
      return { start: 0.12, end: 0.2 };
    }
    if (depth === 4) {
      return { start: 0.18, end: 0.38 };
    }
    if (depth === 5) {
      return { start: 0.3, end: 0.58 };
    }
    if (depth === 6) {
      return { start: 0.42, end: 0.78 };
    }
    return { start: 0.55, end: 0.92 };
  }

  // ------------------------------------------------------------
  // Geometry
  // ------------------------------------------------------------

  function createCurve(
    startX,
    startY,
    angle,
    length,
    bend,
    kink,
    rng,
    depth,
    options = {}
  ) {
    const points = [];

    const segments = depth <= 1 ? 10 : depth <= 3 ? 6 : 5;
    const normal = perpendicular(angle);

    // Trunk (and primary leaders) keep a straight base, then bend.
    const straightBase = clamp(
      options.straightBase != null
        ? options.straightBase
        : depth === 0
          ? 0.34
          : depth === 1
            ? 0.14
            : 0
    );

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      const base = pointAt(
        startX,
        startY,
        angle,
        length * t
      );

      // 0 along the straight footing; ease into full bend after that.
      let bendAmount = 0;
      if (t > straightBase && straightBase < 1) {
        const u = (t - straightBase) / (1 - straightBase);
        bendAmount = easeInOutCubic(u);
      } else if (straightBase <= 0) {
        bendAmount = Math.sin(t * Math.PI);
      }

      const curve = bendAmount * bend * length;

      const irregular =
        bendAmount *
        Math.sin(t * Math.PI * 2 + kink) *
        kink *
        length *
        0.18;

      points.push({
        x: base.x + normal.x * (curve + irregular),
        y: base.y + normal.y * (curve + irregular),
        t,
      });
    }

    // Tiny natural perturbation — never on the straight base footing.
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      if (p.t <= straightBase) continue;

      const amount =
        (1 - depth / (MAX_DEPTH + 1)) *
        length *
        0.006;

      p.x += mix(rng, -amount, amount);
      p.y += mix(rng, -amount, amount);
    }

    return points;
  }

  function curveLength(points) {
    let total = 0;

    for (let i = 1; i < points.length; i++) {
      total += distance(points[i - 1], points[i]);
    }

    return total;
  }

  function pointOnCurve(points, progress) {
    progress = clamp(progress);

    if (points.length === 0) {
      return { x: 0, y: 0 };
    }

    if (points.length === 1) {
      return points[0];
    }

    const target = curveLength(points) * progress;

    let travelled = 0;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];

      const segmentLength = distance(a, b);

      if (travelled + segmentLength >= target) {
        const local =
          segmentLength === 0
            ? 0
            : (target - travelled) / segmentLength;

        return {
          x: lerp(a.x, b.x, local),
          y: lerp(a.y, b.y, local),
        };
      }

      travelled += segmentLength;
    }

    return points[points.length - 1];
  }

  // ------------------------------------------------------------
  // Generator
  // ------------------------------------------------------------

  function generateTree(seed) {
    const rng = createRng(seed);

    const branches = [];
    const roots = [];
    const leafClusters = [];
    const particles = [];

    let nextBranchId = 0;
    let nextRootId = 0;
    let nextLeafId = 0;

    const bounds = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };

    function mark(x, y, padding = 0) {
      bounds.minX = Math.min(bounds.minX, x - padding);
      bounds.maxX = Math.max(bounds.maxX, x + padding);
      bounds.minY = Math.min(bounds.minY, y - padding);
      bounds.maxY = Math.max(bounds.maxY, y + padding);
    }

    // ----------------------------------------------------------
    // Root system
    // ----------------------------------------------------------

    function createRoot(
      startX,
      startY,
      angle,
      length,
      width,
      depth,
      parentId = null
    ) {
      if (roots.length >= MAX_ROOTS) return;

      if (length < 8) return;

      const bend =
        mix(rng, -0.28, 0.28) *
        (1 + depth * 0.18);

      const kink = mix(rng, -1, 1);

      const points = createCurve(
        startX,
        startY,
        angle,
        length,
        bend,
        kink,
        rng,
        depth
      );

      const root = {
        id: nextRootId++,

        type: depth === 0
          ? "taproot"
          : depth === 1
            ? "structural"
            : "fine",

        startX,
        startY,

        angle,

        length,

        width,

        depth,

        parent: parentId,

        points,

        curveLength: curveLength(points),

        growthStart:
          depth === 0
            ? 0.035
            : mix(rng, 0.055, 0.12),

        growthEnd:
          depth === 0
            ? 0.16
            : mix(rng, 0.12, 0.26),

        bend,

        windSensitivity:
          mix(rng, 0.02, 0.08),
      };

      roots.push(root);

      points.forEach((p) => mark(p.x, p.y, width));

      if (depth >= 2) return;

      const end = points[points.length - 1];

      const childCount =
        depth === 0
          ? 3 + Math.floor(rng() * 3)
          : 1 + Math.floor(rng() * 3);

      for (let i = 0; i < childCount; i++) {
        const direction =
          i % 2 === 0 ? 1 : -1;

        const childAngle =
          angle +
          direction *
            mix(rng, 0.35, 0.85) +
          mix(rng, -0.25, 0.25);

        createRoot(
          end.x,
          end.y,
          childAngle,
          length * mix(rng, 0.35, 0.62),
          width * mix(rng, 0.42, 0.62),
          depth + 1,
          root.id
        );
      }
    }

    // ----------------------------------------------------------
    // Leaf clusters
    // ----------------------------------------------------------

    function createLeafCluster(branch, density = 1, options = {}) {
      if (leafClusters.length >= MAX_LEAF_CLUSTERS) {
        return;
      }

      const count =
        options.count != null
          ? Math.max(1, options.count)
          : Math.max(
              4,
              Math.floor(mix(rng, 6, 12) * density)
            );

      // Cluster sits on the twig tip — never past the end of the curve.
      const centerAlong = clamp(
        options.centerAlong != null
          ? options.centerAlong
          : mix(rng, 0.78, 0.96)
      );
      const center = pointOnCurve(branch.points, centerAlong);

      // Tight radius so leaves hug the branch instead of floating in a cloud.
      const radius =
        (options.radius != null
          ? options.radius
          : mix(rng, 2.2, 4.8) * (0.75 + density * 0.35));
      const normal = perpendicular(branch.angle);

      const growthStart =
        options.growthStart != null
          ? options.growthStart
          : Math.min(
              0.92,
              branch.growthEnd * 0.92 + mix(rng, 0.01, 0.04)
            );

      const growthEnd =
        options.growthEnd != null
          ? options.growthEnd
          : Math.min(
              1,
              growthStart + mix(rng, 0.06, 0.14)
            );

      const cluster = {
        id: nextLeafId++,
        branchId: branch.id,
        x: center.x,
        y: center.y,
        along: centerAlong,
        radius,
        count,
        rotation: branch.angle + mix(rng, -0.4, 0.4),
        growthStart,
        growthEnd,
        // How early leaves may peek before growthStart (sprouts: 0).
        earlyPull:
          options.earlyPull != null
            ? options.earlyPull
            : 0.16,
        windSensitivity: mix(rng, 0.35, 0.8),
        phase: rng() * PI2,
        leaves: [],
      };

      const leafScale =
        options.leafScale != null
          ? options.leafScale
          : 1;

      for (let i = 0; i < count; i++) {
        // Each leaf is anchored to a point along the same branch spine.
        const along = clamp(
          centerAlong + mix(rng, -0.14, 0.06),
          0.4,
          0.99
        );
        const onBranch = pointOnCurve(branch.points, along);
        const side = mix(rng, -radius, radius);

        cluster.leaves.push({
          // Relative to cluster center; stays on / beside the twig.
          x: onBranch.x - center.x + normal.x * side,
          y: onBranch.y - center.y + normal.y * side,
          along,
          side,
          rotation:
            branch.angle +
            mix(rng, -0.7, 0.7) +
            (side >= 0 ? 0.15 : -0.15),
          scale: mix(rng, 0.7, 1.2) * leafScale,
          stretch: mix(rng, 0.85, 1.25),
          phase: rng() * PI2,
          tint: rng(),
          shape: rng(),
        });
      }

      leafClusters.push(cluster);
    }

    // ----------------------------------------------------------
    // Branch system
    // ----------------------------------------------------------

    function createBranch({
      startX,
      startY,
      angle,
      length,
      width,
      depth,
      parent,
      role = "branch",
      growthStart: growthStartHint = 0,
      attachT = null,
    }) {
      if (branches.length >= MAX_BRANCHES) {
        return null;
      }

      if (depth > MAX_DEPTH) {
        return null;
      }

      if (length < 6) {
        return null;
      }

      // Trunk bends later (after straight footing); twigs can curve sooner.
      const bend =
        depth === 0
          ? mix(rng, -0.2, 0.2)
          : mix(rng, -0.26, 0.26) * (0.7 + depth * 0.12);

      const kink = mix(rng, -1, 1);

      const straightBase =
        depth === 0 ? 0.34 : depth === 1 ? 0.14 : 0;

      const points = createCurve(
        startX,
        startY,
        angle,
        length,
        bend,
        kink,
        rng,
        depth,
        { straightBase }
      );

      const scheduled = scheduleBranchGrowth(depth, role);
      // Early silhouette schedule, but never before parent allows.
      const growthStart = Math.max(growthStartHint, scheduled.start);
      const growthEnd = Math.min(
        0.96,
        Math.max(growthStart + 0.035, scheduled.end + mix(rng, -0.015, 0.02))
      );

      const branch = {
        id: nextBranchId++,

        type:
          depth === 0
            ? "trunk"
            : depth === 1
              ? "primary"
              : depth <= 3
                ? "secondary"
                : "twig",

        role,

        startX,
        startY,

        angle,

        length,

        width,

        depth,

        parent:
          parent
            ? parent.id
            : null,

        // Where this branch attaches along its parent (0..1). Leaders = tip.
        attachT:
          parent
            ? attachT == null
              ? 1
              : clamp(attachT)
            : null,

        points,

        curveLength:
          curveLength(points),

        growthStart,
        growthEnd,

        bend,
        kink,
        straightBase,

        swayPhase:
          rng() * PI2,

        swaySpeed:
          mix(rng, 0.45, 1.05),

        swayAmount:
          depth === 0
            ? 0.004
            : depth === 1
              ? 0.009
              : depth <= 3
                ? 0.018
                : 0.032,

        taper:
          mix(rng, 0.55, 0.72),
      };

      branches.push(branch);

      points.forEach((p) => {
        mark(p.x, p.y, width);
      });

      // Stop recursion.
      if (depth >= MAX_DEPTH) {
        createLeafCluster(branch, 1.0, {
          growthStart: Math.max(0.16, growthEnd * 0.9),
          growthEnd: Math.min(1, growthEnd + 0.12),
        });
        return branch;
      }

      // Main leader.
      const end = points[points.length - 1];

      const leaderAngle =
        angle +
        mix(rng, -0.12, 0.12) +
        bend * 0.4;

      const leaderLength =
        length *
        (
          depth === 0
            ? mix(rng, 0.72, 0.84)
            : depth === 1
              ? mix(rng, 0.65, 0.78)
              : mix(rng, 0.58, 0.74)
        );

      const leaderWidth = width * mix(rng, 0.6, 0.76);

      const leaderSchedule = scheduleBranchGrowth(depth + 1, "leader");
      const leaderStart = Math.max(
        growthStart + (growthEnd - growthStart) * 0.55,
        leaderSchedule.start
      );

      createBranch({
        startX: end.x,
        startY: end.y,
        angle: leaderAngle,
        length: leaderLength,
        width: leaderWidth,
        depth: depth + 1,
        parent: branch,
        role: "leader",
        growthStart: leaderStart,
        attachT: 1,
      });

      // Side branches.
      let sideCount;

      if (depth === 0) {
        sideCount = 3 + Math.floor(rng() * 3);
      } else if (depth === 1) {
        sideCount = 2 + Math.floor(rng() * 2);
      } else if (depth === 2) {
        sideCount = 1 + Math.floor(rng() * 3);
      } else if (depth <= 4) {
        sideCount = rng() > 0.3 ? 1 : 2;
      } else {
        sideCount = rng() > 0.65 ? 1 : 0;
      }

      // Some branches intentionally remain empty.
      if (depth >= 3 && rng() < 0.15) {
        sideCount = 0;
      }

      for (let i = 0; i < sideCount; i++) {
        if (branches.length >= MAX_BRANCHES) {
          break;
        }

        // Side shoots emerge above the straight trunk footing.
        const minAlong =
          depth === 0
            ? 0.48
            : depth <= 1
              ? 0.38
              : 0.35;

        const along = mix(rng, minAlong, 0.9);
        const origin = pointOnCurve(points, along);
        const side = rng() > 0.5 ? 1 : -1;

        const lateralAngle =
          depth === 0
            ? mix(rng, 0.58, 1.0)
            : depth === 1
              ? mix(rng, 0.48, 0.9)
              : depth <= 3
                ? mix(rng, 0.35, 0.85)
                : mix(rng, 0.25, 0.7);

        const upwardBias =
          depth >= 2
            ? mix(rng, -0.22, -0.02)
            : mix(rng, -0.08, 0.1);

        const childAngle =
          angle +
          side * lateralAngle +
          upwardBias +
          mix(rng, -0.16, 0.16);

        let childLength;
        let childWidth;

        if (depth === 0) {
          // First laterals are thin sprout arms during 1–10%.
          childLength = length * mix(rng, 0.28, 0.46);
          childWidth = width * mix(rng, 0.18, 0.32);
        } else {
          childLength =
            length *
            (
              depth === 1
                ? mix(rng, 0.42, 0.66)
                : depth <= 3
                  ? mix(rng, 0.38, 0.62)
                  : mix(rng, 0.32, 0.56)
            );
          childWidth = width * mix(rng, 0.43, 0.66);
        }

        const sideSchedule = scheduleBranchGrowth(depth + 1, "side");
        const stagger =
          depth === 0 && sideCount > 1
            ? (i / (sideCount - 1)) * 0.035
            : i * mix(rng, 0.01, 0.025);

        const childStart = Math.max(
          growthStart + (growthEnd - growthStart) * mix(rng, 0.4, 0.7),
          sideSchedule.start + stagger
        );

        createBranch({
          startX: origin.x,
          startY: origin.y,
          angle: childAngle,
          length: childLength,
          width: childWidth,
          depth: depth + 1,
          parent: branch,
          role: "side",
          growthStart: childStart,
          attachT: along,
        });
      }

      // Leaves appear with the mini-tree (depth 2+), then densify later.
      if (depth === 2 && rng() < 0.7) {
        createLeafCluster(branch, 0.7, {
          count: 4 + Math.floor(rng() * 4),
          growthStart: Math.max(0.11, growthEnd * 0.85),
          growthEnd: Math.min(0.22, growthEnd + 0.08),
          earlyPull: 0.02,
          leafScale: mix(rng, 0.95, 1.2),
        });
      }

      if (depth >= 3) {
        const density =
          depth === 3
            ? 0.6
            : depth === 4
              ? 0.85
              : 1.0;

        if (rng() < 0.78) {
          createLeafCluster(branch, density, {
            growthStart: Math.max(
              depth <= 3 ? 0.14 : 0.22,
              growthEnd * 0.88
            ),
            growthEnd: Math.min(
              1,
              Math.max(growthEnd + 0.08, depth <= 3 ? 0.24 : growthEnd + 0.16)
            ),
          });
        }
      }

      return branch;
    }

    // ----------------------------------------------------------
    // Main tree
    // ----------------------------------------------------------

    // Trunk rises straight from soil; lean only appears after the footing.
    const trunkAngle = -Math.PI / 2;

    const trunk = createBranch({
      startX: 0,
      startY: 0,

      angle: trunkAngle,

      length:
        mix(rng, 112, 132),

      width:
        mix(rng, 15, 18),

      depth: 0,

      parent: null,

      role: "trunk",

      growthStart: 0.01,
    });

    // Sprout leaves (1–10%) — tiny plant tip foliage.
    if (trunk) {
      createLeafCluster(trunk, 0.95, {
        count: 3 + Math.floor(rng() * 3),
        centerAlong: mix(rng, 0.88, 0.98),
        radius: mix(rng, 3.2, 5.2),
        leafScale: mix(rng, 1.2, 1.55),
        growthStart: 0.035,
        growthEnd: 0.1,
        earlyPull: 0,
      });

      createLeafCluster(trunk, 0.7, {
        count: 2 + Math.floor(rng() * 3),
        centerAlong: mix(rng, 0.72, 0.88),
        radius: mix(rng, 2.6, 4.2),
        leafScale: mix(rng, 1.05, 1.3),
        growthStart: 0.055,
        growthEnd: 0.12,
        earlyPull: 0,
      });
    }

    // ----------------------------------------------------------
    // Roots
    // ----------------------------------------------------------

    const rootCount =
      5 +
      Math.floor(rng() * 4);

    for (let i = 0; i < rootCount; i++) {
      const angle =
        Math.PI / 2 +
        (i / rootCount - 0.5) *
          Math.PI *
          0.82 +
        mix(rng, -0.16, 0.16);

      createRoot(
        0,
        0,
        angle,
        mix(rng, 36, 58),
        mix(rng, 4.5, 7.5),
        0
      );
    }

    // ----------------------------------------------------------
    // Atmospheric particles
    // ----------------------------------------------------------

    for (let i = 0; i < 20; i++) {
      particles.push({
        x: mix(
          rng,
          bounds.minX - 30,
          bounds.maxX + 30
        ),

        y: mix(
          rng,
          bounds.minY,
          bounds.maxY
        ),

        radius:
          mix(rng, 0.4, 1.5),

        speed:
          mix(rng, 1.5, 5),

        drift:
          mix(rng, 2, 7),

        phase:
          rng() * PI2,

        opacity:
          mix(rng, 0.035, 0.14),
      });
    }

    // ----------------------------------------------------------
    // Metadata
    // ----------------------------------------------------------

    return {
      seed: Number(seed) || 1,

      branches,

      roots,

      leafClusters,

      particles,

      bounds,

      stages: STAGES,

      getGrowthStage,

      stats: {
        branches: branches.length,
        roots: roots.length,
        leafClusters: leafClusters.length,
      },

      // Renderer helper.
      helpers: {
        clamp,
        lerp,
        easeInOutCubic,
        easeOutCubic,
        pointOnCurve,
        normalizeAngle,
      },
    };
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  window.NAFS_treeGenerator = {
    generateTree,
    createRng,
    getGrowthStage,
    STAGES,
  };
})();