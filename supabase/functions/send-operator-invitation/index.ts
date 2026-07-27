// Sends the operator activation/invitation email via Resend.
// Invoked server-to-server by private.notify_operator_invitation() (pg_net),
// authenticated with the project's own service_role JWT — never called
// directly from the browser and never receives an unauthenticated request
// (Supabase verifies the JWT before this code runs).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_ADDRESS = 'Edifica Digital <no-responder@mail.somosedificadigital.com>'
const ACTIVATION_BASE_URL = 'https://somosedificadigital.com/activar'
const LOGO_URL = 'https://somosedificadigital.com/apple-touch-icon.png'

const copy = {
  es: {
    subject: 'Activa tu cuenta en Edifica Digital',
    greeting: (name: string) => `Hola ${name},`,
    body: (org: string | null) => org
      ? `Confirma tu correo para activar tu acceso en <strong>${org}</strong>.`
      : 'Confirma tu correo para activar tu acceso en Edifica Digital.',
    cta: 'Activar mi cuenta',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    expiry: 'Este enlace vence en 7 días.',
  },
  en: {
    subject: 'Activate your Edifica Digital account',
    greeting: (name: string) => `Hi ${name},`,
    body: (org: string | null) => org
      ? `Confirm your email to activate your access at <strong>${org}</strong>.`
      : 'Confirm your email to activate your access on Edifica Digital.',
    cta: 'Activate my account',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    expiry: 'This link expires in 7 days.',
  },
}

function buildEmail({ display_name, activation_token, organization_name, language }: {
  display_name: string
  activation_token: string
  organization_name: string | null
  language: 'es' | 'en'
}) {
  const link = `${ACTIVATION_BASE_URL}?token=${activation_token}`
  const text = copy[language] ?? copy.en

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="padding: 16px 0; text-align: center;">
        <img src="${LOGO_URL}" alt="Edifica Digital" width="48" height="48" style="border-radius: 10px;" />
      </div>
      <p>${text.greeting(display_name)}</p>
      <p>${text.body(organization_name)}</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#5b2a86;color:#fff;text-decoration:none;border-radius:8px;">${text.cta}</a></p>
      <p style="font-size: 13px; color: #555;">${text.fallback}<br /><a href="${link}" style="color:#5b2a86;word-break:break-all;">${link}</a></p>
      <p>${text.expiry}</p>
    </div>
  `

  return { subject: text.subject, html }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), { status: 500 })
  }

  let payload: {
    email?: string
    display_name?: string
    activation_token?: string
    organization_name?: string | null
    language?: string
  }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { email, display_name, activation_token, organization_name = null, language = 'en' } = payload

  if (!email || !display_name || !activation_token) {
    return new Response(JSON.stringify({ error: 'email, display_name, and activation_token are required' }), { status: 400 })
  }

  const resolvedLanguage = language === 'es' ? 'es' : 'en'

  const { subject, html } = buildEmail({
    display_name,
    activation_token,
    organization_name: organization_name ?? null,
    language: resolvedLanguage,
  })

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject,
      html,
    }),
  })

  if (!resendResponse.ok) {
    const detail = await resendResponse.text()
    return new Response(JSON.stringify({ error: 'Resend request failed', detail }), { status: 502 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
