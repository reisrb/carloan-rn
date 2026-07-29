import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Emails the given HTML report to the logged-in user.
 * - Web: calls the Vercel serverless function /api/send-report (same origin).
 * - Native: falls back to the Supabase Edge Function send-report.
 */
export async function sendReportByEmail(html: string, subject: string): Promise<string> {
  if (Platform.OS === 'web') {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ html, subject }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error ?? 'Falha ao enviar e-mail');
    return data?.to ?? '';
  }

  const { data, error } = await supabase.functions.invoke('send-report', { body: { html, subject } });
  if (error) throw new Error(error.message ?? 'Falha ao enviar e-mail');
  if (data?.error) throw new Error(data.error);
  return data?.to ?? '';
}
