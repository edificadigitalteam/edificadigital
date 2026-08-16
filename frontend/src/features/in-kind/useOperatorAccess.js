import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js'

const initialStatus = isSupabaseConfigured ? 'loading' : 'configuration'
const emptyIdentity = {
  email: '',
  userId: '',
  displayName: '',
  role: 'operator',
  organizationId: '',
  organizationName: '',
  tenantHost: '',
  tenantOrganizationId: '',
  message: '',
}
const demoFallbackUrl = 'https://edificadigital-git-feature-demo-acces-a82faf-yangetzes-projects.vercel.app'

function isLocalUrl(value) {
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)
  } catch {
    return false
  }
}

const redirectablePathPrefixes = ['/app', '/donations']

function getOriginPath() {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)
  params.delete('login')
  params.delete('t')
  params.delete('auth')
  const cleanedSearch = params.toString()
  const path = cleanedSearch ? `${pathname}?${cleanedSearch}` : pathname
  if (path === '/app' || path === '/') return ''
  return path
}

function getAppRedirectUrl(nextPath) {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim()
  const runtimeIsLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)
  // In production the callback must return to the exact host where the login
  // was requested. This prevents an old preview VITE_APP_URL from hijacking
  // the Magic Link and leaving an otherwise valid session on another origin.
  const localConfiguredUrl = configuredUrl && !isLocalUrl(configuredUrl) ? configuredUrl : ''
  const baseUrl = runtimeIsLocal ? (localConfiguredUrl || demoFallbackUrl) : window.location.origin
  const normalizedBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
  const redirect = new URL('/app', normalizedBaseUrl)
  redirect.searchParams.set('auth', 'callback')
  if (nextPath) redirect.searchParams.set('next', nextPath)
  return redirect.toString()
}

function clearCallbackUrl() {
  if (window.location.pathname !== '/app') return
  const params = new URLSearchParams(window.location.search)
  const callbackKeys = ['code', 'auth', 'login', 'error', 'error_code', 'error_description', 't', 'next']
  if (!callbackKeys.some((key) => params.has(key)) && !window.location.hash) return
  window.history.replaceState({}, document.title, '/app')
}

function consumeNextPath() {
  if (window.location.pathname !== '/app') return null
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next')
  if (!next || !next.startsWith('/')) return null
  if (!redirectablePathPrefixes.some((prefix) => next === prefix || next.startsWith(`${prefix}/`))) return null
  return next
}

function clearLocalAuthCache() {
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) window.localStorage.removeItem(key)
    })
  } catch {
    // Browser storage can be unavailable in restricted contexts.
  }
}

async function resolveCurrentTenant() {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('resolve_tenant_host', {
    host_input: window.location.hostname.toLowerCase(),
  })
  if (error) return null
  return Array.isArray(data) ? data[0] ?? null : data ?? null
}

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

    let profileResponse = await supabase.rpc('current_operator_profile')
    if (profileResponse.error) {
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      profileResponse = await supabase.rpc('current_operator_profile')
    }
    const tenant = await resolveCurrentTenant()
    const { data: profile, error: profileError } = profileResponse

    if (!profileError) {
      const authorized = profile?.authorized ?? profile?.active ?? false
      const profileOrganizationId = profile?.organization_id ?? ''
      const role = profile?.role ?? 'operator'
      const tenantMismatch = Boolean(
        tenant?.organization_id
        && profileOrganizationId
        && tenant.organization_id !== profileOrganizationId
        && role !== 'super_admin'
      )

      setState({
        status: authorized && !tenantMismatch ? 'authorized' : 'restricted',
        ...identity,
        email: profile?.email ?? identity.email,
        displayName: profile?.display_name ?? '',
        role,
        organizationId: profileOrganizationId,
        organizationName: profile?.organization_name ?? '',
        tenantHost: tenant?.hostname ?? '',
        tenantOrganizationId: tenant?.organization_id ?? '',
        message: tenantMismatch
          ? 'Este acceso pertenece a una organización diferente al tenant solicitado.'
          : '',
      })
      if (authorized && !tenantMismatch) {
        const next = consumeNextPath()
        if (next) { window.location.replace(next); return }
        clearCallbackUrl()
      }
      return
    }

    const { data, error } = await supabase.rpc('current_operator_access')
    if (error) {
      setState({
        status: 'error',
        ...identity,
        displayName: '',
        role: 'operator',
        organizationId: '',
        organizationName: '',
        tenantHost: tenant?.hostname ?? '',
        tenantOrganizationId: tenant?.organization_id ?? '',
        message: error.message,
      })
      return
    }

    setState({
      status: data ? 'authorized' : 'restricted',
      ...identity,
      displayName: '',
      role: 'operator',
      organizationId: '',
      organizationName: '',
      tenantHost: tenant?.hostname ?? '',
      tenantOrganizationId: tenant?.organization_id ?? '',
      message: '',
    })
    if (data) {
      const next = consumeNextPath()
      if (next) { window.location.replace(next); return }
      clearCallbackUrl()
    }
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    let active = true

    const bootstrap = async () => {
      setState((current) => ({ ...current, status: 'loading', message: '' }))
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error) {
        setState({ status: 'signed_out', ...emptyIdentity, message: error.message })
        return
      }
      await checkAccess(data.session)
    }

    bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!active) return
        if (event === 'SIGNED_OUT') {
          setState({ status: 'signed_out', ...emptyIdentity })
          return
        }
        checkAccess(session)
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

    const { data: gate, error: gateError } = await supabase.rpc('request_login_access', { target_email: email })
    if (gateError) {
      setState({ status: 'signed_out', ...emptyIdentity, email, message: gateError.message })
      return { error: gateError }
    }

    if (!gate?.ready) {
      setState({ status: 'confirmation_sent', ...emptyIdentity, email })
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAppRedirectUrl(getOriginPath()),
        shouldCreateUser: true,
      },
    })

    setState(error
      ? { status: 'signed_out', ...emptyIdentity, email, message: error.message }
      : { status: 'link_sent', ...emptyIdentity, email })
    return { error }
  }

  const signOut = async () => {
    setState({ status: 'loading', ...emptyIdentity })
    if (supabase) await supabase.auth.signOut({ scope: 'local' })
    clearLocalAuthCache()
    window.location.replace(`/?signed_out=1&t=${Date.now()}`)
  }

  return { ...state, requestMagicLink, signOut }
}
