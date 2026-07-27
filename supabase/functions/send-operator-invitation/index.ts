// Sends the operator activation/invitation email via Resend.
// Invoked server-to-server by private.notify_operator_invitation() (pg_net),
// authenticated with the project's own service_role JWT — never called
// directly from the browser and never receives an unauthenticated request
// (Supabase verifies the JWT before this code runs).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_ADDRESS = 'Edifica Digital <no-responder@mail.somosedificadigital.com>'
const ACTIVATION_BASE_URL = 'https://somosedificadigital.com/activar'

function buildEmail({ display_name, activation_token, organization_name }: {
  display_name: string
  activation_token: string
  organization_name: string | null
}) {
  const link = `${ACTIVATION_BASE_URL}?token=${activation_token}`
  const org = organization_name ? ` de ${organization_name}` : ''
  const orgEn = organization_name ? ` for ${organization_name}` : ''

  const subject = 'Activa tu cuenta en Edifica Digital / Activate your Edifica Digital account'

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hola ${display_name},</p>
      <p>Confirma tu correo para activar tu acceso${org} en Edifica Digital.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#5b2a86;color:#fff;text-decoration:none;border-radius:8px;">Activar mi cuenta</a></p>
      <p>Este enlace vence en 7 días.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
      <p>Hi ${display_name},</p>
      <p>Confirm your email to activate your access${orgEn} on Edifica Digital.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#5b2a86;color:#fff;text-decoration:none;border-radius:8px;">Activate my account</a></p>
      <p>This link expires in 7 days.</p>
    </div>
  `

  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), { status: 500 })
  }

  let payload: { email?: string; display_name?: string; activation_token?: string; organization_name?: string | null }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { email, display_name, activation_token, organization_name = null } = payload

  if (!email || !display_name || !activation_token) {
    return new Response(JSON.stringify({ error: 'email, display_name, and activation_token are required' }), { status: 400 })
  }

  const { subject, html } = buildEmail({ display_name, activation_token, organization_name: organization_name ?? null })

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
