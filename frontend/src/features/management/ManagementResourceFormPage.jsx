import UnifiedMonetaryDonationFlow from '../monetary/UnifiedMonetaryDonationFlow.jsx'
import SimplifiedInKindDonationFlow from '../in-kind/SimplifiedInKindDonationFlow.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-resources.css'

const draftKeys = {
  monetary: 'edifica-monetary-draft-v4',
  'in-kind': 'edifica-in-kind-consolidated-draft-v4',
}

function normalizeDraftTenant(kind, access) {
  if (access.role === 'super_admin' || !access.organizationId) return
  try {
    const key = draftKeys[kind]
    const raw = window.localStorage.getItem(key)
    if (!raw) return
    const draft = JSON.parse(raw)
    if (draft.organizationId === access.organizationId) return
    const next = {
      ...draft,
      organizationId: access.organizationId,
      projectId: '',
      donorActorId: '', donorName: '', donorEmail: '', donorPhone: '', donorCountry: '',
    }
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    try { window.localStorage.removeItem(draftKeys[kind]) } catch { /* storage unavailable */ }
  }
}

export default function ManagementResourceFormPage({ kind }) {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  // These intake components initialize their draft from localStorage on mount.
  // Normalize the tenant before mounting them so an old draft from another
  // organization can never hide the current tenant's projects.
  normalizeDraftTenant(kind, access)

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-embedded-intake">
        <div className="management-embedded-intake-back"><a href="/app/management/resources">← Aportes y recursos</a></div>
        {kind === 'in-kind' ? <SimplifiedInKindDonationFlow /> : <UnifiedMonetaryDonationFlow />}
      </div>
    </ManagementStandaloneShell>
  )
}
