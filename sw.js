const CACHE_NAME = "diet-tracker-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

/* metadata: GPT-5 Codex; time: 2026-06-28 00:00 Australia/Sydney; date: 2026-06-28; prompt: Create a local-first PWA app called "CSIRO Diet Tracker" for iPhone with daily category tracking, meal editing/copying, 7-day summary, unit guide, and CSV export. */

/* metadata: GPT-5 Codex; time: 2026-06-28 10:35 Australia/Sydney; date: 2026-06-28; prompt: Remove CSIRO wording, move menu to bottom, standardize progress colours, add date picker/today navigation, let CSV export choose save location, and make 7-day totals end at selected day. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:39 Australia/Sydney; date: 2026-06-28; prompt: Clean literal newline markers introduced by scripted edits and tidy stale CSS selector after requested Diet Tracker UI changes. */

/* metadata: GPT-5 Codex; time: 2026-06-29 09:20 Australia/Sydney; date: 2026-06-29; prompt: Add a version number and change Export CSV to Import/Export with CSV export plus versioned JSON save/load. */
/* metadata: GPT-5 Codex; time: 2026-06-29 09:24 Australia/Sydney; date: 2026-06-29; prompt: Clean literal escaped newline markers after adding versioned JSON import/export. */
