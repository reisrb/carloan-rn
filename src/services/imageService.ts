import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUCKET = 'images';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  let base64 = '';

  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : NaN;
    const b3 = i + 2 < len ? bytes[i + 2] : NaN;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
    const enc3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
    const enc4 = isNaN(b3) ? 64 : b3 & 63;

    base64 += chars[enc1] + chars[enc2] +
              (enc3 === 64 ? '=' : chars[enc3]) +
              (enc4 === 64 ? '=' : chars[enc4]);
  }
  return base64;
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
      const cacheKey = `carloan_img_${path}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        return `data:image/jpeg;base64,${cached}`;
      }

      const signedUrl = await this.getSignedUrl(path);
      if (!signedUrl) return null;

      const res = await fetch(signedUrl);
      const buffer = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      
      await AsyncStorage.setItem(cacheKey, base64);
      return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.error('Error caching image:', e);
      return this.getSignedUrl(path);
    }
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path]);
    try {
      await AsyncStorage.removeItem(`carloan_img_${path}`);
    } catch (e) {
      // Ignore
    }
  },
};
