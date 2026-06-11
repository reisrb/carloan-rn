import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'images';
const CACHE_DIR = `${FileSystem.documentDirectory}img_cache/`;

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

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
    try {
      await ensureCacheDir();
      const localPath = cacheFilePath(path);
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) return localPath;

      const signedUrl = await this.getSignedUrl(path);
      if (!signedUrl) return null;

      const result = await FileSystem.downloadAsync(signedUrl, localPath);
      return result.status === 200 ? result.uri : null;
    } catch {
      return this.getSignedUrl(path);
    }
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path]);
    try {
      await FileSystem.deleteAsync(cacheFilePath(path), { idempotent: true });
    } catch {
      // ignore
    }
  },
};
