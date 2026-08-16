import UnifiedMonetaryDonationFlow from '../monetary/UnifiedMonetaryDonationFlow.jsx'
import SimplifiedInKindDonationFlow from '../in-kind/SimplifiedInKindDonationFlow.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-resources.css'

export default function ManagementResourceFormPage({ kind }) {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-embedded-intake">
        <div className="management-embedded-intake-back"><a href="/app/management/resources">← Aportes y recursos</a></div>
        {kind === 'in-kind' ? <SimplifiedInKindDonationFlow /> : <UnifiedMonetaryDonationFlow />}
      </div>
    </ManagementStandaloneShell>
  )
}
