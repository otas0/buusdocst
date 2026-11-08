/**
 * Persist China Pages language (zh | en) across Entry / Install / Privacy.
 *
 * Load order (do not change casually):
 * - This file: synchronous in <head>, no defer/async — may location.replace before paint.
 * - reachability.js: defer at end of <body> — only runs after DOM parse; must not run on a
 *   page that is about to redirect, and must not rewrite language preference.
 *
 * Explicit 中文/EN uses data-china-lang and ?china_lang= on the href so a later click is not
 * bounced back by the mismatch redirect (click + sessionStorage alone can race).
 */
(function () {
  var KEY = "buusdocst-china-lang";
  var NAV_KEY = "buusdocst-china-lang-nav";
  var PAIRS = {
    "index.html": { zh: "index.html", en: "en.html" },
    "en.html": { zh: "index.html", en: "en.html" },
    "": { zh: "index.html", en: "en.html" },
    "install.html": { zh: "install.html", en: "install-en.html" },
    "install-en.html": { zh: "install.html", en: "install-en.html" },
    "privacy.html": { zh: "privacy.html", en: "privacy-en.html" },
    "privacy-en.html": { zh: "privacy.html", en: "privacy-en.html" }
  };

  function pageFile() {
    var path = location.pathname || "";
    var base = path.split("/").pop() || "";
    if (!base || base === "buusdocst") return "index.html";
    return base;
  }

  function pageLang(file) {
    return /-en\.html$/.test(file) || file === "en.html" ? "en" : "zh";
  }

  function readPref() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "en" || v === "zh" ? v : null;
    } catch (_) {
      return null;
    }
  }

  function writePref(lang) {
    if (lang !== "en" && lang !== "zh") return;
    try {
      localStorage.setItem(KEY, lang);
    } catch (_) {
      /* private mode */
    }
  }

  function counterpart(file, lang) {
    var pair = PAIRS[file];
    if (!pair) return null;
    return pair[lang] || null;
  }

  function rewriteHref(href, lang) {
    if (!href || href.charAt(0) === "#" || /^(https?:|mailto:)/i.test(href)) return href;
    var hash = "";
    var q = "";
    var path = href;
    var hashIdx = path.indexOf("#");
    if (hashIdx >= 0) {
      hash = path.slice(hashIdx);
      path = path.slice(0, hashIdx);
    }
    var qIdx = path.indexOf("?");
    if (qIdx >= 0) {
      q = path.slice(qIdx);
      path = path.slice(0, qIdx);
    }
    var name = path.split("/").pop() || "";
    if (!name || name === "." || name.indexOf(".") === -1) {
      name = "index.html";
    }
    if (!Object.prototype.hasOwnProperty.call(PAIRS, name)) return href;
    var target = counterpart(name, lang);
    if (!target || target === name) return href;
    var prefix = path.slice(0, path.length - name.length);
    return prefix + target + q + hash;
  }

  function rewriteInternalLinks(lang) {
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i += 1) {
      var a = anchors[i];
      if (a.hasAttribute("data-china-lang")) continue;
      if (a.closest && a.closest('[data-testid="china-lang-switch"]')) continue;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") continue;
      if (href.indexOf("./") !== 0) continue;
      var next = rewriteHref(href, lang);
      if (next !== href) a.setAttribute("href", next);
    }
  }

  function markLangSwitchClick(lang) {
    writePref(lang);
    try {
      sessionStorage.setItem(NAV_KEY, lang);
    } catch (_) {
      /* private mode */
    }
  }

  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var a = t.closest("a[data-china-lang]");
      if (!a) return;
      var lang = a.getAttribute("data-china-lang");
      if (lang === "en" || lang === "zh") markLangSwitchClick(lang);
    },
    true
  );

  var file = pageFile();
  if (!Object.prototype.hasOwnProperty.call(PAIRS, file)) {
    return;
  }

  var current = pageLang(file);
  var fromSwitch = null;

  try {
    var params = new URLSearchParams(location.search || "");
    var qLang = params.get("china_lang");
    if (qLang === "en" || qLang === "zh") {
      fromSwitch = qLang;
      writePref(qLang);
      params.delete("china_lang");
      var qs = params.toString();
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(
          null,
          "",
          location.pathname + (qs ? "?" + qs : "") + location.hash
        );
      }
    }
  } catch (_) {
    /* ignore */
  }

  if (!fromSwitch) {
    try {
      fromSwitch = sessionStorage.getItem(NAV_KEY);
      if (fromSwitch) sessionStorage.removeItem(NAV_KEY);
    } catch (_) {
      fromSwitch = null;
    }
  }

  var pref;
  if (fromSwitch === "en" || fromSwitch === "zh") {
    writePref(fromSwitch);
    pref = fromSwitch;
  } else {
    pref = readPref();
  }

  if (!pref) {
    writePref(current);
    pref = current;
  }

  if (!fromSwitch && pref !== current) {
    var dest = counterpart(file, pref);
    if (dest && dest !== file) {
      var next =
        location.pathname.replace(/[^/]*$/, dest) + location.search + location.hash;
      location.replace(next);
      return;
    }
  }

  writePref(current);

  function boot() {
    rewriteInternalLinks(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
