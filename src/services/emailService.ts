import { supabase } from '../lib/supabase';

/** Emails the given HTML report to the logged-in user via the send-report Edge Function. */
export async function sendReportByEmail(html: string, subject: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-report', { body: { html, subject } });
  if (error) throw new Error(error.message ?? 'Falha ao enviar e-mail');
  if (data?.error) throw new Error(data.error);
  return data?.to ?? '';
}
