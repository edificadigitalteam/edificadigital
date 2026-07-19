import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js'

const initialStatus = isSupabaseConfigured ? 'loading' : 'configuration'

export function useOperatorAccess() {
  const [state, setState] = useState({ status: initialStatus, email: '', message: '' })

  const checkAccess = useCallback(async (session) => {
    if (!supabase || !session?.user) {
      setState({ status: isSupabaseConfigured ? 'signed_out' : 'configuration', email: '', message: '' })
      return
    }

    const { data, error } = await supabase.rpc('current_operator_access')
    if (error) {
      setState({ status: 'error', email: session.user.email ?? '', message: error.message })
      return
    }

    setState({
      status: data ? 'authorized' : 'restricted',
      email: session.user.email ?? '',
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
    setState({ status: 'sending_link', email, message: '' })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: new URL(window.location.pathname, window.location.origin).toString(),
        shouldCreateUser: true,
      },
    })

    setState(error
      ? { status: 'signed_out', email, message: error.message }
      : { status: 'link_sent', email, message: '' })
    return { error }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setState({ status: 'signed_out', email: '', message: '' })
  }

  return { ...state, requestMagicLink, signOut }
}
