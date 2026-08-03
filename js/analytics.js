/**
 * Lightweight analytics wrapper around Yandex Metrika.
 * Safe no-op until NAFS_CONFIG.metrikaId is filled.
 */
(() => {
  "use strict";

  const id = String(window.NAFS_CONFIG?.metrikaId || "").trim();
  const enabled = Boolean(id);

  function reachGoal(name, params) {
    if (!enabled || typeof window.ym !== "function") return;
    try {
      window.ym(Number(id), "reachGoal", name, params || {});
    } catch {
      // ignore analytics errors
    }
  }

  function hit(url) {
    if (!enabled || typeof window.ym !== "function") return;
    try {
      window.ym(Number(id), "hit", url || location.href, {
        title: document.title,
        referer: document.referrer,
      });
    } catch {
      // ignore
    }
  }

  function params(data) {
    if (!enabled || typeof window.ym !== "function") return;
    try {
      window.ym(Number(id), "params", data || {});
    } catch {
      // ignore
    }
  }

  window.NAFS_analytics = {
    enabled,
    reachGoal,
    hit,
    params,
    /** Common product events */
    track(eventName, data) {
      reachGoal(eventName, data);
    },
  };

  if (!enabled) return;

  // Official Metrika bootstrap
  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    ((k = e.createElement(t)), (a = e.getElementsByTagName(t)[0]));
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=" + id, "ym");

  // Matches official Metrika snippet options from the counter dashboard.
  window.ym(Number(id), "init", {
    ssr: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
    webvisor: false,
  });

  // First paint context
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  params({
    standalone: standalone ? "yes" : "no",
    lang: document.documentElement.lang || "ru",
  });
})();
