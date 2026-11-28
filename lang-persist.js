/**
 * Persist China Pages language (zh | en) between notice pages only.
 *
 * Load: synchronous in <head> (before region-redirect.js).
 * When the tab is in temporary stay (?china_stay=1 / session), lang switch keeps china_stay=1.
 */
(function () {
  var KEY = "buusdocst-china-lang";
  var NAV_KEY = "buusdocst-china-lang-nav";
  var STAY_SESSION = "buusdocst-china-stay-session";
  var PAIRS = {
    "index.html": { zh: "index.html", en: "en.html" },
    "en.html": { zh: "index.html", en: "en.html" },
    "": { zh: "index.html", en: "en.html" }
  };

  function wantsStayParam() {
    try {
      if (new URLSearchParams(location.search || "").get("china_stay") === "1") return true;
    } catch (_) {}
    try {
      if (sessionStorage.getItem(STAY_SESSION) === "1") return true;
    } catch (_) {}
    return false;
  }

  function withStay(href) {
    if (!wantsStayParam() || !href) return href;
    try {
      var abs = new URL(href, location.href);
      if (abs.origin !== location.origin) return href;
      abs.searchParams.set("china_stay", "1");
      var file = abs.pathname.split("/").pop() || "index.html";
      var prefix = href.indexOf("./") === 0 || !/^\//.test(href) ? "./" : "";
      return prefix + file + abs.search + abs.hash;
    } catch (_) {
      if (/[?&]china_stay=/.test(href)) return href;
      return href + (href.indexOf("?") >= 0 ? "&" : "?") + "china_stay=1";
    }
  }

  function pageFile() {
    var path = location.pathname || "";
    var base = path.split("/").pop() || "";
    if (!base || base === "buusdocst") return "index.html";
    return base;
  }

  function pageLang(file) {
    return file === "en.html" ? "en" : "zh";
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
      if (wantsStayParam()) {
        var href = a.getAttribute("href");
        var next = withStay(href);
        if (next && next !== href) a.setAttribute("href", next);
      }
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
      var search = location.search || "";
      if (wantsStayParam()) {
        try {
          var sp = new URLSearchParams(search);
          sp.set("china_stay", "1");
          search = "?" + sp.toString();
        } catch (_) {
          if (!/[?&]china_stay=1/.test(search)) {
            search += (search.indexOf("?") >= 0 ? "&" : "?") + "china_stay=1";
          }
        }
      }
      var next = location.pathname.replace(/[^/]*$/, dest) + search + location.hash;
      location.replace(next);
      return;
    }
  }

  writePref(current);

  function boot() {
    rewriteInternalLinks(current);
    if (!wantsStayParam()) return;
    var switches = document.querySelectorAll("a[data-china-lang]");
    for (var i = 0; i < switches.length; i += 1) {
      var a = switches[i];
      var href = a.getAttribute("href");
      var nextHref = withStay(href);
      if (nextHref && nextHref !== href) a.setAttribute("href", nextHref);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
