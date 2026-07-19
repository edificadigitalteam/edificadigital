import { useState } from 'react'

export function OperatorAccessScreen({ access, copy, language, onLanguageChange }) {
  const [email, setEmail] = useState(access.email)
  const busy = access.status === 'loading' || access.status === 'sending_link'
  const canRequest = /^\S+@\S+\.\S+$/.test(email) && !busy

  const submit = async (event) => {
    event.preventDefault()
    if (canRequest) await access.requestMagicLink(email.trim().toLowerCase())
  }

  return (
    <main className="operator-access">
      <section className="operator-card" aria-live="polite">
        <div className="operator-card-top">
          <span className="operator-brand">somos<span>edifica</span>digital</span>
          <button
            className="intake-language"
            type="button"
            aria-label={copy.languageLabel}
            onClick={onLanguageChange}
          >
            <b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {access.status === 'configuration' ? (
          <>
            <p className="intake-eyebrow">{copy.auth.configurationEyebrow}</p>
            <h1>{copy.auth.configurationTitle}</h1>
            <p>{copy.auth.configurationBody}</p>
          </>
        ) : access.status === 'restricted' ? (
          <>
            <p className="intake-eyebrow">{copy.auth.restrictedEyebrow}</p>
            <h1>{copy.auth.restrictedTitle}</h1>
            <p>{copy.auth.restrictedBody}</p>
            <strong className="operator-email">{access.email}</strong>
            <button className="intake-button secondary" type="button" onClick={access.signOut}>{copy.auth.signOut}</button>
          </>
        ) : access.status === 'link_sent' ? (
          <>
            <p className="intake-eyebrow">{copy.auth.linkEyebrow}</p>
            <h1>{copy.auth.linkTitle}</h1>
            <p>{copy.auth.linkBody}</p>
            <strong className="operator-email">{access.email}</strong>
            <button className="intake-button secondary" type="button" onClick={() => access.requestMagicLink(access.email)}>{copy.auth.sendAgain}</button>
          </>
        ) : access.status === 'error' ? (
          <>
            <p className="intake-eyebrow">{copy.auth.errorEyebrow}</p>
            <h1>{copy.auth.errorTitle}</h1>
            <p>{copy.auth.errorBody}</p>
            <button className="intake-button secondary" type="button" onClick={access.signOut}>{copy.auth.signOut}</button>
          </>
        ) : (
          <>
            <p className="intake-eyebrow">{copy.auth.eyebrow}</p>
            <h1>{copy.auth.title}</h1>
            <p>{copy.auth.body}</p>
            <form onSubmit={submit}>
              <label htmlFor="operator-email">{copy.auth.email}</label>
              <input
                id="operator-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.auth.emailPlaceholder}
                required
              />
              {access.message && <p className="form-error" role="alert">{copy.auth.requestError}</p>}
              <button className="intake-button primary" type="submit" disabled={!canRequest}>
                {busy ? copy.auth.sending : copy.auth.sendLink}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
