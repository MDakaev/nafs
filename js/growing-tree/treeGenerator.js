/**
 * Seeded recursive tree structure for Nafs GrowingTree.
 * Deterministic: same seed → same branches/leaves.
 */
(() => {
  "use strict";

  const MAX_DEPTH = 6;

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

  function mix(rng, min, max) {
    return min + (max - min) * rng();
  }

  function tip(x, y, angle, length) {
    return {
      x: x + Math.cos(angle) * length,
      y: y + Math.sin(angle) * length,
    };
  }

  /**
   * Generate a full tree model in unit space around origin.
   * Trunk grows upward (negative Y in local space before canvas flip).
   */
  function generateTree(seed) {
    const rng = createRng(seed);
    const branches = [];
    const leaves = [];
    let nextId = 0;
    let leafId = 0;

    const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const mark = (x, y) => {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    };

    function attachLeaves(branch) {
      const count = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i += 1) {
        leaves.push({
          id: leafId++,
          branchId: branch.id,
          rotation: branch.angle + mix(rng, -1.2, 1.2),
          scale: mix(rng, 0.62, 1.22) * (1 - branch.depth * 0.03),
          stretch: mix(rng, 0.75, 1.28),
          side: rng() > 0.5 ? 1 : -1,
          offset: mix(rng, 0.7, 1.02),
          delay: mix(rng, 0.01, 0.1),
          phase: rng() * Math.PI * 2,
          tint: rng(),
          growthStart: Math.min(0.98, branch.growthEnd + mix(rng, 0.02, 0.11)),
        });
      }
    }

    function grow(startX, startY, angle, length, width, depth, parent) {
      if (depth > MAX_DEPTH || length < 6.5 || nextId > 340) return;

      const growthStart =
        depth === 0 ? 0.02 : Math.max(0.08, 0.28 + depth * 0.09 + mix(rng, -0.03, 0.03));
      const span = depth === 0 ? 0.36 : mix(rng, 0.11, 0.18) - depth * 0.005;
      const branch = {
        id: nextId++,
        startX,
        startY,
        angle,
        length,
        width,
        depth,
        parent: parent == null ? null : parent,
        growthStart,
        growthEnd: Math.min(0.86, growthStart + span),
        bend: mix(rng, -0.14, 0.14) * (1 + depth * 0.12),
        swayPhase: rng() * Math.PI * 2,
        swaySpeed: mix(rng, 0.55, 1.05),
      };
      branches.push(branch);

      const end = tip(startX, startY, angle, length);
      mark(end.x, end.y);

      if (depth >= 4) attachLeaves(branch);
      if (depth === MAX_DEPTH) return;

      const nextDepth = depth + 1;
      // Soft continuation of the main axis.
      grow(
        end.x,
        end.y,
        angle + mix(rng, -0.18, 0.18) * (0.5 + depth * 0.08),
        length * mix(rng, 0.66, 0.82),
        width * mix(rng, 0.62, 0.76),
        nextDepth,
        branch.id
      );

      const sideBudget =
        depth === 0 ? 2 + Math.floor(rng() * 2) : rng() < 0.58 - depth * 0.03 ? 2 : 1;
      const hand = rng() > 0.5 ? 1 : -1;
      for (let i = 0; i < sideBudget; i += 1) {
        if (rng() < 0.07 + depth * 0.03) continue;
        const dir = i % 2 === 0 ? hand : -hand;
        const spread = mix(rng, 0.36, depth < 2 ? 0.86 : 1.05);
        grow(
          end.x,
          end.y,
          angle + dir * spread + mix(rng, -0.12, 0.12),
          length * mix(rng, depth === 0 ? 0.46 : 0.5, 0.74),
          width * mix(rng, 0.46, 0.66),
          nextDepth,
          branch.id
        );
      }
    }

    // Local coordinates: origin at soil, negative Y is up.
    grow(0, 0, -Math.PI / 2 + mix(rng, -0.04, 0.04), mix(rng, 118, 142), 13.5, 0, null);
    mark(0, 0);

    const particles = Array.from({ length: 18 }, () => ({
      x: mix(rng, -110, 110),
      y: mix(rng, -190, -12),
      radius: mix(rng, 0.55, 1.65),
      speed: mix(rng, 3.2, 9.5),
      drift: mix(rng, 1.8, 8),
      phase: rng() * Math.PI * 2,
      opacity: mix(rng, 0.07, 0.2),
    }));

    return { branches, leaves, particles, bounds, seed: Number(seed) || 1 };
  }

  window.NAFS_treeGenerator = { generateTree, createRng };
})();
