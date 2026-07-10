import { Platform } from 'react-native';
import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUCKET = 'images';
const ASYNC_PREFIX = 'carloan_img2_';
const TMP_DIR = `${FileSystem.cacheDirectory}img_tmp/`;

// In-memory layer: path → data URI. Avoids AsyncStorage round-trip within session.
const memCache = new Map<string, string | null>();

let tmpDirReady: Promise<void> | null = null;
function getTmpDirReady(): Promise<void> {
  if (!tmpDirReady) {
    tmpDirReady = FileSystem.getInfoAsync(TMP_DIR).then(info => {
      if (!info.exists) return FileSystem.makeDirectoryAsync(TMP_DIR, { intermediates: true });
    });
  }
  return tmpDirReady;
}

async function downloadAsBase64(signedUrl: string): Promise<string | null> {
  await getTmpDirReady();
  const tmp = `${TMP_DIR}${generateId()}.jpg`;
  try {
    const dl = await FileSystem.downloadAsync(signedUrl, tmp);
    if (dl.status !== 200) return null;
    const b64 = await FileSystem.readAsStringAsync(tmp, { encoding: FileSystem.EncodingType.Base64 });
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } finally {
    FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => null);
  }
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

// Web: downscale + recompress the image in-browser (canvas) before upload so
// car photos stay small and load fast. No-op fallback to raw bytes on failure.
async function toUploadBody(uri: string, maxDim = 1000, quality = 0.5): Promise<ArrayBuffer> {
  if (Platform.OS !== 'web') return uriToArrayBuffer(uri);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = uri;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return uriToArrayBuffer(uri);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob ? await blob.arrayBuffer() : uriToArrayBuffer(uri);
  } catch {
    return uriToArrayBuffer(uri);
  }
}

export const imageService = {
  async uploadCarPhoto(financingId: string, uri: string): Promise<string> {
    const userId = await getUserId();
    const path = `${userId}/${financingId}-car-${generateId()}.jpg`;
    const body = await toUploadBody(uri, 480, 0.5);
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
    const body = await toUploadBody(uri, 1400, 0.6);
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
    // 1. Memory hit — instant, no I/O
    if (memCache.has(path)) return memCache.get(path) ?? null;

    // 2. AsyncStorage hit — fast, no network
    try {
      const stored = await AsyncStorage.getItem(ASYNC_PREFIX + path);
      if (stored) {
        memCache.set(path, stored);
        return stored;
      }
    } catch { /* ignore */ }

    // 3. Network miss — download, encode, persist
    try {
      const signedUrl = await this.getSignedUrl(path);
      if (!signedUrl) { memCache.set(path, null); return null; }

      const dataUri = await downloadAsBase64(signedUrl);
      memCache.set(path, dataUri);
      if (dataUri) AsyncStorage.setItem(ASYNC_PREFIX + path, dataUri).catch(() => null);
      return dataUri;
    } catch {
      return this.getSignedUrl(path);
    }
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path]);
    memCache.delete(path);
    AsyncStorage.removeItem(ASYNC_PREFIX + path).catch(() => null);
  },
};
