import MemberCatalogPanel from '../members/MemberCatalogPanel.jsx'
import { memberCatalogs } from '../members/memberCatalogs.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-integrations.css'

export default function ManagementMemberCatalogPage({ catalog }) {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  const configuration = memberCatalogs[catalog] ?? memberCatalogs.categories

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-integrated-dashboard-panel">
        <MemberCatalogPanel access={access} {...configuration} />
      </div>
    </ManagementStandaloneShell>
  )
}
