// Vercel Serverless Function: POST /api/send-report
// Monolith backend — deployed alongside the static web app on Vercel.
// Emails an HTML report to the logged-in user via Resend.
//
// Vercel env vars required (Project → Settings → Environment Variables):
//   RESEND_API_KEY      — Resend API key (server-side secret)
//   SUPABASE_URL        — e.g. https://<ref>.supabase.co
//   SUPABASE_ANON_KEY   — anon key (used to validate the caller's JWT)
//
// Until carloan.com is DNS-verified on Resend, keep FROM as onboarding@resend.dev
// (only delivers to the Resend account owner). After verifying, switch to noreply@carloan.com.

const FROM = 'CarLoan <onboarding@resend.dev>';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const jwt = String(req.headers.authorization ?? '').replace('Bearer ', '');
    if (!jwt) { res.status(401).json({ error: 'Não autenticado' }); return; }

    // Validate the caller and get their email via Supabase Auth REST.
    const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: process.env.SUPABASE_ANON_KEY ?? '' },
    });
    if (!userResp.ok) { res.status(401).json({ error: 'Usuário inválido' }); return; }
    const user = await userResp.json();
    const email = user?.email;
    if (!email) { res.status(401).json({ error: 'E-mail do usuário não encontrado' }); return; }

    const { html, subject } = req.body ?? {};
    if (!html) { res.status(400).json({ error: 'Relatório vazio' }); return; }

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: subject ?? 'Seu relatório — CarLoan', html }),
    });
    if (!send.ok) { res.status(502).json({ error: `Resend: ${await send.text()}` }); return; }

    res.status(200).json({ ok: true, to: email });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
