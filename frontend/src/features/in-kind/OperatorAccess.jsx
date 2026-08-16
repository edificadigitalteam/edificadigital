import { useState } from 'react'

const fallbackAuth = {
  configurationEyebrow: 'CONFIGURACIÓN',
  configurationTitle: 'Edifica requiere configuración',
  configurationBody: 'Completa la conexión con Supabase para habilitar el acceso.',
  restrictedEyebrow: 'ACCESO RESTRINGIDO',
  restrictedTitle: 'Este correo requiere autorización',
  restrictedBody: 'Solicita a un administrador que habilite tu correo dentro de Edifica.',
  signOut: 'Usar otra cuenta',
  linkEyebrow: 'ENLACE ENVIADO',
  linkTitle: 'Revisa tu correo',
  linkBody: 'Abre el enlace seguro para ingresar al panel.',
  sendAgain: 'Enviar nuevamente',
  loadingEyebrow: 'VERIFICANDO ACCESO',
  loadingTitle: 'Estamos recuperando tu sesión',
  loadingBody: 'Esto debe tomar solo unos segundos. Si la sesión anterior no responde, Edifica liberará automáticamente el acceso para que puedas solicitar un enlace nuevo.',
  errorEyebrow: 'ERROR DE ACCESO',
  errorTitle: 'No fue posible verificar la sesión',
  errorBody: 'Cierra la sesión e intenta nuevamente.',
  eyebrow: 'ACCESO AL SISTEMA',
  title: 'Ingresa al panel de Edifica',
  body: 'Usa el correo habilitado por el administrador.',
  email: 'Correo electrónico',
  emailPlaceholder: 'nombre@organizacion.org',
  requestError: 'No fue posible completar el acceso.',
  sending: 'Enviando enlace…',
  sendLink: 'Enviar enlace de acceso',
}

export function OperatorAccessScreen({ access, copy = {}, language, onLanguageChange }) {
  const [email, setEmail] = useState(access.email)
  const busy = access.status === 'sending_link'
  const canRequest = /^\S+@\S+\.\S+$/.test(email) && !busy
  const auth = { ...fallbackAuth, ...(copy.auth ?? {}) }

  const submit = async (event) => {
    event.preventDefault()
    if (canRequest) await access.requestMagicLink(email.trim().toLowerCase())
  }

  return (
    <main className="operator-access">
      <section className="operator-card" aria-live="polite">
        <div className="operator-card-top">
          <span className="operator-brand">somos<span>edifica</span>digital</span>
          <button className="intake-language" type="button" aria-label={copy.languageLabel ?? 'Idioma'} title={copy.languageLabel ?? 'Idioma'} onClick={onLanguageChange}>
            <b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {access.status === 'configuration' ? (
          <><p className="intake-eyebrow">{auth.configurationEyebrow}</p><h1>{auth.configurationTitle}</h1><p>{auth.configurationBody}</p></>
        ) : access.status === 'loading' ? (
          <><p className="intake-eyebrow">{auth.loadingEyebrow}</p><h1>{auth.loadingTitle}</h1><p>{auth.loadingBody}</p><div className="operator-session-loading" aria-label="Verificando sesión"><span /></div></>
        ) : access.status === 'restricted' ? (
          <><p className="intake-eyebrow">{auth.restrictedEyebrow}</p><h1>{auth.restrictedTitle}</h1><p>{auth.restrictedBody}</p><strong className="operator-email">{access.email}</strong><button className="intake-button secondary" type="button" onClick={access.signOut} title={auth.signOut}>{auth.signOut}</button></>
        ) : access.status === 'link_sent' ? (
          <><p className="intake-eyebrow">{auth.linkEyebrow}</p><h1>{auth.linkTitle}</h1><p>{auth.linkBody}</p><strong className="operator-email">{access.email}</strong><button className="intake-button secondary" type="button" onClick={() => access.requestMagicLink(access.email)} title={auth.sendAgain}>{auth.sendAgain}</button></>
        ) : access.status === 'error' ? (
          <><p className="intake-eyebrow">{auth.errorEyebrow}</p><h1>{auth.errorTitle}</h1><p>{access.message || auth.errorBody}</p><button className="intake-button secondary" type="button" onClick={access.signOut} title={auth.signOut}>{auth.signOut}</button></>
        ) : (
          <><p className="intake-eyebrow">{auth.eyebrow}</p><h1>{auth.title}</h1><p>{auth.body}</p><form onSubmit={submit}><label htmlFor="operator-email">{auth.email}</label><input id="operator-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={auth.emailPlaceholder} required />{access.message && <p className="form-error" role="alert">{access.message || auth.requestError}</p>}<button className="intake-button primary" type="submit" disabled={!canRequest} title={auth.sendLink}>{busy ? auth.sending : auth.sendLink}</button></form></>
        )}
      </section>
    </main>
  )
}
