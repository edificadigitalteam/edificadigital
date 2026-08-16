import DonorDirectoryPanel from '../donors/DonorDirectoryPanel.jsx'
import VolunteerPanel from '../dashboard/VolunteerPanel.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-integrations.css'

export default function ManagementDirectoryPage({ kind }) {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-integrated-dashboard-panel">
        {kind === 'volunteers' ? <VolunteerPanel access={access} /> : <DonorDirectoryPanel access={access} />}
      </div>
    </ManagementStandaloneShell>
  )
}
