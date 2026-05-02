// ============================================================
// sw.js - Service Worker (وضع Offline)
// ============================================================

const CACHE_NAME = 'pos-v2.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// تثبيت - تخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.map(url => new Request(url, { mode: 'cors' }))).catch(() => {
        // تجاهل الأخطاء
      });
    })
  );
  self.skipWaiting();
});

// تفعيل - حذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  // تجاهل API
  if (event.request.url.includes('api.php') || event.request.url.includes('auth.php')) {
    return event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'أنت offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
  }

  // Cache First للملفات الثابتة
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // إرجاع الصفحة الرئيسية
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
