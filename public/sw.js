// Exists only so the browser treats this app as installable (Chrome/
// Edge require an active service worker with a fetch handler for the
// desktop "Install app" prompt). Deliberately does NOT cache anything —
// inventory, bookkeeping, and pricing data all change in real time, and
// serving a stale cached response for any of that would be a real bug
// for a dealer relying on it, not a performance win worth that risk.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
