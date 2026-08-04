/**
 * Seeded recursive oak-like tree for Nafs GrowingTree.
 * Deterministic: same seed → same structure.
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

    function attachLeaves(branch, kind) {
      // kind: "cotyledon" | "sprout" | "twig" | "canopy"
      let count = 1;
      let size = 1;
      if (kind === "cotyledon") {
        count = 2;
        size = 2.1;
      } else if (kind === "sprout") {
        count = 3 + Math.floor(rng() * 2);
        size = 1.55;
      } else if (kind === "twig") {
        count = 2 + Math.floor(rng() * 3);
        size = 1.15;
      } else {
        count = 2 + Math.floor(rng() * 2);
        size = 0.95;
      }

      for (let i = 0; i < count; i += 1) {
        const along = kind === "cotyledon" ? mix(rng, 0.62, 0.95) : mix(rng, 0.55, 1.0);
        const appearAt =
          kind === "cotyledon" || kind === "sprout"
            ? mix(rng, 0.32, 0.52)
            : mix(rng, 0.55, 0.85);
        leaves.push({
          id: leafId++,
          branchId: branch.id,
          kind,
          // Appear only after this branch itself has mostly extended.
          growthStart: branch.growthStart + (branch.growthEnd - branch.growthStart) * appearAt,
          growthEnd: Math.min(0.99, branch.growthEnd + mix(rng, 0.03, 0.1)),
          offset: along,
          side: i % 2 === 0 ? 1 : -1,
          lateral: mix(rng, kind === "cotyledon" ? 2.2 : 1.4, kind === "canopy" ? 4.2 : 3.4),
          rotation: branch.angle + mix(rng, -0.9, 0.9) + (i % 2 === 0 ? -0.4 : 0.4),
          scale: size * mix(rng, 0.8, 1.2),
          stretch: mix(rng, 0.85, 1.25),
          phase: rng() * Math.PI * 2,
          tint: rng(),
          shape: rng(), // slight oval variation
        });
      }
    }

    function grow(startX, startY, angle, length, width, depth, parentBranch) {
      if (depth > MAX_DEPTH || length < 7 || nextId > 280) return null;

      // Children begin only after the parent tip has mostly arrived.
      let growthStart = 0.03;
      let growthEnd = 0.22;
      if (parentBranch) {
        const parentSpan = parentBranch.growthEnd - parentBranch.growthStart;
        growthStart = parentBranch.growthStart + parentSpan * mix(rng, 0.72, 0.92);
        growthEnd = Math.min(0.92, growthStart + mix(rng, 0.1, 0.16) * (1 - depth * 0.04));
      } else {
        growthStart = 0.02;
        growthEnd = 0.28;
      }

      const branch = {
        id: nextId++,
        startX,
        startY,
        angle,
        length,
        width,
        depth,
        parent: parentBranch ? parentBranch.id : null,
        growthStart,
        growthEnd,
        // Organic kinks like the oak reference.
        bend: mix(rng, -0.22, 0.22) * (0.55 + depth * 0.18),
        kink: mix(rng, -0.16, 0.16),
        swayPhase: rng() * Math.PI * 2,
        swaySpeed: mix(rng, 0.5, 1.0),
      };
      branches.push(branch);

      const end = tip(startX, startY, angle + branch.kink * 0.35, length);
      mark(end.x, end.y);
      mark(startX, startY);

      // Leaves from the first sprout onward — denser higher up.
      if (depth === 0) {
        // Cotyledons / first leaflets near the top of the young stem.
        attachLeaves(branch, "cotyledon");
      } else if (depth === 1) {
        attachLeaves(branch, "sprout");
      } else if (depth >= 2 && depth <= 3) {
        if (rng() > 0.25) attachLeaves(branch, "twig");
      } else if (depth >= 4) {
        attachLeaves(branch, "canopy");
      }

      if (depth === MAX_DEPTH) return branch;

      const nextDepth = depth + 1;
      // Leader continuation — slightly off-axis for natural silhouette.
      grow(
        end.x,
        end.y,
        angle + mix(rng, -0.14, 0.14) + branch.kink * 0.2,
        length * mix(rng, depth < 2 ? 0.7 : 0.62, depth < 2 ? 0.84 : 0.78),
        width * mix(rng, 0.64, 0.78),
        nextDepth,
        branch
      );

      // Side limbs: trunk gets 2–3, then irregular pairs (oak-like, not mirrored).
      let sideCount = 0;
      if (depth === 0) sideCount = 2 + (rng() > 0.45 ? 1 : 0);
      else if (depth === 1) sideCount = rng() > 0.35 ? 2 : 1;
      else if (depth < 4) sideCount = rng() > 0.4 ? 2 : 1;
      else sideCount = rng() > 0.55 ? 1 : 0;

      const hand = rng() > 0.5 ? 1 : -1;
      for (let i = 0; i < sideCount; i += 1) {
        if (rng() < 0.08) continue;
        const dir = i % 2 === 0 ? hand : -hand;
        // Wider spread low, tighter twigs high — rounded canopy bias upward.
        const spreadBase = depth === 0 ? 0.55 : depth < 3 ? 0.45 : 0.7;
        const spread = mix(rng, spreadBase, spreadBase + 0.45);
        const upBias = depth >= 2 ? mix(rng, -0.25, -0.05) : mix(rng, -0.08, 0.12);
        grow(
          end.x,
          end.y,
          angle + dir * spread + upBias + mix(rng, -0.1, 0.1),
          length * mix(rng, depth === 0 ? 0.42 : 0.48, depth === 0 ? 0.68 : 0.72),
          width * mix(rng, 0.48, 0.66),
          nextDepth,
          branch
        );
      }

      return branch;
    }

    // Trunk: stout base, grows upward (-Y).
    grow(0, 0, -Math.PI / 2 + mix(rng, -0.03, 0.03), mix(rng, 108, 128), 15.5, 0, null);
    mark(0, 8);

    const particles = Array.from({ length: 14 }, () => ({
      x: mix(rng, -95, 95),
      y: mix(rng, -170, -20),
      radius: mix(rng, 0.5, 1.4),
      speed: mix(rng, 2.8, 7.5),
      drift: mix(rng, 1.5, 6),
      phase: rng() * Math.PI * 2,
      opacity: mix(rng, 0.06, 0.16),
    }));

    return { branches, leaves, particles, bounds, seed: Number(seed) || 1 };
  }

  window.NAFS_treeGenerator = { generateTree, createRng };
})();
