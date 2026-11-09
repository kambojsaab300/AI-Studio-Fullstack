// GENERATED single-file worker for Gemini Canvas. Do not edit: change 'AI Studio Worker.jsx' and run npm run worker:canvas

// AI-Studio/app/AI Studio Worker.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
var ICON_PATHS = {
  cpu: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("rect", { x: "9", y: "9", width: "6", height: "6" })),
  refresh: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M21 12a9 9 0 1 1-2.6-6.3" }), /* @__PURE__ */ React.createElement("path", { d: "M21 4v5h-5" })),
  alert: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M12 8v5M12 16h.01" })),
  check: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "m8 12 3 3 5-6" })),
  image: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ React.createElement("circle", { cx: "9", cy: "9", r: "2" }), /* @__PURE__ */ React.createElement("path", { d: "m21 15-5-5L5 21" })),
  trash: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M3 6h18" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }), /* @__PURE__ */ React.createElement("path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" })),
  stop: /* @__PURE__ */ React.createElement("rect", { x: "5", y: "5", width: "14", height: "14", rx: "2", fill: "currentColor" })
};
var Ico = ({ n, className = "" }) => /* @__PURE__ */ React.createElement("svg", { className, width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, ICON_PATHS[n]);
var WORKER_CSS = String.raw`
*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#262626}
html,body{margin:0}
body{background:#0a0a0a;color:#d6d6d6;font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;min-height:100vh}
button,input,select,textarea{font:inherit;color:inherit}
button{background:none;padding:0;cursor:pointer}
button:disabled{cursor:not-allowed}
input,select,textarea{background:transparent}
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}
.items-center{align-items:center}.align-top{vertical-align:top}
.justify-between{justify-content:space-between}.justify-center{justify-content:center}
.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}
.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.w-full{width:100%}.w-2{width:.5rem}.w-3{width:.75rem}.w-4{width:1rem}.w-5{width:1.25rem}.w-9{width:2.25rem}.w-10{width:2.5rem}.w-40{width:10rem}
.h-2{height:.5rem}.h-3{height:.75rem}.h-4{height:1rem}.h-5{height:1.25rem}.h-8{height:2rem}.h-9{height:2.25rem}.h-10{height:2.5rem}
.min-w-\[300px\]{min-width:300px}.min-h-screen{min-height:100vh}.max-h-56{max-height:14rem}
.overflow-auto{overflow:auto}.overflow-x-auto{overflow-x:auto}
.space-y-1>:not([hidden])~:not([hidden]){margin-top:.25rem}
.space-y-3>:not([hidden])~:not([hidden]){margin-top:.75rem}
.space-y-5>:not([hidden])~:not([hidden]){margin-top:1.25rem}
.gap-1{gap:.25rem}.gap-1\.5{gap:.375rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}
.ml-1{margin-left:.25rem}.mr-2{margin-right:.5rem}
.p-0\.5{padding:.125rem}.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}
.px-2{padding-left:.5rem;padding-right:.5rem}.px-2\.5{padding-left:.625rem;padding-right:.625rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}
.py-0\.5{padding-top:.125rem;padding-bottom:.125rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\.5{padding-top:.375rem;padding-bottom:.375rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-6{padding-top:1.5rem;padding-bottom:1.5rem}
.pb-2\.5{padding-bottom:.625rem}
.text-left{text-align:left}.text-center{text-align:center}
.whitespace-nowrap{white-space:nowrap}.uppercase{text-transform:uppercase}.underline{text-decoration:underline}
.font-sans{font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif}.font-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.font-semibold{font-weight:600}.font-bold{font-weight:700}.font-extrabold{font-weight:800}.font-black{font-weight:900}
.text-\[10px\]{font-size:10px}.text-\[11px\]{font-size:11px}.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border-width:1px}.border-t{border-top-width:1px}.border-b{border-bottom-width:1px}
.border-white\/5{border-color:rgba(255,255,255,.05)}.border-white\/10{border-color:rgba(255,255,255,.1)}
.border-stone-700{border-color:#3a3a3a}.border-slate-700{border-color:#3a3a3a}.border-amber-300{border-color:#c4c4c4}.border-amber-400{border-color:#b5b5b5}
.border-amber-400\/20{border-color:rgba(181,181,181,.2)}.border-sky-500\/30{border-color:rgba(14,165,233,.3)}
.border-rose-500\/30{border-color:rgba(244,63,94,.3)}.border-rose-500\/40{border-color:rgba(244,63,94,.4)}
.border-purple-500\/30{border-color:rgba(168,85,247,.3)}.border-emerald-500\/20{border-color:rgba(16,185,129,.2)}.border-amber-400\/30{border-color:rgba(181,181,181,.3)}
.bg-\[\#0a0a0a\]{background-color:#0a0a0a}.bg-\[\#0f0f0f\]{background-color:#0f0f0f}.bg-\[\#161616\]{background-color:#161616}.bg-stone-800{background-color:#262626}
.bg-amber-400{background-color:#b5b5b5}.bg-emerald-400{background-color:#34d399}
.bg-rose-500\/10{background-color:rgba(244,63,94,.1)}.bg-slate-950\/60{background-color:rgba(10,10,10,.6)}
.bg-sky-500\/10{background-color:rgba(14,165,233,.1)}.bg-purple-500\/10{background-color:rgba(168,85,247,.1)}
.bg-emerald-500\/10{background-color:rgba(16,185,129,.1)}.bg-amber-400\/10{background-color:rgba(181,181,181,.1)}
.text-white{color:#e4e4e4}.text-slate-100{color:#dedede}.text-stone-100{color:#e4e4e4}.text-stone-200{color:#e7e5e4}.text-stone-300{color:#d6d3d1}
.text-stone-400{color:#a8a29e}.text-stone-500{color:#78716c}.text-stone-950{color:#0a0a0a}
.text-amber-300{color:#c4c4c4}.text-emerald-300{color:#6ee7b7}.text-emerald-400{color:#34d399}
.text-rose-200{color:#fecdd3}.text-rose-300{color:#fda4af}.text-sky-200{color:#bae6fd}
.text-purple-300{color:#d8b4fe}
.transition-colors{transition-property:color,background-color,border-color,fill,stroke;transition-duration:150ms;transition-timing-function:cubic-bezier(.4,0,.2,1)}
.transition-all{transition-property:all;transition-duration:150ms;transition-timing-function:cubic-bezier(.4,0,.2,1)}
.bg-amber-500\/20{background-color:rgba(163,163,163,.2)}.bg-rose-500{background-color:#f43f5e}
.border-amber-500\/40{border-color:rgba(163,163,163,.4)}
.text-slate-400{color:#9a9a9a}.text-slate-950{color:#0a0a0a}
.shadow-\[0_0_12px_rgba\(245\,158\,11\,0\.3\)\]{box-shadow:0 0 12px rgba(181,181,181,.25)}
.animate-ping{animation:ws-ping 1s cubic-bezier(0,0,.2,1) infinite}
@keyframes ws-ping{75%,100%{transform:scale(2);opacity:0}}
.shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.3),0 4px 6px -4px rgba(0,0,0,.3)}
.animate-spin{animation:ws-spin 1s linear infinite}
.animate-pulse{animation:ws-pulse 2s cubic-bezier(.4,0,.6,1) infinite}
@keyframes ws-spin{to{transform:rotate(360deg)}}
@keyframes ws-pulse{50%{opacity:.5}}
.hover\:underline:hover{text-decoration:underline}
.hover\:text-amber-200:hover{color:#cfcfcf}.hover\:text-amber-300:hover{color:#c4c4c4}
.hover\:bg-amber-300:hover{background-color:#c4c4c4}
.focus\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}
.focus\:border-amber-400:focus{border-color:#b5b5b5}
.disabled\:opacity-40:disabled{opacity:.4}
@media (min-width:640px){.sm\:p-6{padding:1.5rem}.sm\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (min-width:768px){.md\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
if (typeof document !== "undefined" && !document.getElementById("worker-styles")) {
  const styleTag = document.createElement("style");
  styleTag.id = "worker-styles";
  styleTag.textContent = WORKER_CSS;
  document.head.appendChild(styleTag);
}
var ApiQueryBuilder = class {
  constructor(apiUrl, table, token) {
    this.apiUrl = apiUrl;
    this.table = table;
    this.token = token;
    this.params = new URLSearchParams();
    this._isSingle = false;
    this._isCount = false;
    this._isHead = false;
  }
  select(columns = "*", options = {}) {
    this.params.set("select", columns);
    if (options && options.count) {
      this._isCount = true;
      this.params.set("count", options.count);
    }
    if (options && options.head) {
      this._isHead = true;
      this.params.set("head", "true");
    }
    return this;
  }
  order(column, { ascending = true } = {}) {
    this.params.set("order", `${column}.${ascending ? "asc" : "desc"}`);
    return this;
  }
  limit(n) {
    this.params.set("limit", String(n));
    return this;
  }
  range(from, to) {
    this.params.set("offset", String(from));
    this.params.set("limit", String(to - from + 1));
    return this;
  }
  eq(column, value) {
    this.params.append(column, `eq.${value}`);
    return this;
  }
  neq(column, value) {
    this.params.append(column, `neq.${value}`);
    return this;
  }
  is(column, value) {
    this.params.append(column, `is.${value}`);
    return this;
  }
  in(column, values) {
    const list = Array.isArray(values) ? values.join(",") : values;
    this.params.append(column, `in.(${list})`);
    return this;
  }
  single() {
    this._isSingle = true;
    return this;
  }
  async _fetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "Bypass-Tunnel-Reminder": "true",
      ...workerTokenHeaders(),
      ...this.token ? { "Authorization": `Bearer ${this.token}` } : {}
    };
    if (this._isSingle) {
      headers["Accept"] = "application/vnd.pgrst.object+json";
    }
    try {
      const res = await fetch(url, { ...options, headers });
      let countVal = 0;
      const contentRange = res.headers.get("content-range") || res.headers.get("Content-Range");
      if (contentRange) {
        const parts = contentRange.split("/");
        if (parts.length > 1) countVal = parseInt(parts[1], 10) || 0;
      } else {
        const totalHdr = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
        if (totalHdr) countVal = parseInt(totalHdr, 10) || 0;
      }
      if (!res.ok) {
        const text = await res.text();
        let errObj;
        try {
          errObj = JSON.parse(text);
        } catch {
          errObj = { message: text };
        }
        return { data: null, error: errObj, count: 0 };
      }
      const data = await res.json();
      if (countVal === 0 && Array.isArray(data)) countVal = data.length;
      return {
        data: this._isSingle && Array.isArray(data) ? data[0] || null : data,
        error: null,
        count: countVal
      };
    } catch (err) {
      return { data: null, error: { message: err.message }, count: 0 };
    }
  }
  then(resolve, reject) {
    const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
    return this._fetch(url, { method: "GET" }).then(resolve, reject);
  }
  async insert(data) {
    const url = `${this.apiUrl}/rest/v1/${this.table}`;
    return this._fetch(url, { method: "POST", body: JSON.stringify(data) });
  }
  async update(data) {
    const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
    return this._fetch(url, { method: "PATCH", body: JSON.stringify(data) });
  }
  async delete() {
    const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
    return this._fetch(url, { method: "DELETE" });
  }
};
function getEffectiveApiUrl(providedUrl) {
  if (typeof window !== "undefined") {
    const queryApi = new URLSearchParams(window.location.search).get("api");
    if (queryApi) {
      try {
        localStorage.setItem("aistudio_api_url", queryApi);
      } catch {
      }
      return queryApi.replace(/\/$/, "");
    }
    try {
      const savedApi = localStorage.getItem("aistudio_api_url");
      if (savedApi) {
        if (savedApi.includes("trycloudflare.com")) {
          try {
            localStorage.removeItem("aistudio_api_url");
          } catch {
          }
        } else {
          return (savedApi === "http://aistudio.runasp.net" ? "https://aistudio.runasp.net" : savedApi).replace(/\/$/, "");
        }
      }
    } catch {
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname)) {
      return `http://${window.location.hostname}:5005`;
    }
    if (window.location.hostname && window.location.hostname.endsWith(".trycloudflare.com")) {
      return "https://carb-separate-photograph-tonight.trycloudflare.com";
    }
    if (window.location.hostname && window.location.hostname.endsWith(".loca.lt")) {
      return "https://aistudio-api.loca.lt";
    }
    if (providedUrl) {
      return providedUrl.replace(/\/$/, "");
    }
  }
  return (providedUrl || "https://aistudio.runasp.net").replace(/\/$/, "");
}
function createClient(apiUrl = "https://aistudio.runasp.net", apiKey = "") {
  const url = getEffectiveApiUrl(apiUrl);
  let token = "";
  let currentUser = null;
  try {
    token = localStorage.getItem("aistudio_token") || "";
    const saved = localStorage.getItem("aistudio_user");
    if (saved) currentUser = JSON.parse(saved);
  } catch {
  }
  return {
    apiUrl: url,
    from(table) {
      return new ApiQueryBuilder(url, table, token);
    },
    async rpc(functionName, params = {}, extraHeaders = {}) {
      try {
        const res = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Bypass-Tunnel-Reminder": "true",
            ...workerTokenHeaders(),
            ...extraHeaders,
            ...token ? { "Authorization": `Bearer ${token}` } : {}
          },
          body: JSON.stringify(params || {})
        });
        const text = await res.text();
        if (!res.ok) {
          let errObj;
          try {
            errObj = JSON.parse(text);
          } catch {
            errObj = { message: text };
          }
          return { data: null, error: errObj };
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    },
    channel(name) {
      const ch = {
        name,
        on() {
          return ch;
        },
        subscribe() {
          return ch;
        }
      };
      return ch;
    },
    removeChannel() {
    }
  };
}
var API_URL = "https://aistudio.runasp.net";
var USE_REALTIME = location.protocol !== "blob:";
var API_KEY = "aistudio_worker_local_key";
function everyMs(fn, delayOf) {
  let t;
  const tick = () => {
    fn();
    t = setTimeout(tick, delayOf());
  };
  t = setTimeout(tick, delayOf());
  return () => clearTimeout(t);
}
var WORKER_KEY_STORAGE = "ai_studio_worker_key";
var WORKER_TOKEN_STORAGE = "ai_studio_worker_token";
var workerTokenHeaders = () => {
  try {
    const token = sessionStorage.getItem(WORKER_TOKEN_STORAGE);
    return token ? { "X-Worker-Token": token } : {};
  } catch {
    return {};
  }
};
var workerAuthHeader = () => {
  try {
    const token = sessionStorage.getItem(WORKER_TOKEN_STORAGE);
    return token ? { Authorization: `Worker ${token}` } : {};
  } catch {
    return {};
  }
};
var workerCall = async (client, method, path, body) => {
  try {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(`${client.apiUrl}${path}`, {
      method,
      headers: {
        "Bypass-Tunnel-Reminder": "true",
        ...body !== void 0 && !isForm ? { "Content-Type": "application/json" } : {},
        ...workerAuthHeader()
      },
      ...body !== void 0 ? { body: isForm ? body : JSON.stringify(body) } : {}
    });
    if (res.status === 204) return { status: 204, data: null };
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
};
var wBlobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = reject;
  r.readAsDataURL(blob);
});
var fetchInputDataUrl = async (client, path) => {
  const res = await fetch(`${client.apiUrl}${path}`, { headers: { "Bypass-Tunnel-Reminder": "true", ...workerAuthHeader() } });
  if (!res.ok) throw new Error(`Input load HTTP ${res.status}`);
  return wBlobToDataUrl(await res.blob());
};
var GEMINI_API_KEY = "";
var RUNTIME = {
  match_model: "gemini-3-flash-preview",
  match_threshold: 70,
  // face score below this -> generate again
  match_retries: 2,
  gemini_base: "https://generativelanguage.googleapis.com/v1beta/models",
  imgbb_upload_url: "https://api.imgbb.com/1/upload",
  stale_ms: 10 * 60 * 1e3,
  // a stuck task older than this can be picked again
  heartbeat_ms: 5e3,
  // "I am alive" every 5 s (and reads the paused flag)
  fallback_ms: 2e3,
  // polls & fetches new tasks from DB every 2 s!
  image_max_side: 2048,
  image_quality: 0.85,
  model_caps: {}
  // filled from ai_studio_models (kind, label, aspects, sizes)
};
function applyRuntime(d) {
  RUNTIME = {
    match_model: d.match_model || RUNTIME.match_model,
    match_threshold: d.match_threshold ?? RUNTIME.match_threshold,
    match_retries: d.match_retries ?? RUNTIME.match_retries,
    gemini_base: d.gemini_base || RUNTIME.gemini_base,
    imgbb_upload_url: d.imgbb_upload_url || RUNTIME.imgbb_upload_url,
    stale_ms: (d.stale_min ?? 10) * 60 * 1e3,
    heartbeat_ms: (d.heartbeat_sec ?? 5) * 1e3,
    fallback_ms: (d.fallback_sec ?? 2) * 1e3,
    image_max_side: d.image_max_side ?? RUNTIME.image_max_side,
    image_quality: d.image_quality ?? RUNTIME.image_quality,
    model_caps: d.model_caps || RUNTIME.model_caps
  };
}
var DEFAULT_SETTINGS = { task_concurrency: 20, gemini_concurrency: 8, photos_per_task_max: 50, max_attempts: 3, retry_delay_sec: 30, task_timeout_sec: 300, budget_left: null, disabled_models: [], cloudinary_enabled: true, cloudinary_cloud_name: "draaqjcre", cloudinary_upload_preset: "ml_default", imgbb_enabled: false, imgbb_api_key: "", worker_recycle_after_tasks: 50 };
var TABLES = {
  TASKS: "ai_studio_tasks",
  // GET my tasks
  WORKERS: "ai_studio_workers",
  // realtime: is my pause flag changed?
  SETTINGS: "ai_studio_settings",
  // GET the limits (one row)
  PROMPTS: "ai_studio_prompts",
  // realtime: prompt changed
  CATALOG: "ai_studio_task_catalog",
  // realtime: task type changed
  FAMILY_ROLES: "ai_studio_family_roles",
  // realtime: family role changed
  MODELS: "ai_studio_models"
  // realtime: model changed
};
var TASK_TYPES = {};
function toTaskType(r) {
  return {
    label: r.label,
    output: r.output,
    kind: r.output,
    inputs: r.inputs || [],
    labels: r.labels || {},
    optional: r.optional || [],
    extras: !!r.extras,
    promptRequired: !!r.prompt_required,
    faceCheck: !!r.face_check,
    edit: !!r.edit,
    transparentOut: !!r.transparent,
    angles: r.angles || null,
    family: !!r.family,
    perPhoto: !!r.per_photo
  };
}
function setTaskTypes(rows) {
  Object.keys(TASK_TYPES).forEach((k) => delete TASK_TYPES[k]);
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    TASK_TYPES[r.task_type] = toTaskType(r);
  });
}
var INPUT_LABEL = { face: "Face reference", style: "Style / outfit reference", input: "Input photo" };
var INPUT_COLUMN = { face: "face_image_url", style: "style_image_url", input: "input_image_url" };
var labelFor = (type, key) => type.labels?.[key] || INPUT_LABEL[key];
var loadApiClient = () => Promise.resolve({ createClient });
var createLimiter = (max) => {
  let active = 0;
  const queue = [];
  const cap = () => typeof max === "function" ? max() : max;
  const pump = () => {
    while (active < cap() && queue.length > 0) {
      active++;
      const { task, resolve, reject } = queue.shift();
      task().then(resolve, reject).finally(() => {
        active--;
        pump();
      });
    }
  };
  const limiter = (task) => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pump();
  });
  limiter.pump = pump;
  return limiter;
};
var inputCache = /* @__PURE__ */ new Map();
function cleanTaskCache(task) {
  if (!task) return;
  const urls = [
    task.input_image_url,
    task.face_image_url,
    task.style_image_url,
    ...task.extra_image_urls || []
  ].filter(Boolean);
  for (const u of urls) {
    inputCache.delete(u);
  }
}
function purgeAllMemory() {
  inputCache.clear();
  if (typeof window !== "undefined" && window.gc) {
    try {
      window.gc();
    } catch {
    }
  }
}
function getMemoryStats() {
  if (typeof window !== "undefined" && window.performance && window.performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = window.performance.memory;
    return {
      usedMB: Math.round(usedJSHeapSize / (1024 * 1024)),
      totalMB: Math.round(totalJSHeapSize / (1024 * 1024)),
      limitMB: Math.round(jsHeapSizeLimit / (1024 * 1024)),
      supported: true
    };
  }
  return {
    usedMB: 0,
    totalMB: 0,
    limitMB: 0,
    cacheCount: inputCache.size,
    supported: false
  };
}
var INPUT_CACHE_MAX = 10;
var b64Of = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);
async function urlToBase64(url, { cache = true } = {}) {
  if (!url) return "";
  if (inputCache.has(url)) return inputCache.get(url);
  if (typeof url === "string" && url.startsWith("data:")) return b64Of(url);
  const blob = await (await fetch(url)).blob();
  const b64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(b64Of(String(r.result)));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  if (cache) {
    inputCache.set(url, b64);
    if (inputCache.size > INPUT_CACHE_MAX) inputCache.delete(inputCache.keys().next().value);
  }
  return b64;
}
async function mapSettledLimit(items, limit, fn, shouldStop) {
  const results = new Array(items.length);
  let next = 0;
  const runOne = async () => {
    while (next < items.length && !(shouldStop && shouldStop())) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}
var MAX_HEAP_MB_FOR_PICKUP = 120;
var PER_PHOTO_PARALLEL = 8;
var SECONDS_PER_ROUND = 85;
var MAX_TASK_TIMEOUT_SEC = 25 * 60;
var FINISH_MARGIN_MS = 60 * 1e3;
var dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
var canvasToBlob = (c, type, quality) => new Promise((resolve, reject) => c.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas blob nahi bana")), type, quality));
var FAMILY_ROLES = [];
function familyOrderText(task) {
  const keys = task.family_role_keys || FAMILY_ROLES.map((r) => r.role_key);
  const names = Object.fromEntries(FAMILY_ROLES.map((r) => [r.role_key, r.prompt_text || r.role_key]));
  const present = keys.filter((_, i) => (task.extra_image_urls || [])[i]);
  return `Photo order: ${present.map((k, i) => `IMAGE ${i + 1} = ${names[k] || k}`).join(", ")}.`;
}
function instructionFor(task, p) {
  const userPrompt = (task.prompt || "").trim();
  if (task.task_type === "chat") return userPrompt;
  if (task.task_type === "photo_read") return userPrompt || "Describe this photo in detail.";
  if (!p || !p.enabled) throw new Error(`Is kaam ka prompt DB mein nahi ya band hai: ${task.task_type}`);
  const parts = [
    task.system_text || p.system_text,
    p.role_text,
    userPrompt ? `Prompt: "${userPrompt}"` : "",
    p.negative_text ? `[NEGATIVE CONSTRAINTS]: ${p.negative_text}` : ""
  ];
  let text = parts.filter(Boolean).join("\n");
  if (task.task_type === "family_photo") text += `
${familyOrderText(task)}`;
  if (task.angle) text += `
Camera angle for this photo: ${task.angle}.`;
  if (TASK_TYPES[task.task_type].output === "image") text += `
Aspect ratio: ${task.aspect_ratio}.`;
  return text;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load nahi hui"));
    img.src = src;
  });
}
async function compositeEdit(photoB64, maskB64, generatedDataUrl) {
  const [photo, mask, gen] = await Promise.all([
    loadImage(`data:image/jpeg;base64,${photoB64}`),
    loadImage(`data:image/jpeg;base64,${maskB64}`),
    loadImage(generatedDataUrl)
  ]);
  const w = photo.naturalWidth;
  const h = photo.naturalHeight;
  const pixelsOf = (img) => {
    const c2 = document.createElement("canvas");
    c2.width = w;
    c2.height = h;
    const x = c2.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const data = x.getImageData(0, 0, w, h).data;
    c2.width = 0;
    c2.height = 0;
    img.src = "";
    return data;
  };
  const orig = pixelsOf(photo);
  const edited = pixelsOf(gen);
  const maskPx = pixelsOf(mask);
  const out = new ImageData(w, h);
  for (let i = 0; i < orig.length; i += 4) {
    const a = maskPx[i] / 255;
    for (let k = 0; k < 3; k++) out.data[i + k] = orig[i + k] * (1 - a) + edited[i + k] * a;
    out.data[i + 3] = 255;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").putImageData(out, 0, 0);
  const result = c.toDataURL("image/jpeg", 0.92);
  c.width = 0;
  c.height = 0;
  return result;
}
async function shrinkToBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, RUNTIME.image_max_side / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  try {
    return await canvasToBlob(c, "image/jpeg", RUNTIME.image_quality);
  } finally {
    c.width = 0;
    c.height = 0;
  }
}
async function knockoutWhite(dataUrl) {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < px.data.length; i += 4) {
    const min = Math.min(px.data[i], px.data[i + 1], px.data[i + 2]);
    if (min >= 240) px.data[i + 3] = 0;
    else if (min >= 215) px.data[i + 3] = Math.round((240 - min) / 25 * 255);
  }
  ctx.putImageData(px, 0, 0);
  const result = c.toDataURL("image/png");
  c.width = 0;
  c.height = 0;
  img.src = "";
  return result;
}
async function callAiStudio(task, inputs, apiKey, promptRow, opts = {}) {
  let type = TASK_TYPES[task.task_type];
  if (!type && sbRef.current) {
    await loadSettings(sbRef.current);
    type = TASK_TYPES[task.task_type];
  }
  if (!type) throw new Error(`Task type galat hai: ${task.task_type}`);
  const isImage = type.output === "image";
  if (isImage) {
    const caps = RUNTIME.model_caps[task.model];
    if (!caps || caps.kind !== "image") throw new Error(`Image model nahi hai: ${task.model}`);
    if (!caps.aspects.includes(task.aspect_ratio)) throw new Error(`${task.model} mein aspect ratio ${task.aspect_ratio} support nahi`);
    if (task.image_size && !caps.sizes.includes(task.image_size)) throw new Error(`${task.model} mein size ${task.image_size} support nahi`);
  }
  const parts = [{ text: instructionFor(task, promptRow) }];
  for (const key of ["face", "style", "input"]) {
    if (inputs[key]) parts.push({ inlineData: { mimeType: "image/jpeg", data: inputs[key] } });
  }
  for (const extra of inputs.extras || []) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: extra } });
  }
  const contents = [
    ...(task.history || []).flatMap((h) => [
      { role: "user", parts: [{ text: h.prompt }] },
      { role: "model", parts: [{ text: h.output_text }] }
    ]),
    { role: "user", parts }
  ];
  const body = { contents };
  if (isImage) {
    body.generationConfig = {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: task.aspect_ratio, ...task.image_size ? { imageSize: task.image_size } : {} }
    };
  }
  const url = `${RUNTIME.gemini_base}/${task.model}:generateContent?key=${apiKey}`;
  let data = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      let res;
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error?.message || `HTTP ${res.status}`);
        err.status = res.status;
        if ([400, 401, 403, 404].includes(res.status)) err.retry = false;
        if (res.status === 429 && opts.switchOn429) err.retry = false;
        throw err;
      }
      break;
    } catch (err) {
      if (err.retry === false || attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 1e3 * 2 ** attempt));
    }
  }
  if (data.promptFeedback?.blockReason) throw new Error(`Prompt block hua: ${data.promptFeedback.blockReason}`);
  const cand = data.candidates?.[0];
  const finish = cand?.finishReason ? ` (finishReason: ${cand.finishReason})` : "";
  if (isImage) {
    const imgPart = cand?.content?.parts?.find((p) => p.inlineData);
    if (!imgPart) throw new Error(`Image nahi aayi${finish}`);
    const mimeType = imgPart.inlineData.mimeType || "image/png";
    return { image: { dataUrl: `data:${mimeType};base64,${imgPart.inlineData.data}`, mimeType } };
  }
  const text = (cand?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error(`Text nahi aaya${finish}`);
  return { text };
}
async function checkFaceMatch(faceB64, outputB64, apiKey) {
  const body = {
    contents: [{ role: "user", parts: [
      { text: 'IMAGE 1 and IMAGE 2: are they the same person (same face)? Return only JSON: {"score": <0-100>}, where 100 = identical face.' },
      { inlineData: { mimeType: "image/jpeg", data: faceB64 } },
      { inlineData: { mimeType: "image/jpeg", data: outputB64 } }
    ] }],
    generationConfig: { responseMimeType: "application/json" }
  };
  try {
    const res = await fetch(`${RUNTIME.gemini_base}/${RUNTIME.match_model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    const score = Number(JSON.parse(text).score);
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}
var withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timeout: ${ms / 1e3} second se zyada chala`)), ms);
  promise.then(
    (value) => {
      clearTimeout(timer);
      resolve(value);
    },
    (err) => {
      clearTimeout(timer);
      reject(err);
    }
  );
});
function AiStudioWorker() {
  const [apiKey, setApiKey] = useState(API_KEY);
  const [customApiUrl] = useState(() => getEffectiveApiUrl(API_URL));
  const [sb, setSb] = useState(null);
  const [workerId, setWorkerId] = useState("");
  const [paused, setPaused] = useState(false);
  const [drain, setDrain] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState([]);
  const MAX_LOGS = 30;
  const log = useCallback((text) => {
    setLogs((prev) => {
      if (prev.length >= MAX_LOGS) {
        return [
          { t: (/* @__PURE__ */ new Date()).toLocaleTimeString(), text },
          { t: (/* @__PURE__ */ new Date()).toLocaleTimeString(), text: "\u26A1 [Auto-Clear] 30 logs limit reached: screen logs were reset" }
        ];
      }
      return [{ t: (/* @__PURE__ */ new Date()).toLocaleTimeString(), text }, ...prev];
    });
  }, []);
  useEffect(() => {
    if (logs.length >= 30) {
      const timer = setTimeout(() => {
        setLogs([
          { t: (/* @__PURE__ */ new Date()).toLocaleTimeString(), text: "\u26A1 [Auto-Clear] 30 logs reached: screen logs auto-cleared" }
        ]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [logs.length]);
  const [running, setRunning] = useState(0);
  const [memStats, setMemStats] = useState(() => getMemoryStats());
  useEffect(() => {
    const checkMemory = () => {
      const stats = getMemoryStats();
      setMemStats((prev) => prev.usedMB === stats.usedMB && prev.supported === stats.supported ? prev : stats);
      if (stats.supported && stats.usedMB > 100) {
        const countBefore = inputCache.size;
        const ramBefore = stats.usedMB;
        purgeAllMemory();
        const newStats = getMemoryStats();
        setMemStats(newStats);
        log(`[Auto-RAM Purge] RAM was ${ramBefore}MB (high). Caches cleared (${countBefore} items). RAM now: ${newStats.usedMB || "OK"}MB`);
      }
    };
    const timer = setInterval(checkMemory, 3e3);
    return () => clearInterval(timer);
  }, [log]);
  const sbRef2 = useRef(null);
  const workerIdRef = useRef("");
  const pausedRef = useRef(false);
  const drainRef = useRef(false);
  const failStreakRef = useRef(0);
  const sessionTasksDoneRef = useRef(0);
  const [sessionTasksDone, setSessionTasksDone] = useState(0);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const promptsRef = useRef({});
  const seenLimitRef = useRef(null);
  const kickRef = useRef(() => {
  });
  const refreshRef = useRef(() => {
  });
  const inFlight = useRef(/* @__PURE__ */ new Set());
  const retryAfterMap = useRef(/* @__PURE__ */ new Map());
  const connectingRef = useRef(false);
  const dynamicTaskConcurrencyRef = useRef(10);
  const dynamicGeminiConcurrencyRef = useRef(8);
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [currentConcurrency, setCurrentConcurrency] = useState(10);
  const taskLimiter = useRef(createLimiter(() => dynamicTaskConcurrencyRef.current)).current;
  const geminiLimiter = useRef(createLimiter(() => dynamicGeminiConcurrencyRef.current)).current;
  sbRef2.current = sb;
  useEffect(() => {
    const timer = setInterval(() => setLogs([]), 10 * 60 * 1e3);
    return () => clearInterval(timer);
  }, []);
  const [myTab, setMyTab] = useState("pending");
  const [myPage, setMyPage] = useState(0);
  const [myRows, setMyRows] = useState([]);
  const [myCounts, setMyCounts] = useState({});
  const MY_PAGE_SIZE = 10;
  const loadMyTasks = useCallback(async (tab, page) => {
    if (!workerIdRef.current) return;
    setMyRows([]);
    setMyCounts((prev) => ({ ...prev, [tab]: 0 }));
  }, [log]);
  const pickTab = (tab) => {
    setMyTab(tab);
    setMyPage(0);
    loadMyTasks(tab, 0);
  };
  const goPage = (page) => {
    setMyPage(page);
    loadMyTasks(myTab, page);
  };
  refreshRef.current = () => {
  };
  const deleteTask = async (task) => {
    if (!window.confirm(`Task #${task.id} ko database se permanently delete karna chahte hain?`)) return;
    try {
      const client = sbRef2.current;
      if (client) {
        throw new Error("Ye action Admin portal se karein");
      }
      setMyRows((rows) => rows.filter((r) => r.id !== task.id));
      setMyCounts((c) => ({ ...c, [myTab]: Math.max(0, (c[myTab] || 1) - 1) }));
      log(`Task #${task.id} database se permanently delete ho gaya`);
    } catch (err) {
      alert("Delete fail hua: " + err.message);
    }
  };
  const stopTask = async (task) => {
    try {
      const client = sbRef2.current;
      if (client) {
        throw new Error("Ye action Admin portal se karein");
      }
      setMyRows((rows) => rows.map((r) => r.id === task.id ? { ...r, status: "failed", error: "Stopped by user" } : r));
      log(`Task #${task.id} stop kar diya gaya`);
    } catch (err) {
      alert("Stop fail hua: " + err.message);
    }
  };
  const clearAllFailed = async () => {
    if (!window.confirm("Kya aap is worker ke saare failed tasks ko database se permanently delete karna chahte hain?")) return;
    try {
      const client = sbRef2.current;
      if (client) {
        throw new Error("Ye action Admin portal se karein");
      }
      setMyRows([]);
      setMyCounts((c) => ({ ...c, failed: 0 }));
      log("Saare failed tasks database se delete kar diye gaye");
    } catch (err) {
      alert("Clear failed error: " + err.message);
    }
  };
  const loadSettings2 = async (client) => {
    const { data: catalog } = await workerCall(client, "GET", "/api/worker/catalog");
    if (Array.isArray(catalog)) setTaskTypes(catalog);
    const { data: roles } = await workerCall(client, "GET", "/api/worker/family-roles");
    if (Array.isArray(roles)) FAMILY_ROLES = roles;
    const { data, status: status2 } = await workerCall(client, "GET", "/api/worker/settings");
    if (status2 !== 200 || !data) return;
    settingsRef.current = data;
    applyRuntime(data);
    setSettings(data);
    const baseTaskLimit = Number(data?.task_concurrency) || 10;
    const baseGeminiLimit = Number(data?.gemini_concurrency) || 8;
    if (!isTurboMode) {
      dynamicTaskConcurrencyRef.current = baseTaskLimit;
      dynamicGeminiConcurrencyRef.current = baseGeminiLimit;
      setCurrentConcurrency(baseTaskLimit);
    }
    const { data: prompts } = await workerCall(client, "GET", "/api/worker/prompts");
    if (prompts) promptsRef.current = Object.fromEntries(prompts.map((p) => [p.task_type, p]));
    kickRef.current();
  };
  const leaseMap = /* @__PURE__ */ new Map();
  const claimNext = async (client) => {
    const { status: status2, data } = await workerCall(client, "POST", "/api/worker/claim");
    if (status2 === 204 || !data) return null;
    if (status2 === 429) throw new Error("Aaj ka Gemini budget khatam");
    if (status2 === 503) throw new Error("Maintenance mode on hai");
    if (status2 !== 200) throw new Error(`Claim HTTP ${status2}`);
    const parseList = (v) => {
      if (!v) return null;
      try {
        const x = typeof v === "string" ? JSON.parse(v) : v;
        return Array.isArray(x) ? x : null;
      } catch {
        return null;
      }
    };
    const inputs = data.inputs || {};
    const legacy = data.legacy || {};
    const legacyFetch = async (url) => {
      if (!url) return null;
      const res = await fetch(`${client.apiUrl}/api/worker/legacy-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true", ...workerAuthHeader() },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`Input URL load HTTP ${res.status}`);
      return wBlobToDataUrl(await res.blob());
    };
    const pick = (path, legacyUrl) => path ? fetchInputDataUrl(client, path) : legacyFetch(legacyUrl);
    const [inputImg, faceImg, styleImg] = await Promise.all([
      pick(inputs.input, legacy.InputImageUrl),
      pick(inputs.face, legacy.FaceImageUrl),
      pick(inputs.style, legacy.StyleImageUrl)
    ]);
    const extraPaths = inputs.extra || [];
    const legacyExtras = parseList(legacy.ExtraImageUrls) || [];
    const extras = extraPaths.length ? await Promise.all(extraPaths.map((p) => fetchInputDataUrl(client, p))) : await Promise.all(legacyExtras.map(legacyFetch));
    leaseMap.set(data.PublicId, { publicId: data.PublicId, leaseId: data.LeaseId });
    return {
      id: data.PublicId,
      task_type: data.TaskType,
      model: data.Model,
      prompt: data.Prompt,
      system_text: data.prompts?.SystemText || null,
      aspect_ratio: data.AspectRatio,
      image_size: data.ImageSize,
      batch_count: data.BatchCount || 1,
      attempts: data.Attempts || 0,
      family_role_keys: parseList(data.FamilyRoleKeys),
      input_image_url: inputImg,
      face_image_url: faceImg,
      style_image_url: styleImg,
      extra_image_urls: extras,
      conversation_id: null,
      user_id: null,
      tool: null,
      app_id: null,
      status: "processing"
    };
  };
  const complete = async (id, patch) => {
    const client = sbRef2.current;
    const lease = leaseMap.get(id);
    if (!client || !lease) {
      log(`Task #${id}: lease nahi mila, result save nahi hua`);
      return;
    }
    const fd = new FormData();
    const ok = patch.status === "done";
    fd.append("LeaseId", lease.leaseId);
    fd.append("Success", String(ok));
    fd.append("Retryable", String(patch.status === "pending"));
    if (patch.output_text) fd.append("OutputText", patch.output_text);
    if (!ok) {
      fd.append("ErrorCode", "GENERATION_FAILED");
      if (patch.error) fd.append("ErrorDetail", String(patch.error).slice(0, 2e3));
    }
    if (patch.process_ms != null) fd.append("ProcessMs", String(patch.process_ms));
    if (patch.face_match_score != null) fd.append("FaceMatchScore", String(patch.face_match_score));
    for (const img of patch.images || []) {
      fd.append("Images", await dataUrlToBlob(img), "output.jpg");
    }
    const { status: status2 } = await workerCall(client, "POST", `/api/worker/tasks/${lease.publicId}/complete`, fd);
    if (status2 === 409) log(`Task #${id}: lease expire ho gaya, result server ne nahi liya`);
    else if (status2 >= 400 || status2 === 0) throw new Error(`Complete HTTP ${status2}`);
    leaseMap.delete(id);
  };
  const takeCall = async () => {
  };
  const keysRef = useRef([]);
  const keyTurnRef = useRef(0);
  const loadGeminiKeys = async () => {
  };
  const pickKey = () => {
    const keys = keysRef.current;
    if (!keys.length) return { id: 0, key: GEMINI_API_KEY };
    const now = Date.now();
    const ready = keys.filter((k) => !(k.coolUntil > now));
    const pool = ready.length ? ready : [...keys].sort((a, b) => a.coolUntil - b.coolUntil).slice(0, 1);
    return pool[keyTurnRef.current++ % pool.length];
  };
  const isQuotaError = (err) => err?.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(err?.message || "");
  const isBadKeyError = (err) => [401, 403].includes(err?.status) || /API_KEY_INVALID|API key (not valid|invalid|expired)|PERMISSION_DENIED/i.test(err?.message || "");
  const withGeminiKey = async (fn) => {
    const tries = Math.max(1, keysRef.current.length);
    let lastErr;
    for (let i = 0; i < tries; i++) {
      const k = pickKey();
      try {
        return await fn(k);
      } catch (err) {
        lastErr = err;
        const quota = isQuotaError(err), bad = isBadKeyError(err);
        if (!k.id || keysRef.current.length < 2 || !(quota || bad)) throw err;
        k.coolUntil = Date.now() + (bad ? 10 * 60 * 1e3 : 60 * 1e3);
        log(`Gemini key #${k.id} ${bad ? "invalid" : "out of quota"}, trying the next key`);
      }
    }
    throw lastErr;
  };
  const askModel = (task, inputs, ctrl) => geminiLimiter(async () => {
    if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
    await takeCall();
    if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
    return withGeminiKey((k) => callAiStudio(task, inputs, k.key, promptsRef.current[task.task_type], { switchOn429: keysRef.current.length > 1 }));
  });
  const checkFace = (faceB64, outB64, ctrl) => geminiLimiter(async () => {
    if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
    await takeCall();
    const k = pickKey();
    return checkFaceMatch(faceB64, outB64, k.key);
  });
  useEffect(() => {
    if (!sb || !workerId) return;
    loadGeminiKeys(sb);
    const timer = setInterval(() => loadGeminiKeys(sbRef2.current), 2 * 60 * 1e3);
    return () => clearInterval(timer);
  }, [sb, workerId]);
  const uploadImage = async (dataUrl, isTransparent) => {
    const fullBlob = await dataUrlToBlob(dataUrl);
    const smallBlob = isTransparent ? fullBlob : await shrinkToBlob(fullBlob);
    return { image: await wBlobToDataUrl(smallBlob) };
  };
  const makePhoto = async (task, inputs, ctrl) => {
    const cfg = settingsRef.current;
    const type = TASK_TYPES[task.task_type];
    const wantFace = !!(inputs.face && type.faceCheck);
    let best = null;
    for (let attempt = 0; attempt <= RUNTIME.match_retries; attempt++) {
      if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
      const { image: generated } = await askModel(task, inputs, ctrl);
      if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
      let dataUrl = type.edit ? await compositeEdit(inputs.face, inputs.style, generated.dataUrl) : type.transparentOut ? await knockoutWhite(generated.dataUrl) : generated.dataUrl;
      generated.dataUrl = null;
      if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
      const upload = uploadImage(dataUrl, !!type.transparentOut);
      upload.catch(() => {
      });
      const score = wantFace ? await checkFace(inputs.face, b64Of(dataUrl), ctrl) : null;
      dataUrl = null;
      if (!best || (score ?? 0) > (best.score ?? 0)) best = { score, upload };
      if (score === null || score >= RUNTIME.match_threshold) break;
    }
    if (ctrl?.aborted) throw new Error("Task stopped: time limit reached");
    const { image } = await best.upload;
    return { image, score: best.score };
  };
  const autoPause = async (reason) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    if (sbRef2.current && workerIdRef.current) {
      try {
        await workerCall(sbRef2.current, "POST", "/api/worker/auto-pause", { reason });
      } catch (err) {
        console.warn("AutoPause error:", err);
      }
    }
    log("Worker paused itself: " + reason);
  };
  const failTask = async (task, err) => {
    const msg = err?.message || "Unknown error";
    const keyProblem = /HTTP 40[13]|API_KEY_INVALID|API key (not valid|invalid|expired)|PERMISSION_DENIED/i.test(msg);
    const isValidationError = /chahiye|Task type galat|DB mein nahi|Prompt khali/i.test(msg);
    const cfg = settingsRef.current;
    const attempts = (task.attempts || 0) + 1;
    if (keyProblem) {
      log(`Task #${task.id} warning: Key problem (${msg.slice(0, 70)})`);
    }
    if (!keyProblem && !isValidationError && attempts < cfg.max_attempts) {
      const delaySec = cfg.retry_delay_sec || 30;
      const nextRun = new Date(Date.now() + delaySec * 1e3).toISOString();
      retryAfterMap.current.set(task.id, Date.now() + delaySec * 1e3);
      await complete(task.id, { status: "pending", attempts, next_run_at: nextRun, error: msg });
      log(`Task #${task.id}: failed, retrying in ${delaySec} seconds (${attempts}/${cfg.max_attempts}): ${msg}`);
    } else {
      retryAfterMap.current.delete(task.id);
      await complete(task.id, { status: "failed", attempts, error: msg });
      log(`Task #${task.id}: fail: ${msg}`);
    }
  };
  const onTaskCompletedSuccess = () => {
    failStreakRef.current = 0;
    sessionTasksDoneRef.current += 1;
    const currentDone = sessionTasksDoneRef.current;
    setSessionTasksDone(currentDone);
    const recycleLimit = Number(settingsRef.current.worker_recycle_after_tasks) || 50;
    if (currentDone >= recycleLimit) {
      log(`[Auto-Recycle] ${currentDone}/${recycleLimit} tasks completed! Clearing logs and cache, then reloading the page fresh...`);
      setLogs([]);
      purgeAllMemory();
      sessionTasksDoneRef.current = 0;
      setSessionTasksDone(0);
      setTimeout(() => {
        if (inFlight.current.size === 0) {
          window.location.reload();
        }
      }, 1200);
    }
  };
  const timeoutFor = (task) => {
    const cfg = settingsRef.current;
    const base = Math.max(300, Number(cfg.task_timeout_sec) || 300);
    const type = TASK_TYPES[task.task_type];
    const maxBatch = cfg.photos_per_task_max || 50;
    const photos = type?.perPhoto ? Math.min((task.extra_image_urls || []).filter(Boolean).length, maxBatch) : Math.min(Math.max(task.batch_count || 1, 1), maxBatch);
    if (photos > 1) {
      const parallel = type?.perPhoto ? PER_PHOTO_PARALLEL : Math.max(1, dynamicGeminiConcurrencyRef.current);
      const rounds = Math.ceil(Math.max(photos, 1) / parallel);
      const dynamicSec = rounds * SECONDS_PER_ROUND + base;
      return Math.min(MAX_TASK_TIMEOUT_SEC, dynamicSec) * 1e3;
    }
    return base * 1e3;
  };
  const processTask = async (task, ctrl = { aborted: false, deadline: Infinity }) => {
    const client = sbRef2.current;
    const appLabel = (task.app_id || "weargen").toUpperCase();
    let inputs = {};
    try {
      let type = TASK_TYPES[task.task_type];
      if (!type) {
        console.log(`[Worker] Unknown task_type ${task.task_type}, refreshing catalog from database...`);
        await loadSettings2(client);
        type = TASK_TYPES[task.task_type];
      }
      if (!type) throw new Error(`Task type galat hai: ${task.task_type}`);
      for (const key of type.inputs) {
        if (type.optional?.includes(key)) continue;
        if (!task[INPUT_COLUMN[key]]) throw new Error(`${labelFor(type, key)} chahiye`);
      }
      if (type.promptRequired && !(task.prompt || "").trim()) throw new Error("Prompt chahiye");
      let history = [];
      inputs = {};
      const keys = type.inputs;
      const loaded = await Promise.all(keys.map((k) => urlToBase64(task[INPUT_COLUMN[k]])));
      keys.forEach((k, i) => {
        inputs[k] = loaded[i];
      });
      if (type.extras && !type.perPhoto && task.extra_image_urls?.length) {
        inputs.extras = await Promise.all(task.extra_image_urls.filter(Boolean).map(urlToBase64));
      }
      if (type.output === "text") {
        const result = await askModel({ ...task, history }, inputs);
        await complete(task.id, { status: "done", output_text: result.text });
        onTaskCompletedSuccess();
        log(`[${appLabel}] Task #${task.id}: text response ready`);
        return;
      }
      if (type.perPhoto) {
        const maxBatch = settingsRef.current?.photos_per_task_max || 50;
        const photosIn = (task.extra_image_urls || []).filter(Boolean).slice(0, maxBatch);
        ctrl.partialResults = [];
        const stopStarting = () => ctrl.aborted || Date.now() > ctrl.deadline - FINISH_MARGIN_MS;
        const done = await mapSettledLimit(photosIn, PER_PHOTO_PARALLEL, async (url) => {
          if (ctrl.aborted) throw new Error("Task stopped: time limit reached");
          const b64 = await urlToBase64(url, { cache: false });
          if (ctrl.aborted) throw new Error("Task stopped: time limit reached");
          const photo = await makePhoto(task, { extras: [b64] }, ctrl);
          ctrl.partialResults.push(photo);
          return photo;
        }, stopStarting);
        const made = ctrl.partialResults.length > 0 ? ctrl.partialResults : done.filter((r) => r && r.status === "fulfilled").map((r) => r.value);
        const skipped = photosIn.length - made.length;
        if (made.length === 0) throw new Error(done.find((r) => r)?.reason?.message || "Koi photo nahi bani");
        const images2 = made.map((p) => p.image).filter(Boolean);
        await complete(task.id, {
          status: "done",
          images: images2,
          ...skipped > 0 ? { error: `Partial: ${made.length}/${photosIn.length} photos ready (${skipped} skipped due to time limit)` } : {}
        });
        onTaskCompletedSuccess();
        log(`[${appLabel}] Task #${task.id}: ${made.length}/${photosIn.length} photos made${skipped > 0 ? ` (${skipped} skipped: time limit)` : ""}`);
        return;
      }
      const count = Math.min(Math.max(task.batch_count || 1, 1), settingsRef.current.photos_per_task_max);
      const settled = await Promise.allSettled(Array.from({ length: count }, (_, idx) => makePhoto(type.angles ? { ...task, angle: type.angles[idx % type.angles.length] } : task, inputs, ctrl)));
      const photos = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failedPhotos = settled.filter((r) => r.status === "rejected");
      if (photos.length === 0) throw new Error(failedPhotos[0]?.reason?.message || "Koi photo nahi bani");
      if (failedPhotos.length) log(`Task #${task.id}: ${failedPhotos.length} photos failed, ${photos.length} saved`);
      const images = photos.map((p) => p.image).filter(Boolean);
      const scores = photos.map((p) => p.score).filter((sc) => sc != null);
      await complete(task.id, {
        status: "done",
        images,
        face_match_score: scores.length ? Math.max(...scores) : null
      });
      cleanTaskCache(task);
      if (inputs) {
        for (const k in inputs) {
          inputs[k] = null;
        }
      }
      onTaskCompletedSuccess();
      log(`[${appLabel}] Task #${task.id}: ${photos.length} photo ready`);
    } catch (err) {
      await failTask(task, err);
    } finally {
      cleanTaskCache(task);
      if (inputs) {
        for (const k in inputs) {
          inputs[k] = null;
        }
        inputs = null;
      }
    }
  };
  const kick = async () => {
    const client = sbRef2.current;
    if (!client || !workerIdRef.current || pausedRef.current || drainRef.current) return;
    if (!Object.keys(TASK_TYPES).length) return;
    if (!Object.keys(RUNTIME.model_caps).length) return;
    if (settingsRef.current.budget_left === 0) return;
    const baseLimit = Math.max(1, Number(settingsRef.current.task_concurrency) || 10);
    const maxLimit = dynamicTaskConcurrencyRef.current;
    if (inFlight.current.size >= maxLimit) return;
    const mem = getMemoryStats();
    if (mem.supported && mem.usedMB > MAX_HEAP_MB_FOR_PICKUP && inFlight.current.size > 0) return;
    try {
      const rushDetected = inFlight.current.size >= 8;
      if (rushDetected && dynamicTaskConcurrencyRef.current < 20) {
        dynamicTaskConcurrencyRef.current = 20;
        dynamicGeminiConcurrencyRef.current = 16;
        setIsTurboMode(true);
        setCurrentConcurrency(20);
        taskLimiter.pump?.();
        geminiLimiter.pump?.();
        log("\u26A1 [Auto-Scale Turbo Active] Queue rush detected! Scaled worker limit from 10 -> 20 parallel tasks (Gemini: 16) to ensure < 1 min clearance.");
      } else if (!rushDetected && inFlight.current.size <= 5 && dynamicTaskConcurrencyRef.current > baseLimit) {
        dynamicTaskConcurrencyRef.current = baseLimit;
        dynamicGeminiConcurrencyRef.current = Math.min(8, Number(settingsRef.current.gemini_concurrency) || 8);
        setIsTurboMode(false);
        setCurrentConcurrency(baseLimit);
        log(`\u{1F33F} [Auto-Scale Normal] Queue cleared. Worker limit normalized to ${baseLimit} parallel tasks.`);
      }
      while (inFlight.current.size < dynamicTaskConcurrencyRef.current) {
        const task = await claimNext(client);
        if (!task) break;
        if ((settingsRef.current.disabled_models || []).includes(task.model)) {
          await complete(task.id, { status: "pending", error: "Model admin ne band kiya hai" });
          break;
        }
        inFlight.current.add(task.id);
        inFlight.current.add(task.id);
        setRunning(inFlight.current.size);
        const ctrl = { aborted: false, deadline: Infinity, partialResults: [] };
        taskLimiter(async () => {
          try {
            if (!pausedRef.current) {
              log(`Task #${task.id} received (${task.task_type}, ${task.model})`);
              const ms = timeoutFor(task);
              ctrl.deadline = Date.now() + ms;
              await withTimeout(processTask({ ...task, status: "processing" }, ctrl), ms);
            }
          } catch (err) {
            ctrl.aborted = true;
            const partial = ctrl.partialResults || [];
            if (/^Timeout:/.test(err.message) && partial.length > 0) {
              try {
                await complete(task.id, {
                  status: "done",
                  images: partial.map((p) => p.image).filter(Boolean),
                  face_match_score: null
                });
                onTaskCompletedSuccess();
                log(`Task #${task.id}: Saved ${partial.length} completed photos on timeout. Marked done.`);
                return;
              } catch (partialErr) {
                log(`Task #${task.id}: Partial save error: ${partialErr.message}`);
              }
            }
            if (/^Timeout:/.test(err.message)) {
              await failTask(task, err);
            } else log("Claim error: " + err.message);
          } finally {
            inFlight.current.delete(task.id);
            setRunning(inFlight.current.size);
            if (drainRef.current && inFlight.current.size === 0) log("Drain complete: you can close this tab now");
            if (!pausedRef.current && !drainRef.current && inFlight.current.size < dynamicTaskConcurrencyRef.current) {
              kickRef.current();
            }
          }
        });
      }
    } catch (err) {
      log("Pending error: " + err.message);
    }
  };
  kickRef.current = kick;
  const refreshAll = async () => {
    const c = sbRef2.current;
    if (c) await loadSettings2(c);
    loadMyTasks(myTab, myPage);
    kickRef.current();
  };
  const connect = async (overrideUrl) => {
    if (connectingRef.current || sbRef2.current) return;
    connectingRef.current = true;
    try {
      const targetUrl = typeof overrideUrl === "string" ? overrideUrl : customApiUrl || API_URL;
      const lib = await loadApiClient();
      const client = lib.createClient(targetUrl, apiKey);
      log(`Connecting to ${client.apiUrl}...`);
      const wanted = sessionStorage.getItem("ai_studio_worker_id");
      let enrollKey = "";
      try {
        enrollKey = (localStorage.getItem(WORKER_KEY_STORAGE) || "").trim();
      } catch {
      }
      const regRes = await fetch(`${client.apiUrl}/api/worker/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...enrollKey ? { "X-Api-Key": enrollKey } : {}
        },
        body: JSON.stringify({ wanted: wanted || null })
      });
      const data = await regRes.json().catch(() => null);
      if (!regRes.ok) throw new Error(data?.error || `Worker registration failed (HTTP ${regRes.status})`);
      const newId = data?.worker_id;
      if (!newId) throw new Error("Worker registration failed: no worker_id returned");
      if (data.worker_token) {
        try {
          sessionStorage.setItem(WORKER_TOKEN_STORAGE, data.worker_token);
        } catch {
        }
      }
      sessionStorage.setItem("ai_studio_worker_id", newId);
      workerIdRef.current = newId;
      sbRef2.current = client;
      setWorkerId(newId);
      await loadSettings2(client);
      setSb(client);
      log(`Connected as ${newId}`);
    } catch (err) {
      sbRef2.current = null;
      log("Connect error: " + err.message);
    } finally {
      connectingRef.current = false;
    }
  };
  useEffect(() => {
    if (!sb) return;
    const heartbeat = async () => {
      const w = workerIdRef.current;
      if (!w) return;
      const hbRes = await fetch(`${sb.apiUrl}/api/worker/heartbeat`, {
        method: "POST",
        headers: workerAuthHeader()
      });
      if (!hbRes.ok) return;
      const data = await hbRes.json().catch(() => null);
      const isPaused = !!data?.paused;
      drainRef.current = !!data?.drain;
      setDrain(!!data?.drain);
      pausedRef.current = isPaused;
      setPaused(isPaused);
    };
    let refreshTimer = null;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshRef.current();
        kickRef.current();
      }, 300);
    };
    heartbeat();
    refreshRef.current();
    kickRef.current();
    const stopHb = everyMs(heartbeat, () => RUNTIME.heartbeat_ms);
    const stopFb = everyMs(() => refreshRef.current(), () => RUNTIME.fallback_ms);
    const stopKick = everyMs(() => kickRef.current(), () => Math.min(1e3, RUNTIME.fallback_ms));
    let channel = null;
    if (USE_REALTIME) try {
      channel = sb.channel("ai-studio-worker-" + workerIdRef.current).on("postgres_changes", { event: "INSERT", schema: "public", table: TABLES.TASKS }, () => scheduleRefresh()).on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLES.WORKERS }, (payload) => {
        if (payload.new?.worker_id !== workerIdRef.current) return;
        const limit = payload.new.task_limit ?? null;
        if (limit !== seenLimitRef.current) {
          seenLimitRef.current = limit;
          loadSettings2(sb);
        }
        const isPaused = !!payload.new.paused;
        drainRef.current = !!payload.new.drain;
        setDrain(!!payload.new.drain);
        pausedRef.current = isPaused;
        setPaused(isPaused);
        if (!isPaused) kickRef.current();
      }).on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLES.SETTINGS }, () => loadSettings2(sb)).on("postgres_changes", { event: "*", schema: "public", table: TABLES.PROMPTS }, () => loadSettings2(sb)).on("postgres_changes", { event: "*", schema: "public", table: TABLES.CATALOG }, () => loadSettings2(sb)).on("postgres_changes", { event: "*", schema: "public", table: TABLES.FAMILY_ROLES }, () => loadSettings2(sb)).on("postgres_changes", { event: "*", schema: "public", table: TABLES.MODELS }, () => loadSettings2(sb)).subscribe();
    } catch (err) {
      log("Realtime is off, running on the timer: " + err.message);
    }
    const release = () => {
    };
    window.addEventListener("pagehide", release);
    return () => {
      stopHb();
      stopFb();
      stopKick();
      clearTimeout(refreshTimer);
      if (channel) sb.removeChannel(channel);
      window.removeEventListener("pagehide", release);
    };
  }, [sb, apiKey]);
  useEffect(() => {
    const tryConnect = () => {
      if (!sbRef2.current) connect();
    };
    tryConnect();
    const t = setInterval(tryConnect, 15e3);
    return () => clearInterval(t);
  }, []);
  const status = !sb ? "Offline" : paused ? "Paused (admin)" : "Live";
  const statusStyle = !sb ? "bg-stone-800 text-stone-300 border-white/10" : paused ? "bg-rose-500/10 text-rose-300 border-rose-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-[#0a0a0a] text-slate-100 font-sans p-4 sm:p-6 space-y-5" }, /* @__PURE__ */ React.createElement("header", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Ico, { n: "cpu", className: "w-5 h-5 text-stone-950" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-lg font-extrabold" }, "AI Studio ", /* @__PURE__ */ React.createElement("span", { className: "text-amber-300" }, "Worker")), /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-stone-400" }, "Picks up a task, runs the model, uploads the photo to ImgBB + Cloudinary and saves the result"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-xs" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        purgeAllMemory();
        setMemStats(getMemoryStats());
        log("RAM and cache memory cleared");
      },
      title: "Clear RAM and caches now",
      className: "h-9 px-4 rounded-xl bg-rose-500 text-white text-xs font-extrabold shadow-lg"
    },
    "Purge"
  ), /* @__PURE__ */ React.createElement("button", { onClick: refreshAll, title: "Refresh", className: "h-9 w-9 flex items-center justify-center rounded-xl border border-white/10 bg-[#161616] text-stone-300" }, /* @__PURE__ */ React.createElement(Ico, { n: "refresh", className: "w-4 h-4" })), !sb && /* @__PURE__ */ React.createElement("button", { onClick: connect, disabled: !!sb, className: "h-9 px-4 rounded-xl bg-amber-400 text-stone-950 font-black disabled:opacity-40" }, "Connect"), /* @__PURE__ */ React.createElement("span", { className: "font-mono font-bold text-amber-300" }, workerId || "\u2014"), /* @__PURE__ */ React.createElement("span", { className: `px-2.5 py-1 rounded-lg border font-bold ${statusStyle}` }, status))), /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "grid gap-3 grid-cols-2 sm:grid-cols-6" }, [
    ["Running now", running],
    ["Done", myCounts.done ?? "\u2014"],
    ["Failed", myCounts.failed ?? "\u2014"],
    ["Tasks at once", isTurboMode ? `${currentConcurrency} (\u26A1 Turbo)` : currentConcurrency],
    ["Memory (RAM)", memStats.supported ? `${memStats.usedMB} MB` : `${inputCache.size} Cache`],
    ["Recycle (Done/Limit)", `${sessionTasksDone} / ${settings.worker_recycle_after_tasks || 50}`]
  ].map(([label, value]) => /* @__PURE__ */ React.createElement("div", { key: label, className: "bg-[#0f0f0f] border border-white/5 rounded-2xl p-4" }, /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-stone-400" }, label), /* @__PURE__ */ React.createElement("p", { className: "text-2xl font-extrabold font-mono text-stone-100" }, value)))), drain && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-sky-200 bg-sky-500/10 border border-sky-500/30 rounded-xl px-3 py-2" }, "Drain mode: no new tasks will be taken; running tasks will finish."), settings.budget_left != null && /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-stone-400" }, "Gemini budget left today:", " ", settings.budget_left), settings.disabled_models?.length > 0 && /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-stone-400" }, "Disabled models:", " ", settings.disabled_models.join(", ")), !paused && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => autoPause("Worker ne khud pause kiya (screen se)"), className: "h-9 px-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs font-bold" }, "Pause (take no new tasks)"), paused && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Ico, { n: "alert", className: "w-4 h-4" }), " ", "This worker is paused. It will not take new tasks; running tasks will finish. To resume, click Resume on the admin Workers screen."), /* @__PURE__ */ React.createElement("section", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("h2", { className: "text-sm font-extrabold flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Ico, { n: "image", className: "w-4 h-4 text-amber-300" }), " ", "This worker's tasks"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 items-center" }, [["pending", "Pending"], ["processing", "Processing"], ["done", "Completed"], ["failed", "Failed"]].map(([key, label]) => /* @__PURE__ */ React.createElement("button", { key, type: "button", onClick: () => pickTab(key), className: `h-8 px-3 rounded-lg text-xs font-bold border ${myTab === key ? "bg-amber-400 text-stone-950 border-amber-300" : "bg-[#161616] border-white/10 text-stone-300"}` }, label, myCounts[key] != null ? ` (${myCounts[key]})` : "")), myTab === "failed" && (myCounts.failed > 0 || myRows.length > 0) && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: clearAllFailed,
      className: "h-8 px-2.5 rounded-lg text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5",
      title: "Saare failed tasks DB se delete karein"
    },
    /* @__PURE__ */ React.createElement(Ico, { n: "trash", className: "w-3.5 h-3.5" }),
    " Clear Failed"
  ))), /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto bg-[#0f0f0f] border border-white/5 rounded-2xl" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-xs" }, /* @__PURE__ */ React.createElement("thead", { className: "text-left text-stone-400" }, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "#"), /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "App"), /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "Task"), /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "Model"), /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "Result"), /* @__PURE__ */ React.createElement("th", { className: "p-2" }, "Error"), /* @__PURE__ */ React.createElement("th", { className: "p-2 text-right" }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, myRows.map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.id, className: "border-t border-white/5 align-top" }, /* @__PURE__ */ React.createElement("td", { className: "p-2 font-mono text-amber-300" }, "#", t.id), /* @__PURE__ */ React.createElement("td", { className: "p-2" }, /* @__PURE__ */ React.createElement("span", { className: `px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase border ${t.app_id === "ppp" ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "bg-amber-400/10 text-amber-300 border-amber-400/30"}` }, t.app_id || "weargen")), /* @__PURE__ */ React.createElement("td", { className: "p-2" }, TASK_TYPES[t.task_type]?.label || t.task_type), /* @__PURE__ */ React.createElement("td", { className: "p-2 font-mono text-stone-400" }, t.model), /* @__PURE__ */ React.createElement("td", { className: "p-2" }, t.output_image_url && /* @__PURE__ */ React.createElement("a", { href: t.output_image_url, target: "_blank", rel: "noreferrer", className: "text-emerald-300 underline mr-2" }, "Photo"), t.output_text && /* @__PURE__ */ React.createElement("span", { className: "text-stone-200" }, t.output_text.slice(0, 120)), !t.output_image_url && !t.output_text && "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "p-2 text-rose-300" }, t.error || ""), /* @__PURE__ */ React.createElement("td", { className: "p-2 text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-end gap-1.5" }, (t.status === "pending" || t.status === "processing") && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => stopTask(t),
      className: "px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-bold",
      title: "Stop task immediately"
    },
    "Stop"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => deleteTask(t),
      className: "p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[11px]",
      title: "Database se permanently delete karein"
    },
    /* @__PURE__ */ React.createElement(Ico, { n: "trash", className: "w-3.5 h-3.5" })
  )))))))), myRows.length === 0 && /* @__PURE__ */ React.createElement("p", { className: "text-center text-xs text-stone-500 py-6" }, myCounts[myTab] == null ? "Pick a tab above" : "No tasks in this tab."), myCounts[myTab] > MY_PAGE_SIZE && /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between text-xs" }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: myPage === 0, onClick: () => goPage(myPage - 1), className: "h-8 px-3 rounded-lg border border-white/10 bg-[#161616] disabled:opacity-40" }, "Previous"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-stone-400" }, "Page ", myPage + 1, " / ", Math.ceil(myCounts[myTab] / MY_PAGE_SIZE)), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: (myPage + 1) * MY_PAGE_SIZE >= myCounts[myTab], onClick: () => goPage(myPage + 1), className: "h-8 px-3 rounded-lg border border-white/10 bg-[#161616] disabled:opacity-40" }, "Next"))), /* @__PURE__ */ React.createElement("section", { className: "bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xs font-extrabold flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Ico, { n: "check", className: "w-4 h-4 text-emerald-400" }), " Console & Activity Log"), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-stone-400 font-mono" }, "(", logs.length, "/30 max)"), logs.length > 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setLogs([]),
      className: "text-[10px] text-stone-400 hover:text-amber-300 underline font-mono ml-1",
      title: "Clear the log now"
    },
    "Clear"
  ))), /* @__PURE__ */ React.createElement("div", { className: "max-h-56 overflow-auto space-y-1 font-mono text-[11px] text-stone-300" }, logs.map((l, i) => /* @__PURE__ */ React.createElement("p", { key: i }, /* @__PURE__ */ React.createElement("span", { className: "text-stone-500" }, l.t), " ", l.text)), logs.length === 0 && /* @__PURE__ */ React.createElement("p", { className: "text-stone-500" }, "Connect to see the log here."))), running > 0 && /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-stone-500 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Ico, { n: "refresh", className: "w-3 h-3 animate-spin" }), " ", `${running} tasks running`)));
}
export {
  AiStudioWorker as default
};
