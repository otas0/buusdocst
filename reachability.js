/**
 * Read-only Workers reachability probe for the China entry.
 * Does not call /api/check — only GET /api/health with a short timeout.
 *
 * Load order: lang-persist.js is sync in <head> (may redirect). This file is
 * defer at end of <body> — never move it before lang-persist or give it defer:false
 * in head, or a bounce redirect can race the health fetch / CTA wiring.
 */
(function () {
  const WORKERS_ORIGIN = "https://buusdocst.mtsu.workers.dev";
  const HEALTH = WORKERS_ORIGIN + "/api/health";
  const TIMEOUT_MS = 6000;
  const EXPECTED_SERVICE = "buusdocst";

  const el = document.getElementById("workers-reach");
  if (!el) return;

  const status = el.querySelector("[data-reach-status]");
  const detail = el.querySelector("[data-reach-detail]");
  if (!status || !detail) return;

  /**
   * @param {"checking"|"ok"|"fail"|"soft-fail"} state
   */
  function setFullCheckCta(state) {
    const links = document.querySelectorAll("[data-full-check]");
    for (let i = 0; i < links.length; i += 1) {
      const a = links[i];
      if (state === "ok") {
        a.classList.add("primary-button");
        a.classList.remove("ghost-button", "is-disabled");
        a.removeAttribute("aria-disabled");
        a.tabIndex = 0;
      } else if (state === "fail" || state === "soft-fail") {
        a.classList.remove("primary-button", "is-disabled");
        a.classList.add("ghost-button");
        a.removeAttribute("aria-disabled");
        a.tabIndex = 0;
      } else {
        // checking — keep visual primary but block activation
        a.classList.add("primary-button", "is-disabled");
        a.classList.remove("ghost-button");
        a.setAttribute("aria-disabled", "true");
        a.tabIndex = -1;
      }
    }
  }

  function onFullCheckClick(ev) {
    const a = ev.currentTarget;
    if (a.getAttribute("aria-disabled") === "true" || a.classList.contains("is-disabled")) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  const linksInit = document.querySelectorAll("[data-full-check]");
  for (let i = 0; i < linksInit.length; i += 1) {
    linksInit[i].addEventListener("click", onFullCheckClick);
  }

  const copy =
    document.documentElement.lang === "en"
      ? {
          checking: "Checking Workers…",
          ok: "Workers reachable",
          fail: "Workers unreachable from this network",
          softFail: "Workers reachable — unexpected service",
          okDetail: "Health OK — you can open the full check.",
          failDetail:
            "Timeout or error — use this page for privacy / install; retry the full check when the network allows.",
          softFailDetail:
            "Health answered but service is not buusdocst — do not treat as product OK. Prefer this China entry until the canonical Worker responds.",
        }
      : {
          checking: "正在探测 Workers…",
          ok: "Workers 可达",
          fail: "当前网络无法到达 Workers",
          softFail: "Workers 可达，但 service 异常",
          okDetail: "健康检查通过 — 可打开完整检查。",
          failDetail:
            "超时或失败 — 请先用本页查看隐私 / 安装说明；网络允许时再打开完整检查。",
          softFailDetail:
            "健康接口有响应，但 service 不是 buusdocst — 请勿当作产品正常。请先用本页说明/隐私/安装，待规范 Worker 恢复后再完整检查。",
        };

  status.textContent = copy.checking;
  el.dataset.state = "checking";
  detail.textContent = "";
  setFullCheckCta("checking");

  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(function () {
    ctrl.abort();
  }, TIMEOUT_MS);

  fetch(HEALTH, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal: ctrl.signal,
    headers: { Accept: "application/json" },
  })
    .then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      const ms = Math.round(performance.now() - started);
      if (data && data.ok === true && data.service === EXPECTED_SERVICE) {
        el.dataset.state = "ok";
        status.textContent = copy.ok;
        detail.textContent = copy.okDetail + " (" + ms + " ms)";
        setFullCheckCta("ok");
        return;
      }
      if (data && data.ok === true && data.service && data.service !== EXPECTED_SERVICE) {
        el.dataset.state = "soft-fail";
        status.textContent = copy.softFail;
        detail.textContent =
          copy.softFailDetail + " (service=" + String(data.service) + ", " + ms + " ms)";
        setFullCheckCta("soft-fail");
        return;
      }
      throw new Error("unexpected health payload");
    })
    .catch(function () {
      clearTimeout(timer);
      el.dataset.state = "fail";
      status.textContent = copy.fail;
      detail.textContent = copy.failDetail;
      setFullCheckCta("fail");
    });
})();
