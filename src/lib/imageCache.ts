// 图片缓存：用 IndexedDB 持久化存储场景插画，避免重复请求 trae-api 浪费 token
// 首次加载后存入 IndexedDB，后续同场景直接读缓存

const DB_NAME = 'family-eng-images';
const STORE = 'scenes';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// 从缓存读取图片 blob
export async function getCachedImage(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// 存入缓存
export async function setCachedImage(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // 缓存失败不影响主流程
  }
}

// 从 URL 下载图片并存入缓存，返回 blob
export async function fetchAndCacheImage(key: string, url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 0) {
      await setCachedImage(key, blob);
    }
    return blob;
  } catch {
    return null;
  }
}

// 获取图片：先查缓存，未命中则从 URL 下载并缓存
export async function getImage(key: string, url: string): Promise<{ blob: Blob | null; fromCache: boolean }> {
  const cached = await getCachedImage(key);
  if (cached) return { blob: cached, fromCache: true };
  const blob = await fetchAndCacheImage(key, url);
  return { blob, fromCache: false };
}
