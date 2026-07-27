import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import '../in-kind/in-kind.css'

const copy = {
  es: {
    brand: 'somos',
    brandBold: 'edifica',
    brandRest: 'digital',
    checkingTitle: 'Confirmando tu correo',
    checkingBody: 'Un momento, estamos activando tu acceso.',
    successTitle: 'Cuenta activada',
    successBody: 'Tu correo quedó confirmado. Ya puedes ingresar al panel con tu correo.',
    successCta: 'Ir al panel',
    invalidTitle: 'Enlace no válido o vencido',
    invalidBody: 'Pide a un administrador que te reenvíe la invitación desde el panel de usuarios.',
    missingTitle: 'Falta el enlace de activación',
    missingBody: 'Abre el enlace completo que recibiste por correo.',
  },
  en: {
    brand: 'somos',
    brandBold: 'edifica',
    brandRest: 'digital',
    checkingTitle: 'Confirming your email',
    checkingBody: 'One moment, activating your access.',
    successTitle: 'Account activated',
    successBody: 'Your email is confirmed. You can now sign in to the dashboard.',
    successCta: 'Go to dashboard',
    invalidTitle: 'This link is invalid or expired',
    invalidBody: 'Ask an administrator to resend your invitation from the users panel.',
    missingTitle: 'Missing activation link',
    missingBody: 'Open the full link from the invitation email.',
  },
}

export default function ActivateAccountPage() {
  const [language, setLanguage] = useState(document.documentElement.lang === 'en' ? 'en' : 'es')
  const [status, setStatus] = useState('checking')
  const text = copy[language]

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('missing')
      return
    }
    if (!supabase) {
      setStatus('invalid')
      return
    }
    supabase.rpc('confirm_operator_activation', { token }).then(({ data, error }) => {
      setStatus(!error && data ? 'success' : 'invalid')
    })
  }, [])

  return (
    <main className="operator-access">
      <section className="operator-card" aria-live="polite">
        <div className="operator-card-top">
          <span className="operator-brand">{text.brand}<span>{text.brandBold}</span>{text.brandRest}</span>
          <button
            className="intake-language"
            type="button"
            aria-label="Idioma"
            onClick={() => setLanguage((current) => (current === 'es' ? 'en' : 'es'))}
          >
            <b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {status === 'checking' && (
          <><p className="intake-eyebrow">{language === 'es' ? 'ACTIVACIÓN' : 'ACTIVATION'}</p><h1>{text.checkingTitle}</h1><p>{text.checkingBody}</p></>
        )}
        {status === 'success' && (
          <><p className="intake-eyebrow">{language === 'es' ? 'LISTO' : 'DONE'}</p><h1>{text.successTitle}</h1><p>{text.successBody}</p><a className="intake-button primary" href="/app">{text.successCta}</a></>
        )}
        {status === 'invalid' && (
          <><p className="intake-eyebrow">{language === 'es' ? 'ENLACE INVÁLIDO' : 'INVALID LINK'}</p><h1>{text.invalidTitle}</h1><p>{text.invalidBody}</p></>
        )}
        {status === 'missing' && (
          <><p className="intake-eyebrow">{language === 'es' ? 'ENLACE INCOMPLETO' : 'INCOMPLETE LINK'}</p><h1>{text.missingTitle}</h1><p>{text.missingBody}</p></>
        )}
      </section>
    </main>
  )
}
