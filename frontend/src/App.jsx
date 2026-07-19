import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { content } from './content.js'

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
)

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg>
)

const Paperclip = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12.5 5.7-5.7a3.2 3.2 0 0 1 4.5 4.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l7.4-7.4" /></svg>
)

function Logo({ footer = false, homeLabel }) {
  return (
    <a className={footer ? 'brand footer-brand' : 'brand'} href="#inicio" aria-label={homeLabel}>
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>edifica<span>digital</span></span>
    </a>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [language, setLanguage] = useState(() => (
    window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  ))
  const copy = content[language]
  const closeMenu = () => setMenuOpen(false)
  const toggleLanguage = () => {
    setLanguage((current) => current === 'es' ? 'en' : 'es')
    closeMenu()
  }

  useEffect(() => {
    document.documentElement.lang = language
    document.title = copy.meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.meta.description)
    window.localStorage.setItem('edifica-language', language)
  }, [copy, language])

  return (
    <div className="site-shell">
      <header className="site-header">
        <Logo homeLabel={copy.nav.home} />

        <button
          className="menu-button"
          type="button"
          aria-label={copy.nav.menu}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'} aria-label={copy.nav.landmark}>
          <a href="#proceso" onClick={closeMenu}>{copy.nav.process}</a>
          <a href="#plataforma" onClick={closeMenu}>{copy.nav.platform}</a>
          <a href="#reportes" onClick={closeMenu}>{copy.nav.reports}</a>
          <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={copy.nav.label}>
            <span>{copy.nav.current}</span>
            <i aria-hidden="true">/</i>
            <b>{copy.nav.alternate}</b>
          </button>
          <a className="nav-cta" href="#contacto" onClick={closeMenu}>
            {copy.nav.cta} <Arrow />
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow"><span /> {copy.hero.eyebrow}</div>
            <h1>{copy.hero.title}</h1>
            <p className="hero-lead">{copy.hero.lead}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contacto">
                {copy.hero.primary} <Arrow />
              </a>
              <a className="text-link" href="#proceso">
                {copy.hero.secondary} <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="hero-footnote">
              <span className="mini-seal">ED</span>
              <p>{copy.hero.note}</p>
            </div>
          </div>

          <div className="hero-visual" aria-label={copy.hero.visualLabel}>
            <div className="visual-topbar">
              <div className="visual-brand"><span /> Edifica Digital</div>
              <div className="visual-user">ID</div>
            </div>
            <div className="dashboard">
              <aside className="dash-menu" aria-hidden="true">
                <span className="active" /><span /><span /><span />
              </aside>
              <div className="dash-content">
                <div className="dash-heading">
                  <div><small>{copy.dashboard.summary}</small><strong>{copy.dashboard.title}</strong></div>
                  <span>{copy.dashboard.period}</span>
                </div>
                <div className="metric-grid">
                  <article>
                    <small>{copy.dashboard.received}</small><strong>{language === 'es' ? '4.820' : '4,820'}</strong><span>{copy.dashboard.receivedNote}</span>
                  </article>
                  <article>
                    <small>{copy.dashboard.prepared}</small><strong>{language === 'es' ? '1.535' : '1,535'}</strong><span>{copy.dashboard.preparedNote}</span>
                  </article>
                  <article className="highlight">
                    <small>{copy.dashboard.people}</small><strong>{language === 'es' ? '6.100' : '6,100'}</strong><span>{copy.dashboard.peopleNote}</span>
                  </article>
                </div>
                <div className="chart-card">
                  <div className="chart-header">
                    <div><small>{copy.dashboard.activity}</small><strong>{copy.dashboard.chart}</strong></div>
                    <div className="chart-key"><span /> {copy.dashboard.register} <i /> {copy.dashboard.delivery}</div>
                  </div>
                  <div className="chart-area" aria-hidden="true">
                    {[42, 58, 49, 74, 63, 88, 79, 92].map((height, index) => (
                      <div className="bar-pair" key={height}>
                        <span style={{ height: height + '%' }} />
                        <i style={{ height: Math.max(height - 18 + (index % 3) * 6, 24) + '%' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="evidence-ticket">
              <span><Paperclip /></span>
              <div><small>{copy.dashboard.evidence}</small><strong>{copy.dashboard.evidenceName}</strong></div>
              <i><Check /></i>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Principios de la plataforma">
          <p>{copy.trust.title}</p>
          <div>{copy.trust.items.map((item) => <span key={item}>{item}</span>)}</div>
        </section>

        <section className="process section" id="proceso">
          <div className="section-intro">
            <div><span className="section-number">01</span><p>{copy.process.kicker}</p></div>
            <div>
              <h2>{copy.process.title}</h2>
              <p>{copy.process.intro}</p>
            </div>
          </div>

          <div className="stage-grid">
            {copy.process.stages.map((stage) => (
              <article className="stage-card" key={stage.title}>
                <div className="stage-top"><span>{stage.number}</span><i aria-hidden="true" /></div>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                <small>{stage.note}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="platform section" id="plataforma">
          <div className="platform-copy">
            <div className="eyebrow light"><span /> {copy.platform.eyebrow}</div>
            <h2>{copy.platform.title}</h2>
            <p>{copy.platform.intro}</p>
            <ul className="feature-list">
              {copy.platform.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}
            </ul>
          </div>

          <div className="platform-panel">
            <div className="panel-caption"><span>{copy.platform.event}</span><small>{copy.platform.status}</small></div>
            <h3>{copy.platform.eventName}</h3>
            <p>{copy.platform.eventDate}</p>
            <div className="panel-stats">
              {copy.platform.metrics.map(([value, label]) => (
                <div key={label}><strong>{value}</strong><span>{label}</span></div>
              ))}
            </div>
            <div className="panel-files">
              <span><Paperclip /> {copy.platform.photo} <small>{copy.platform.photoCount}</small></span>
              <span><Paperclip /> {copy.platform.support} <small>{copy.platform.supportCount}</small></span>
            </div>
          </div>
        </section>

        <section className="reports section" id="reportes">
          <div className="section-intro reports-intro">
            <div><span className="section-number">02</span><p>{copy.reports.kicker}</p></div>
            <div>
              <h2>{copy.reports.title}</h2>
              <p>{copy.reports.intro}</p>
            </div>
          </div>

          <div className="report-layout">
            <div className="report-document" aria-label={copy.reports.previewLabel}>
              <div className="document-head">
                <div className="document-brand"><span className="mini-seal">ED</span><b>Edifica Digital</b></div>
                <small>{copy.reports.reportType}</small>
              </div>
              <div className="document-title">
                <span>{copy.reports.area}</span>
                <h3>{copy.reports.reportTitle}</h3>
                <p>{copy.reports.period}</p>
              </div>
              <div className="document-metrics">
                {copy.reports.metrics.map(([value, label]) => (
                  <div key={label}><strong>{value}</strong><span>{label}</span></div>
                ))}
              </div>
              <div className="document-lines"><span /><span /><span /></div>
              <div className="document-footer"><span>{copy.reports.footer}</span><b>01</b></div>
            </div>

            <div className="report-copy">
              <span className="report-label">{copy.reports.export}</span>
              <h3>{copy.reports.copyTitle}</h3>
              <p>{copy.reports.copy}</p>
              <ul>{copy.reports.items.map((item) => <li key={item}><Check /> {item}</li>)}</ul>
              <div className="standards">
                <span>ES</span><span>EN</span>
                <p>{copy.reports.languages}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing section" id="contacto">
          <div className="closing-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <span className="closing-label">EDIFICA DIGITAL</span>
            <h2>{copy.closing.title}</h2>
            <p>{copy.closing.copy}</p>
          </div>
          <a
            className="button button-light"
            href={'https://wa.me/584123212012?text=' + encodeURIComponent(copy.closing.whatsapp)}
            target="_blank"
            rel="noreferrer"
          >
            {copy.closing.cta} <Arrow />
          </a>
        </section>
      </main>

      <footer>
        <Logo footer homeLabel={copy.nav.home} />
        <p>{copy.footer.copy}</p>
        <span>© 2026 Edifica Digital</span>
      </footer>
      <Analytics />
    </div>
  )
}

export default App
