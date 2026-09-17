import MembersPanel from '../members/MembersPanel.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-integrations.css'

export default function ManagementMembersPage() {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-integrated-dashboard-panel">
        <MembersPanel access={access} />
      </div>
    </ManagementStandaloneShell>
  )
}
