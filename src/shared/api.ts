// src/shared/api.ts
//
// HOW TO USE:
// - In StackBlitz (no server), keep BASE = "LOCAL_ONLY": Save queues locally and downloads Excel.
// - When server is ready, set BASE = "/api" and use the proxy below (vite.config.ts).
//   Or set BASE = "https://YOUR_HOST" and skip the proxy.

export const API = {
  BASE: "LOCAL_ONLY", // "LOCAL_ONLY" | "/api" | "https://YOUR_HOST"
  LANGUAGE: "en",
  TENANT: "kids-english",
};

// POST JSON helper (throws "LOCAL_ONLY" to use local fallback)
export async function apiJson(path: string, body: any, method = "POST") {
  if (API.BASE === "LOCAL_ONLY") {
    throw new Error("LOCAL_ONLY");
  }
  const res = await fetch(`${API.BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} ${res.status}: ${text || res.statusText}`);
  }
  try { return await res.json(); } catch { return {}; }
}

/* ---------- Local queue so you don't lose work without a server ---------- */
const QUEUE_KEY = "lf.upload.queue.v1";

export function queuePush(batch: any) {
  const q = queueRead();
  q.push(batch);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function queueRead(): any[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}

export function queueClear() {
  localStorage.removeItem(QUEUE_KEY);
}
