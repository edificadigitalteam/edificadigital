import ProjectCompliancePanel from '../dashboard/ProjectCompliancePanel.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import ProjectBeneficiaryRequirementPanel from './ProjectBeneficiaryRequirementPanel.jsx'
import ProjectMediaLibraryPanel from './ProjectMediaLibraryPanel.jsx'
import './management-integrations.css'

export default function ManagementProjectWorkspacePage() {
  const access = useOperatorAccess()
  const projectId = new URLSearchParams(window.location.search).get('project') || ''

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-project-workspace">
        <div className="management-workspace-back no-print"><a href="/app/management/projects">← Volver a proyectos</a><span>Todo el expediente del proyecto se administra desde este espacio.</span></div>
        <ProjectCompliancePanel access={access} managementMode />
        {projectId && <ProjectBeneficiaryRequirementPanel access={access} projectId={projectId} />}
        {projectId && <ProjectMediaLibraryPanel access={access} projectId={projectId} />}
      </div>
    </ManagementStandaloneShell>
  )
}
