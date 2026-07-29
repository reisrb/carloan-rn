import { supabase } from '../lib/supabase';

/**
 * Emails the given HTML report to the logged-in user via the backend
 * (Vercel serverless function /api/send-report → SMTP/nodemailer).
 */
export async function sendReportByEmail(html: string, subject: string): Promise<string> {
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
