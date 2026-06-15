import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'images';
const CACHE_DIR = `${FileSystem.documentDirectory}img_cache/`;

// Singleton: ensureCacheDir runs only once per session
let cacheDirReady: Promise<void> | null = null;
function getCacheDirReady(): Promise<void> {
  if (!cacheDirReady) {
    cacheDirReady = FileSystem.getInfoAsync(CACHE_DIR).then(info => {
      if (!info.exists) return FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    });
  }
  return cacheDirReady;
}

// In-memory cache: path → local file URI (avoids disk stat on every load)
const memCache = new Map<string, string | null>();

function cacheFilePath(storagePath: string): string {
  const safe = storagePath.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${CACHE_DIR}${safe}.jpg`;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

export const imageService = {
  async uploadCarPhoto(financingId: string, uri: string): Promise<string> {
    const userId = await getUserId();
    const path = `${userId}/${financingId}-car-${generateId()}.jpg`;
    const body = await uriToArrayBuffer(uri);
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return path;
  },

  async uploadReceipt(uri: string): Promise<string> {
    const userId = await getUserId();
    const path = `${userId}/receipts/${generateId()}.jpg`;
    const body = await uriToArrayBuffer(uri);
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: 'image/jpeg',
    });
    if (error) throw new Error(error.message);
    return path;
  },

  async getSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  },

  async getOrCachePhoto(path: string): Promise<string | null> {
    // Memory hit: instant
    if (memCache.has(path)) return memCache.get(path) ?? null;

    try {
      await getCacheDirReady();
      const localPath = cacheFilePath(path);
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        memCache.set(path, localPath);
        return localPath;
      }

      // Disk miss: download once and persist
      const signedUrl = await this.getSignedUrl(path);
      if (!signedUrl) { memCache.set(path, null); return null; }

      const result = await FileSystem.downloadAsync(signedUrl, localPath);
      const uri = result.status === 200 ? result.uri : null;
      memCache.set(path, uri);
      return uri;
    } catch {
      return this.getSignedUrl(path);
    }
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path]);
    memCache.delete(path);
    try {
      await FileSystem.deleteAsync(cacheFilePath(path), { idempotent: true });
    } catch {
      // ignore
    }
  },
};
