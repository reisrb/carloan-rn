// Vercel Serverless Function: POST /api/send-report
// Backend that emails an HTML report to the logged-in user via SMTP (nodemailer).
//
// Vercel env vars (Project → Settings → Environment Variables):
//   SMTP_HOST         — e.g. smtp-mail.outlook.com / smtp.gmail.com
//   SMTP_PORT         — 587 (STARTTLS) or 465 (SSL). Default 587.
//   SMTP_USER         — SMTP username / full email
//   SMTP_PASS         — SMTP password or app-password
//   SMTP_FROM         — optional "Nome <email>"; defaults to SMTP_USER
//   SUPABASE_URL      — https://<ref>.supabase.co
//   SUPABASE_ANON_KEY — anon key (used to validate the caller's JWT)
import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
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

    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: subject ?? 'Seu relatório — CarLoan',
      html,
    });

    res.status(200).json({ ok: true, to: email });
  } catch (e: any) {
    res.status(502).json({ error: e?.message ? `SMTP: ${e.message}` : String(e) });
  }
}
