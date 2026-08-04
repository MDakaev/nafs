/**
 * GrowingTree — canvas controller for procedural growth animation.
 *
 * Usage:
 *   const tree = new GrowingTree({ canvas, progress: 0, seed: 12345, animated: true });
 *   tree.setProgress(0.75);
 *   tree.regenerate(98765);
 *   tree.destroy();
 */
(() => {
  "use strict";

  const generateTree = (...args) => window.NAFS_treeGenerator.generateTree(...args);
  const renderer = () => window.NAFS_treeRenderer;

  class GrowingTree {
    constructor(options = {}) {
      this.canvas = options.canvas;
      if (!this.canvas) throw new Error("GrowingTree requires a canvas element");

      this.ctx = this.canvas.getContext("2d");
      this.progress = renderer().clamp(options.progress ?? 0, 0, 1);
      this.seed = Number(options.seed) || 12345;
      this.animated = options.animated !== false;
      this.vitality = renderer().clamp(options.vitality ?? 0.7, 0, 1);
      this.poison = renderer().clamp(options.poison ?? 0.3, 0, 1);
      this.colors = options.colors || {};
      this.model = generateTree(this.seed);

      this._raf = 0;
      this._time = 0;
      this._lastTs = 0;
      this._disposed = false;
      this._width = 0;
      this._height = 0;

      this._onResize = () => this.resize();
      this._ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => this.resize())
          : null;

      if (this._ro) this._ro.observe(this.canvas.parentElement || this.canvas);
      else window.addEventListener("resize", this._onResize);

      this.resize();
      this._tick = this._tick.bind(this);
      this._raf = requestAnimationFrame(this._tick);
    }

    setProgress(value) {
      this.progress = renderer().clamp(value, 0, 1);
      if (!this.animated) this.draw();
    }

    setHealth(vitality, poison) {
      this.vitality = renderer().clamp(vitality ?? this.vitality, 0, 1);
      this.poison = renderer().clamp(poison ?? this.poison, 0, 1);
      if (!this.animated) this.draw();
    }

    regenerate(seed) {
      if (seed != null) this.seed = Number(seed) || 1;
      else this.seed = (this.seed * 1103515245 + 12345) >>> 0 || 1;
      this.model = generateTree(this.seed);
      this.draw();
      return this.seed;
    }

    resize(force = false) {
      if (this._disposed) return;
      const parent = this.canvas.parentElement || this.canvas;
      const cssW = Math.max(80, Math.round(parent.clientWidth || this.canvas.clientWidth || 300));
      const cssH = Math.max(60, Math.round(parent.clientHeight || this.canvas.clientHeight || 200));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      if (!force && cssW === this._width && cssH === this._height && this.canvas.width) {
        return;
      }

      this._width = cssW;
      this._height = cssH;
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }

    draw() {
      if (this._disposed || !this._width) return;
      const ctx = this.ctx;
      const w = this._width;
      const h = this._height;
      ctx.clearRect(0, 0, w, h);

      const b = this.model.bounds;
      const treeW = Math.max(40, b.maxX - b.minX);
      const treeH = Math.max(40, b.maxY - b.minY);
      const soilRoom = 16;
      const padX = 8;
      const padTop = 6;
      const padBottom = Math.min(14, Math.max(6, h * 0.06));
      // Always fit the whole silhouette; the strip is short, so height rules.
      const scale = Math.min(
        (w - padX * 2) / treeW,
        (h - padTop - padBottom - soilRoom) / treeH
      );
      const safeScale = Math.max(0.12, scale);

      ctx.save();
      ctx.translate(w / 2, h - padBottom);
      ctx.scale(safeScale, safeScale);
      renderer().renderTree(ctx, this.model, {
        progress: this.progress,
        time: this._time,
        animated: this.animated,
        vitality: this.vitality,
        poison: this.poison,
        colors: this.colors,
      });
      ctx.restore();
    }

    _tick(ts) {
      if (this._disposed) return;
      if (!this._lastTs) this._lastTs = ts;
      const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
      this._lastTs = ts;
      this._time += dt;
      // Layout changes during the focus animation; keep the canvas in sync.
      const parent = this.canvas.parentElement || this.canvas;
      if (parent.clientWidth !== this._width || parent.clientHeight !== this._height) {
        this.resize();
      } else {
        this.draw();
      }
      this._raf = requestAnimationFrame(this._tick);
    }

    destroy() {
      this._disposed = true;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._ro) this._ro.disconnect();
      else window.removeEventListener("resize", this._onResize);
    }
  }

  window.GrowingTree = GrowingTree;
})();
