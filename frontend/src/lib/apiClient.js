// apiClient — fetch wrapper with cold-start detection and consistent error shape.
// Replaces axios. Lives at the top of the data layer so every request runs
// through the same lifecycle (timing, error mapping, JSON handling, cookies).

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Threshold (ms) for marking a request as a likely Render cold-start. */
const COLD_START_MS = 2500;

/** Listeners that get notified when a request crosses the cold-start threshold. */
const coldStartListeners = new Set();
let coldStartActive = 0;

function notifyColdStart(active) {
  for (const fn of coldStartListeners) fn(active);
}

export function onColdStart(listener) {
  coldStartListeners.add(listener);
  return () => coldStartListeners.delete(listener);
}

export class ApiError extends Error {
  constructor({ status, statusText, message, body }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

function defaultMessageForStatus(status, body) {
  if (body && typeof body === "object" && typeof body.detail === "string") {
    return body.detail;
  }
  if (status === 401) return "You're signed out. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That action conflicts with the current state.";
  if (status === 422) return "Some fields look invalid. Please review and retry.";
  if (status >= 500) return "The server hit an error. Please try again.";
  return "Something went wrong.";
}

async function parseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204) return null;
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  if (contentType.startsWith("text/")) return await response.text();
  return null;
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Core fetch wrapper.
 * @param {object} opts
 * @param {string} opts.path           Path relative to VITE_API_URL (e.g. "/templates")
 * @param {string} [opts.method]       HTTP verb. Defaults to "GET".
 * @param {object} [opts.params]       Query params.
 * @param {any}    [opts.body]         JSON body (auto-stringified). Pass FormData for uploads.
 * @param {Headers|object} [opts.headers]
 * @param {AbortSignal} [opts.signal]
 * @param {(pct: number) => void} [opts.onUploadProgress]   Currently best-effort; only fires for FormData uploads via XHR fallback.
 * @returns {Promise<any>} Parsed body (JSON, text, or null for 204).
 */
async function request({
  path,
  method = "GET",
  params,
  body,
  headers,
  signal,
  onUploadProgress,
} = {}) {
  if (!BASE_URL) {
    throw new ApiError({
      status: 0,
      message:
        "VITE_API_URL is not set. Add it to .env.local and restart the dev server.",
    });
  }

  const url = buildUrl(path, params);
  const isFormData = body instanceof FormData;
  const init = {
    method,
    credentials: "include",
    headers: new Headers(headers || {}),
    signal,
  };

  if (body !== undefined && body !== null) {
    if (isFormData) {
      init.body = body;
    } else {
      init.headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(body);
    }
  }

  // Cold-start detector: arms a timer; clears it as soon as headers arrive.
  let coldStartTimer = setTimeout(() => {
    coldStartActive += 1;
    notifyColdStart(coldStartActive);
  }, COLD_START_MS);

  let response;
  try {
    if (isFormData && onUploadProgress) {
      response = await xhrUpload({ url, init, body, onUploadProgress });
    } else {
      response = await fetch(url, init);
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError({
      status: 0,
      message:
        "Network error — check your connection or that the backend is reachable.",
      body: { cause: String(err) },
    });
  } finally {
    clearTimeout(coldStartTimer);
    if (coldStartActive > 0) {
      coldStartActive -= 1;
      notifyColdStart(coldStartActive);
    }
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      statusText: response.statusText,
      message: defaultMessageForStatus(response.status, parsed),
      body: parsed,
    });
  }
  return parsed;
}

/** XHR-backed upload that exposes real progress events. */
function xhrUpload({ url, init, body, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method || "POST", url, true);
    xhr.withCredentials = true;
    if (init.headers) {
      for (const [k, v] of init.headers.entries()) {
        if (k.toLowerCase() === "content-type") continue; // browser sets multipart boundary
        xhr.setRequestHeader(k, v);
      }
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      const headers = new Headers();
      xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
          const [name, ...rest] = line.split(": ");
          if (name) headers.append(name, rest.join(": "));
        });
      resolve(
        new Response(xhr.responseText || null, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers,
        })
      );
    };
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.onabort = () => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
    };
    if (init.signal) {
      init.signal.addEventListener("abort", () => xhr.abort());
    }
    xhr.send(body);
  });
}

export const apiClient = {
  request,
  get: (path, opts = {}) => request({ ...opts, path, method: "GET" }),
  post: (path, body, opts = {}) =>
    request({ ...opts, path, method: "POST", body }),
  put: (path, body, opts = {}) =>
    request({ ...opts, path, method: "PUT", body }),
  patch: (path, body, opts = {}) =>
    request({ ...opts, path, method: "PATCH", body }),
  delete: (path, opts = {}) => request({ ...opts, path, method: "DELETE" }),
};
