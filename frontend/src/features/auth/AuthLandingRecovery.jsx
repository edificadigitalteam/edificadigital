import { useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

function hasAuthReturnMarker() {
  const params = new URLSearchParams(window.location.search)
  if (['code', 'auth', 'token_hash', 'error', 'error_code', 'error_description'].some((key) => params.has(key))) return true
  const hash = window.location.hash || ''
  return hash.includes('access_token=') || hash.includes('refresh_token=') || hash.includes('error_description=')
}

export default function AuthLandingRecovery() {
  useEffect(() => {
    if (!supabase || window.location.pathname.startsWith('/app') || !hasAuthReturnMarker()) return undefined

    let active = true
    const enterApp = (session) => {
      if (!active || !session?.user) return
      window.location.replace('/app?auth=recovered')
    }

    const recover = async () => {
      const { data } = await supabase.auth.getSession()
      enterApp(data?.session)
    }

    recover()
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') enterApp(session)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return null
}
