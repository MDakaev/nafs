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
    SEED: {
      start: 0.00,
      end: 0.035,
    },

    GERMINATION: {
      start: 0.025,
      end: 0.10,
    },

    SPROUT: {
      start: 0.075,
      end: 0.19,
    },

    SAPLING: {
      start: 0.16,
      end: 0.38,
    },

    YOUNG_TREE: {
      start: 0.32,
      end: 0.58,
    },

    DEVELOPING_CROWN: {
      start: 0.52,
      end: 0.78,
    },

    MATURE_TREE: {
      start: 0.72,
      end: 0.94,
    },

    FULL_TREE: {
      start: 0.90,
      end: 1.00,
    },
  };

  function getGrowthStage(progress) {
    progress = clamp(progress);

    if (progress < STAGES.GERMINATION.start) return "seed";
    if (progress < STAGES.SPROUT.start) return "germination";
    if (progress < STAGES.SAPLING.start) return "sprout";
    if (progress < STAGES.YOUNG_TREE.start) return "sapling";
    if (progress < STAGES.DEVELOPING_CROWN.start) return "youngTree";
    if (progress < STAGES.MATURE_TREE.start) return "developingCrown";
    if (progress < STAGES.FULL_TREE.start) return "matureTree";

    return "fullTree";
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
    depth
  ) {
    const points = [];

    const segments = depth <= 1 ? 8 : depth <= 3 ? 6 : 5;

    const normal = perpendicular(angle);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Main direction.
      const base = pointAt(
        startX,
        startY,
        angle,
        length * t
      );

      // Natural curvature.
      const curve =
        Math.sin(t * Math.PI) *
        bend *
        length;

      // Secondary irregularity.
      const irregular =
        Math.sin(t * Math.PI * 2 + kink) *
        kink *
        length *
        0.18;

      points.push({
        x:
          base.x +
          normal.x * (curve + irregular),

        y:
          base.y +
          normal.y * (curve + irregular),

        t,
      });
    }

    // Tiny natural perturbation except at endpoints.
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];

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

    function createLeafCluster(branch, density = 1) {
      if (leafClusters.length >= MAX_LEAF_CLUSTERS) {
        return;
      }

      const count =
        Math.max(
          4,
          Math.floor(
            mix(rng, 7, 15) * density
          )
        );

      const centerOffset =
        mix(rng, 0.72, 1.02);

      const center = pointOnCurve(
        branch.points,
        centerOffset
      );

      const cluster = {
        id: nextLeafId++,

        branchId: branch.id,

        x: center.x,
        y: center.y,

        radius: mix(rng, 7, 15),

        count,

        rotation:
          branch.angle +
          mix(rng, -0.5, 0.5),

        growthStart:
          branch.growthEnd +
          mix(rng, 0.015, 0.055),

        growthEnd:
          Math.min(
            1,
            branch.growthEnd +
              mix(rng, 0.08, 0.18)
          ),

        windSensitivity:
          mix(rng, 0.35, 0.8),

        phase:
          rng() * PI2,

        leaves: [],
      };

      for (let i = 0; i < count; i++) {
        const angle =
          (i / count) * PI2 +
          mix(rng, -0.35, 0.35);

        const radius =
          cluster.radius *
          mix(rng, 0.35, 1);

        cluster.leaves.push({
          x:
            Math.cos(angle) *
            radius,

          y:
            Math.sin(angle) *
            radius,

          rotation:
            angle +
            mix(rng, -0.6, 0.6),

          scale:
            mix(rng, 0.65, 1.25),

          stretch:
            mix(rng, 0.8, 1.3),

          phase:
            rng() * PI2,

          tint:
            rng(),

          shape:
            rng(),
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
      growthStart = 0.02,
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

      // Natural branch curvature.
      const bend =
        mix(rng, -0.26, 0.26) *
        (0.7 + depth * 0.12);

      const kink =
        mix(rng, -1, 1);

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

      const branchSpan =
        depth === 0
          ? 0.22
          : depth === 1
            ? 0.18
            : depth <= 3
              ? 0.14
              : 0.10;

      const growthEnd =
        Math.min(
          0.96,
          growthStart +
            branchSpan +
            mix(rng, -0.025, 0.04)
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

        points,

        curveLength:
          curveLength(points),

        growthStart,
        growthEnd,

        bend,
        kink,

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
        createLeafCluster(branch, 1.0);
        return branch;
      }

      // Main leader.
      const end =
        points[points.length - 1];

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

      const leaderWidth =
        width *
        mix(rng, 0.60, 0.76);

      const leaderStart =
        growthEnd -
        mix(rng, 0.025, 0.055);

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
      });

      // Side branches.
      let sideCount;

      if (depth === 0) {
        sideCount =
          3 +
          Math.floor(rng() * 3);
      } else if (depth === 1) {
        sideCount =
          2 +
          Math.floor(rng() * 2);
      } else if (depth === 2) {
        sideCount =
          1 +
          Math.floor(rng() * 3);
      } else if (depth <= 4) {
        sideCount =
          rng() > 0.3 ? 1 : 2;
      } else {
        sideCount =
          rng() > 0.65 ? 1 : 0;
      }

      // Some branches intentionally remain empty.
      if (depth >= 3 && rng() < 0.15) {
        sideCount = 0;
      }

      for (let i = 0; i < sideCount; i++) {
        if (branches.length >= MAX_BRANCHES) {
          break;
        }

        // Branches do not all emerge from the tip.
        const along =
          depth <= 1
            ? mix(rng, 0.42, 0.86)
            : mix(rng, 0.35, 0.9);

        const origin =
          pointOnCurve(
            points,
            along
          );

        // Alternating, but deliberately imperfect.
        const side =
          rng() > 0.5
            ? 1
            : -1;

        // Oak tends to spread laterally.
        const lateralAngle =
          depth === 0
            ? mix(rng, 0.58, 1.0)
            : depth === 1
              ? mix(rng, 0.48, 0.9)
              : depth <= 3
                ? mix(rng, 0.35, 0.85)
                : mix(rng, 0.25, 0.7);

        // Upward tendency becomes stronger toward canopy.
        const upwardBias =
          depth >= 2
            ? mix(rng, -0.22, -0.02)
            : mix(rng, -0.08, 0.10);

        const childAngle =
          angle +
          side * lateralAngle +
          upwardBias +
          mix(rng, -0.16, 0.16);

        const childLength =
          length *
          (
            depth === 0
              ? mix(rng, 0.42, 0.68)
              : depth === 1
                ? mix(rng, 0.42, 0.66)
                : depth <= 3
                  ? mix(rng, 0.38, 0.62)
                  : mix(rng, 0.32, 0.56)
          );

        const childWidth =
          width *
          mix(rng, 0.43, 0.66);

        const childStart =
          growthStart +
          (growthEnd - growthStart) *
            mix(rng, 0.52, 0.90);

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
        });
      }

      // Leaf clusters become progressively denser.
      if (depth >= 3) {
        const density =
          depth === 3
            ? 0.55
            : depth === 4
              ? 0.8
              : 1.0;

        if (rng() < 0.72) {
          createLeafCluster(
            branch,
            density
          );
        }
      }

      return branch;
    }

    // ----------------------------------------------------------
    // Main tree
    // ----------------------------------------------------------

    const trunkAngle =
      -Math.PI / 2 +
      mix(rng, -0.035, 0.035);

    createBranch({
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

      growthStart: 0.025,
    });

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