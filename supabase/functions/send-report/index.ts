// Supabase Edge Function: send-report
// Emails a report (HTML) to the logged-in user via Resend.
// Secrets required (set with `supabase secrets set` or in the dashboard):
//   RESEND_API_KEY   — Resend API key (never commit it)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FROM = 'CarLoan <noreply@carloan.com>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Não autenticado' }, 401);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: { user }, error: userErr } = await supa.auth.getUser(jwt);
    if (userErr || !user?.email) return json({ error: 'Usuário inválido' }, 401);

    const { html, subject } = await req.json();
    if (!html) return json({ error: 'Relatório vazio' }, 400);

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: subject ?? 'Seu relatório — CarLoan',
        html,
      }),
    });

    if (!resp.ok) return json({ error: `Resend: ${await resp.text()}` }, 502);
    return json({ ok: true, to: user.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
