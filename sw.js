// Minimal no-op service worker to silence 404s and allow future enhancements.
self.addEventListener('install', (event) => {
  // Activate immediately after installation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of uncontrolled clients asap
  event.waitUntil(self.clients.claim());
});

// No caching or special handling; just a pass-through

