import axios from "axios";

const MUTATING_METHODS = new Set(["post", "put", "patch"]);

// Read-like / chat POST endpoints that should allow rapid/concurrent independent queries
const EXCLUDED_PATH_FRAGMENTS = [
  "/api/ai-assistant/chat",
  "/api/daily-learning/calculate-points",
  "/api/auth/dev-login",
  "/api/auth/switch-role",
  "/api/reports/",
  "/download",
  "/export",
];

const pendingMutations = new Map();

export function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function serializePayload(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    const entries = [];
    for (const [k, v] of data.entries()) {
      if (typeof File !== "undefined" && v instanceof File) {
        entries.push([k, `file:${v.name}:${v.size}:${v.lastModified}`]);
      } else {
        entries.push([k, String(v)]);
      }
    }
    return JSON.stringify(entries);
  }
  try {
    return JSON.stringify(data);
  } catch (_) {
    return String(data);
  }
}

function normalizeUrlKey(url) {
  if (!url) return "";
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch (_) {
    // keep raw url
  }
  return String(url);
}

function isExcludedPath(urlKey) {
  return EXCLUDED_PATH_FRAGMENTS.some((frag) => urlKey.includes(frag));
}

function cleanupPending(config) {
  const sig = config?.__mutationSignature;
  if (sig && pendingMutations.has(sig)) {
    pendingMutations.delete(sig);
  }
}

let installed = false;

export function installAxiosIdempotency() {
  if (installed) return;
  installed = true;

  if (!axios.defaults.timeout) {
    axios.defaults.timeout = 30000;
  }

  axios.interceptors.request.use(
    (config) => {
      const method = (config.method || "get").toLowerCase();
      const urlKey = normalizeUrlKey(config.url || "");

      // Automatically attach active user's Authorization and X-Employee-Id when available
      // (so backend endpoints never need hardcoded default employee fallbacks)
      if (!urlKey.includes("/api/auth/dev-login")) {
        config.headers = config.headers || {};
        const storedToken = localStorage.getItem("lms_token");
        if (storedToken && !config.headers["Authorization"] && !config.headers["authorization"]) {
          config.headers["Authorization"] = `Bearer ${storedToken}`;
        }
        let activeEmpId = localStorage.getItem("lms_active_employee_id");
        if (!activeEmpId) {
          try {
            const u = JSON.parse(localStorage.getItem("lms_user") || "{}");
            activeEmpId = u.employee_id || u.empId;
          } catch (_) {
            // ignore
          }
        }
        if (activeEmpId && !config.headers["X-Employee-Id"] && !config.headers["x-employee-id"]) {
          config.headers["X-Employee-Id"] = activeEmpId;
        }
      }

      if (!MUTATING_METHODS.has(method) || isExcludedPath(urlKey)) {
        return config;
      }

      // Build deterministic signature for identical concurrent in-flight mutations
      const sig = `${method}:${urlKey}:${serializePayload(config.data)}`;
      if (pendingMutations.has(sig)) {
        const dupErr = new Error("Request is already in progress. Duplicate submission blocked.");
        dupErr.isDuplicateInFlight = true;
        dupErr.code = "ERR_DUPLICATE_IN_FLIGHT";
        dupErr.config = config;
        return Promise.reject(dupErr);
      }

      // Ensure X-Idempotency-Key is attached on every mutating call
      config.headers = config.headers || {};
      const existingKey =
        config.headers["X-Idempotency-Key"] || config.headers["x-idempotency-key"];
      if (!existingKey) {
        config.headers["X-Idempotency-Key"] = generateIdempotencyKey();
      }

      config.__mutationSignature = sig;
      pendingMutations.set(sig, true);
      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => {
      cleanupPending(response?.config);
      return response;
    },
    (error) => {
      if (!error?.isDuplicateInFlight) {
        cleanupPending(error?.config);
      }
      return Promise.reject(error);
    }
  );
}

installAxiosIdempotency();

