import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js'

const initialStatus = isSupabaseConfigured ? 'loading' : 'configuration'
const emptyIdentity = { email: '', userId: '', displayName: '', role: 'operator', message: '' }

export function useOperatorAccess() {
  const [state, setState] = useState({ status: initialStatus, ...emptyIdentity })

  const checkAccess = useCallback(async (session) => {
    if (!supabase || !session?.user) {
      setState({ status: isSupabaseConfigured ? 'signed_out' : 'configuration', ...emptyIdentity })
      return
    }

    const identity = {
      email: session.user.email ?? '',
      userId: session.user.id ?? '',
    }

    const { data: profile, error: profileError } = await supabase.rpc('current_operator_profile')

    if (!profileError) {
      setState({
        status: profile?.authorized ? 'authorized' : 'restricted',
        ...identity,
        displayName: profile?.display_name ?? '',
        role: profile?.role ?? 'operator',
        message: '',
      })
      return
    }

    const { data, error } = await supabase.rpc('current_operator_access')
    if (error) {
      setState({
        status: 'error',
        ...identity,
        displayName: '',
        role: 'operator',
        message: error.message,
      })
      return
    }

    setState({
      status: data ? 'authorized' : 'restricted',
      ...identity,
      displayName: '',
      role: 'operator',
      message: '',
    })
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) checkAccess(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (active) checkAccess(session)
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [checkAccess])

  const requestMagicLink = async (email) => {
    if (!supabase) return { error: new Error('Supabase configuration is unavailable.') }
    setState({ status: 'sending_link', ...emptyIdentity, email })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: new URL(window.location.pathname, window.location.origin).toString(),
        shouldCreateUser: true,
      },
    })

    setState(error
      ? { status: 'signed_out', ...emptyIdentity, email, message: error.message }
      : { status: 'link_sent', ...emptyIdentity, email })
    return { error }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setState({ status: 'signed_out', ...emptyIdentity })
  }

  return { ...state, requestMagicLink, signOut }
}
