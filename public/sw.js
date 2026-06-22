// Service Worker: 家庭场景英语 PWA
// 策略：
//   - 静态资源（JS/CSS/图片/字体）：缓存优先，后台更新
//   - API 请求：网络优先，失败降级缓存
//   - 导航请求：网络优先，失败降级到缓存的 index.html

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `yingyu-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `yingyu-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// 预缓存的核心资源
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/favicon.svg',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] 预缓存部分资源失败（可忽略）:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 判断是否为静态资源
function isStaticAsset(url) {
  const pathname = url.pathname;
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/scenes/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2')
  );
}

// 判断是否为 API 请求
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/health');
}

// 判断是否为导航请求
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// 缓存优先 + 后台更新（静态资源）
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // 后台更新
    fetch(request).then((res) => {
      if (res && res.ok) {
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, res));
      }
    }).catch(() => {});
    return cached;
  }
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

// 网络优先 + 缓存降级（API 和导航）
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // 只缓存成功的 GET 请求
    if (res && res.ok && request.method === 'GET') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    // 网络失败，尝试缓存
    const cached = await caches.match(request);
    if (cached) return cached;
    // 导航请求降级到首页
    if (isNavigationRequest(request)) {
      const fallback = await caches.match(OFFLINE_URL);
      if (fallback) return fallback;
    }
    throw err;
  }
}

// 请求拦截
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 非 GET 请求直接走网络
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// 消息通信：接收更新指令
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
