import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementReportsUnifiedPage from './ManagementReportsUnifiedPage.jsx'
import ManagementReportsExecutivePage from './ManagementReportsExecutivePage.jsx'

export default function ManagementReportsV2Page(){
  const access=useOperatorAccess()
  const [checking,setChecking]=useState(true)
  const [isDigen,setIsDigen]=useState(false)
  const ownMode=new URLSearchParams(window.location.search).get('scope')==='own'

  useEffect(()=>{
    let active=true
    const check=async()=>{
      if(!supabase||access.status!=='authorized'||!access.organizationId){if(active)setChecking(false);return}
      const {data,error}=await supabase.rpc('management_report_access_overview',{target_organization_id:access.organizationId})
      if(active){setIsDigen(!error&&Boolean(data?.is_digen));setChecking(false)}
    }
    check()
    return()=>{active=false}
  },[access.organizationId,access.status])

  if(ownMode||access.status!=='authorized')return <ManagementReportsUnifiedPage/>
  if(checking)return <main style={{minHeight:'70vh',display:'grid',placeItems:'center',fontFamily:'Inter,system-ui,sans-serif',color:'#5d2d70'}}>Cargando informes…</main>
  return isDigen?<ManagementReportsExecutivePage/>:<ManagementReportsUnifiedPage/>
}
