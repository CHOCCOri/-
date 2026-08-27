/* Möbius Service Worker · notification + push router + offline shell · v2 */
'use strict';

const DB_NAME = 'dream-messenger-sw-v1';
const DB_VERSION = 1;
const STORE = 'state';

/* ------------------------------------------------------------------
 * 缓存版本：改动 index.html / sw.js / 图标后请 +1，激活时会清理旧壳缓存。
 * 前缀 mobius-shell- 是本 SW 独占的命名空间。
 * 应用自身的 mobius-image-resilience-v1（媒体韧性缓存，最多 64MB 用户媒体）
 * 由页面代码管理，本 SW 绝不可删除或拦截。
 * ------------------------------------------------------------------ */
const CACHE_VERSION = 'v7';
const SHELL_CACHE = `mobius-shell-${CACHE_VERSION}`;
const SHELL_CACHE_PREFIX = 'mobius-shell-';
const APP_MEDIA_CACHE = 'mobius-image-resilience-v1'; // 应用私有，永不触碰

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/badge-96.png',
  './icons/favicon-32.png',
  './icons/favicon-64.png'
];

// 运行时缓存的第三方资源（lucide 图标库走 CDN，缓存后离线仍有图标）
const RUNTIME_ALLOW_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net'];

let preferences = {
  systemNotificationEnabled: true,
  notificationOnlyBackground: false,
  notificationDndEnabled: false,
  notificationDndStart: '22:00',
  notificationDndEnd: '08:00'
};

/* ========================== 状态存储（原样保留） ========================== */

function openDb() {
  return new Promise(resolve => {
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (_) { resolve(null); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => resolve(null);
  });
}

async function getState(key, fallback) {
  const db = await openDb();
  if (!db) return fallback;
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; try { db.close(); } catch (_) {} resolve(value); };
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => finish(request.result?.value ?? fallback);
      request.onerror = tx.onerror = tx.onabort = () => finish(fallback);
    } catch (_) { finish(fallback); }
  });
}

async function setState(key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; try { db.close(); } catch (_) {} resolve(ok); };
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => finish(true);
      tx.onerror = tx.onabort = () => finish(false);
    } catch (_) { finish(false); }
  });
}

/* ========================== 免打扰 / 推送载荷（原样保留） ========================== */

function parseMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  return match ? (Number(match[1]) % 24) * 60 + Math.min(59, Number(match[2]) || 0) : 0;
}

function isInDnd(settings) {
  if (!settings.notificationDndEnabled) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseMinutes(settings.notificationDndStart || '22:00');
  const end = parseMinutes(settings.notificationDndEnd || '08:00');
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function normalizePushPayload(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const receivedAt = Number(payload.receivedAt || payload.createdAt) || Date.now();
  const routeData = payload.routeData && typeof payload.routeData === 'object' ? payload.routeData : (payload.data && typeof payload.data === 'object' ? payload.data : {});
  return {
    ...payload,
    id: String(payload.id || `push-${receivedAt}-${Math.random().toString(36).slice(2)}`),
    title: String(payload.title || 'Möbius'),
    body: String(payload.body || payload.text || '您有一条新消息'),
    route: String(payload.route || routeData.route || 'home'),
    routeData,
    tag: String(payload.tag || `dream-${receivedAt}`),
    createdAt: Number(payload.createdAt) || receivedAt,
    receivedAt
  };
}

async function appendInbox(payload) {
  const inbox = await getState('pushInbox', []);
  const list = Array.isArray(inbox) ? inbox : [];
  if (!list.some(item => item?.id && item.id === payload.id)) list.push(payload);
  await setState('pushInbox', list.slice(-100));
}

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - String(value).length % 4) % 4);
  const base64 = (String(value) + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

/* ========================== 生命周期 ========================== */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // 预缓存失败不能阻断安装：单个资源 404 时仍要让通知功能可用。
    try {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' })))
      );
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    preferences = { ...preferences, ...(await getState('preferences', {})) };
    // 只清理本 SW 自己的旧版壳缓存；应用的媒体韧性缓存必须原样保留。
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => {
        if (key === APP_MEDIA_CACHE) return null;
        if (key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE) return caches.delete(key);
        return null;
      }));
    } catch (_) {}
    await self.clients.claim();
  })());
});

/* ========================== fetch：离线可用 ========================== */

function isPrecachedAsset(url) {
  const path = url.pathname.replace(/\/+$/, '/');
  return PRECACHE_URLS.some(entry => {
    const clean = entry.replace('./', '');
    return clean && (path.endsWith(`/${clean}`) || path === `/${clean}`);
  });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  // 1) 应用私有媒体缓存（https://mobius.local/__media_cache__/...）：完全放行，
  //    由页面自己的 caches API 处理，SW 一旦介入会破坏媒体兜底恢复。
  if (url.hostname === 'mobius.local') return;

  // 2) AI 中继等跨域 API：绝不缓存也不拦截。
  if (url.origin !== self.location.origin) {
    if (RUNTIME_ALLOW_HOSTS.includes(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    }
    return;
  }

  // 3) Cloudflare 注入脚本在自托管下会 404，直接放行不缓存。
  if (url.pathname.startsWith('/cdn-cgi/')) return;

  // 4) 页面导航：先给缓存（秒开），后台静默更新，有新版本再通知页面。
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match('./index.html') || await cache.match('./');
      const network = fetch(request).then(async response => {
        if (response && response.ok) {
          await cache.put('./index.html', response.clone()).catch(() => {});
          if (cached) notifyIfShellChanged(cached, response.clone());
        }
        return response;
      }).catch(() => null);

      if (cached) { event.waitUntil(network); return cached; }
      const fresh = await network;
      return fresh || new Response(
        '<!doctype html><meta charset="utf-8"><title>Möbius 离线</title>' +
        '<body style="font-family:system-ui;background:#111318;color:#e8f2f5;display:grid;place-items:center;height:100vh;margin:0">' +
        '<div style="text-align:center"><h1 style="font-weight:600">离线</h1>' +
        '<p style="opacity:.7">首次加载需要联网，之后即可离线使用。</p></div>',
        { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 }
      );
    })());
    return;
  }

  // 5) 图标 / manifest 等静态资源：SWR。
  if (isPrecachedAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});

// 对比新旧 index.html，内容变化时提示页面«有新版本»（页面可自行决定是否刷新）。
async function notifyIfShellChanged(oldResponse, newResponse) {
  try {
    const [a, b] = await Promise.all([oldResponse.clone().text(), newResponse.text()]);
    if (a.length === b.length) return;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'SHELL_UPDATED', size: b.length }));
  } catch (_) {}
}

/* ========================== 消息协议（保持向后兼容） ========================== */

self.addEventListener('message', event => {
  const message = event.data || {};
  const reply = value => { try { event.ports?.[0]?.postMessage(value); } catch (_) {} };
  if (message.type === 'SKIP_WAITING') {
    event.waitUntil(Promise.resolve(self.skipWaiting()).then(() => reply({ ok: true })));
    return;
  }
  if (message.type === 'CONFIGURE_NOTIFICATIONS') {
    preferences = { ...preferences, ...(message.preferences || {}) };
    event.waitUntil(setState('preferences', preferences).then(ok => reply({ ok })));
    return;
  }
  if (message.type === 'CONFIGURE_PUSH') {
    event.waitUntil(setState('pushConfig', {
      applicationServerKey: message.applicationServerKey || '',
      subscribeEndpoint: message.subscribeEndpoint || ''
    }).then(ok => reply({ ok })));
    return;
  }
  if (message.type === 'DRAIN_PUSH_INBOX') {
    event.waitUntil((async () => {
      const items = await getState('pushInbox', []);
      await setState('pushInbox', []);
      reply({ ok: true, items: Array.isArray(items) ? items : [] });
    })());
    return;
  }
  if (message.type === 'PING') {
    reply({ ok: true, now: Date.now() });
    return;
  }
  // 新增：查询缓存状态，供「存储中心」展示离线就绪情况。
  if (message.type === 'CACHE_STATUS') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        const keys = await cache.keys();
        reply({ ok: true, version: CACHE_VERSION, cached: keys.length, urls: keys.map(r => r.url) });
      } catch (_) { reply({ ok: false }); }
    })());
    return;
  }
  // 新增：强制刷新离线壳（存储中心「更新离线缓存」按钮可调用）。
  if (message.type === 'REFRESH_SHELL') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await Promise.allSettled(PRECACHE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' }))));
        reply({ ok: true });
      } catch (_) { reply({ ok: false }); }
    })());
    return;
  }
  reply({ ok: false, error: 'unknown-message' });
});

/* ========================== 推送（原样保留） ========================== */

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let raw = {};
    try { raw = event.data?.json() || {}; }
    catch (_) { raw = { body: event.data?.text() || '您有一条新消息' }; }
    const payload = normalizePushPayload(raw);

    // 不再等待 inbox 完整读写后才显示通知：持久化、客户端投递和系统通知并行进行。
    const inboxPromise = appendInbox(payload);
    const clientsPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const settingsPromise = getState('preferences', preferences).then(saved => ({ ...preferences, ...(saved || {}) }));
    const [clients, settings] = await Promise.all([clientsPromise, settingsPromise]);
    preferences = settings;

    const clientDelivery = Promise.allSettled(clients.map(client => Promise.resolve().then(() => client.postMessage({ type: 'PUSH_RECEIVED', payload }))));
    const hasVisibleClient = clients.some(client => client.visibilityState === 'visible');
    let notificationPromise = Promise.resolve();
    if (settings.systemNotificationEnabled !== false && !isInDnd(settings) && !(settings.notificationOnlyBackground && hasVisibleClient)) {
      const options = {
        body: payload.body,
        icon: payload.icon || './icons/icon-192.png',
        badge: payload.badge || './icons/badge-96.png',
        tag: payload.tag,
        renotify: payload.renotify !== false,
        requireInteraction: Boolean(payload.requireInteraction),
        timestamp: payload.createdAt,
        data: { id: payload.id, route: payload.route, routeData: payload.routeData, ...payload.routeData }
      };
      notificationPromise = self.registration.showNotification(payload.title, options);
    }
    await Promise.allSettled([inboxPromise, clientDelivery, notificationPromise]);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const data = event.notification.data || {};
  const route = data.route || 'home';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = windows.find(client => client.visibilityState === 'visible') || windows[0];
    if (target) {
      await target.focus();
      target.postMessage({ type: 'NOTIFICATION_CLICK', route, data: { ...(data.routeData || {}), ...data } });
      return;
    }
    const url = new URL('./', self.registration.scope);
    url.hash = `route=${encodeURIComponent(route)}`;
    await self.clients.openWindow(url.href);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const config = await getState('pushConfig', {});
    let subscription = null;
    try {
      if (config?.applicationServerKey) {
        subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.applicationServerKey)
        });
        if (config.subscribeEndpoint) {
          await fetch(config.subscribeEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON(), scope: self.registration.scope, reason: 'pushsubscriptionchange' })
          });
        }
      }
    } catch (_) { subscription = null; }
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', resubscribeRequired: !subscription }));
  })());
});
