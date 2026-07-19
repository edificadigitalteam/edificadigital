import { useState } from 'react'

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
)

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg>
)

const Paperclip = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12.5 5.7-5.7a3.2 3.2 0 0 1 4.5 4.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l7.4-7.4" /></svg>
)

const stages = [
  {
    number: '01',
    title: 'Recibir',
    text: 'Registro de aportes monetarios y donaciones en especie, con datos del donante y comprobantes asociados.',
    note: 'Origen y recepción',
  },
  {
    number: '02',
    title: 'Transformar',
    text: 'Control de insumos, elaboración de kits y documentos fiscales vinculados a cada jornada de preparación.',
    note: 'Recursos preparados',
  },
  {
    number: '03',
    title: 'Impactar',
    text: 'Registro de entregas, población atendida, responsables, fotografías y soportes de cada actividad.',
    note: 'Resultados verificables',
  },
]

const reportItems = [
  'Resumen ejecutivo de la operación',
  'Indicadores de personas y familias atendidas',
  'Relación de recursos recibidos y entregados',
  'Galería de evidencias y documentos',
]

function Logo({ footer = false }) {
  return (
    <a className={footer ? 'brand footer-brand' : 'brand'} href="#inicio" aria-label="Edifica Digital, inicio">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>edifica<span>digital</span></span>
    </a>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <Logo />

        <button
          className="menu-button"
          type="button"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'} aria-label="Navegación principal">
          <a href="#proceso" onClick={closeMenu}>Proceso</a>
          <a href="#plataforma" onClick={closeMenu}>Plataforma</a>
          <a href="#reportes" onClick={closeMenu}>Reportes</a>
          <a className="nav-cta" href="#contacto" onClick={closeMenu}>
            Solicitar presentación <Arrow />
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Tecnología para la gestión social</div>
            <h1>La ruta completa de cada donación, en un solo lugar.</h1>
            <p className="hero-lead">
              Una plataforma para registrar recursos, documentar su transformación
              y presentar el impacto de cada entrega con evidencias organizadas.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contacto">
                Conocer la propuesta <Arrow />
              </a>
              <a className="text-link" href="#proceso">
                Explorar el proceso <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="hero-footnote">
              <span className="mini-seal">ED</span>
              <p>Diseñada para fundaciones, organizaciones sociales, iglesias y equipos de respuesta humanitaria.</p>
            </div>
          </div>

          <div className="hero-visual" aria-label="Vista previa del panel de Edifica Digital">
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
                  <div><small>RESUMEN GENERAL</small><strong>Panel de impacto</strong></div>
                  <span>Últimos 30 días</span>
                </div>
                <div className="metric-grid">
                  <article>
                    <small>RECURSOS RECIBIDOS</small><strong>4.820</strong><span>unidades registradas</span>
                  </article>
                  <article>
                    <small>KITS PREPARADOS</small><strong>1.535</strong><span>con soporte asociado</span>
                  </article>
                  <article className="highlight">
                    <small>PERSONAS ATENDIDAS</small><strong>6.100</strong><span>en 28 jornadas</span>
                  </article>
                </div>
                <div className="chart-card">
                  <div className="chart-header">
                    <div><small>ACTIVIDAD</small><strong>Recursos e impacto</strong></div>
                    <div className="chart-key"><span /> Registro <i /> Entrega</div>
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
              <div><small>EVIDENCIA VINCULADA</small><strong>Acta de entrega · Jornada 028</strong></div>
              <i><Check /></i>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Principios de la plataforma">
          <p>Información organizada para decisiones responsables</p>
          <div>
            <span>TRAZABILIDAD</span><span>EVIDENCIAS</span><span>INDICADORES</span><span>REPORTES</span>
          </div>
        </section>

        <section className="process section" id="proceso">
          <div className="section-intro">
            <div><span className="section-number">01</span><p>EL RECORRIDO</p></div>
            <div>
              <h2>Recibir. Transformar. Impactar.</h2>
              <p>Tres momentos documentados dentro de una misma operación. Cada registro conserva sus datos, responsables y archivos.</p>
            </div>
          </div>

          <div className="stage-grid">
            {stages.map((stage) => (
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
            <div className="eyebrow light"><span /> Gestión documentada</div>
            <h2>Una estructura clara para el trabajo diario.</h2>
            <p>Formularios sencillos, archivos vinculados y paneles con indicadores para equipos que gestionan recursos y actividades en campo.</p>
            <ul className="feature-list">
              <li><Check /> Registro de donantes y organizaciones</li>
              <li><Check /> Donaciones monetarias y en especie</li>
              <li><Check /> Control de kits y jornadas de preparación</li>
              <li><Check /> Demografía, entregas y evidencias</li>
              <li><Check /> Panel global y vista por campaña</li>
            </ul>
          </div>

          <div className="platform-panel">
            <div className="panel-caption"><span>JORNADA DE IMPACTO</span><small>Estado: cerrada</small></div>
            <h3>Respuesta comunitaria · La Guaira</h3>
            <p>16 de julio de 2026 · Responsable de jornada</p>
            <div className="panel-stats">
              <div><strong>1.124</strong><span>Hidrataciones</span></div>
              <div><strong>1.151</strong><span>Kits de higiene</span></div>
              <div><strong>1.056</strong><span>Atenciones médicas</span></div>
            </div>
            <div className="panel-files">
              <span><Paperclip /> Registro fotográfico <small>12 archivos</small></span>
              <span><Paperclip /> Actas y soportes <small>4 archivos</small></span>
            </div>
          </div>
        </section>

        <section className="reports section" id="reportes">
          <div className="section-intro reports-intro">
            <div><span className="section-number">02</span><p>RENDICIÓN DE CUENTAS</p></div>
            <div>
              <h2>Reportes preparados para revisión institucional.</h2>
              <p>Información consolidada para directivas, donantes, aliados y organizaciones internacionales que soliciten resultados de gestión.</p>
            </div>
          </div>

          <div className="report-layout">
            <div className="report-document" aria-label="Muestra de reporte institucional">
              <div className="document-head">
                <div className="document-brand"><span className="mini-seal">ED</span><b>Edifica Digital</b></div>
                <small>REPORTE INSTITUCIONAL · 2026</small>
              </div>
              <div className="document-title">
                <span>RESPUESTA HUMANITARIA</span>
                <h3>Informe de gestión e impacto</h3>
                <p>Período documentado: 24 de junio — 16 de julio</p>
              </div>
              <div className="document-metrics">
                <div><strong>6.100</strong><span>Personas atendidas</span></div>
                <div><strong>4,8 t</strong><span>Recursos gestionados</span></div>
                <div><strong>28</strong><span>Jornadas registradas</span></div>
              </div>
              <div className="document-lines"><span /><span /><span /></div>
              <div className="document-footer"><span>Datos consolidados y evidencias anexas</span><b>01</b></div>
            </div>

            <div className="report-copy">
              <span className="report-label">EXPORTACIÓN · PDF</span>
              <h3>Información lista para presentar.</h3>
              <p>El reporte reúne indicadores, relación de recursos y evidencia documental dentro de un archivo formal para evaluación, auditoría y cooperación.</p>
              <ul>{reportItems.map((item) => <li key={item}><Check /> {item}</li>)}</ul>
              <div className="standards">
                <span>ES</span><span>EN</span>
                <p>Preparación prevista en español e inglés para procesos de cooperación internacional.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing section" id="contacto">
          <div className="closing-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <span className="closing-label">EDIFICA DIGITAL</span>
            <h2>Trazabilidad que respalda cada resultado.</h2>
            <p>Conoce la propuesta funcional, el alcance del primer lanzamiento y las posibilidades de implementación para tu organización.</p>
          </div>
          <a
            className="button button-light"
            href="https://wa.me/584123212012?text=Hola%2C%20quisiera%20conocer%20la%20propuesta%20de%20Edifica%20Digital."
            target="_blank"
            rel="noreferrer"
          >
            Solicitar presentación <Arrow />
          </a>
        </section>
      </main>

      <footer>
        <Logo footer />
        <p>Plataforma de trazabilidad y gestión de impacto.</p>
        <span>© 2026 Edifica Digital</span>
      </footer>
    </div>
  )
}

export default App
