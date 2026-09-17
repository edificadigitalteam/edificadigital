import MemberCatalogPanel from '../members/MemberCatalogPanel.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-integrations.css'

const catalogs = {
  categories: {
    table: 'organization_member_category',
    kicker: 'MANTENEDORES',
    title: 'Categorías de miembros',
    description: 'Define las categorías que tu organización usa para clasificar a sus miembros, y a qué tipo de miembro aplica cada una.',
    itemLabel: 'Categoría',
    createLabel: 'Nueva categoría',
    withAppliesTo: true,
  },
  roles: {
    table: 'organization_member_relationship_role',
    kicker: 'MANTENEDORES',
    title: 'Roles de relación',
    description: 'Define los roles con los que una persona se vincula a una organización miembro, por ejemplo Pastor Principal o Presidente.',
    itemLabel: 'Rol',
    createLabel: 'Nuevo rol',
    withAppliesTo: false,
  },
}

export default function ManagementMemberCatalogPage({ catalog }) {
  const access = useOperatorAccess()
  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  const configuration = catalogs[catalog] ?? catalogs.categories

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-integrated-dashboard-panel">
        <MemberCatalogPanel access={access} {...configuration} />
      </div>
    </ManagementStandaloneShell>
  )
}
