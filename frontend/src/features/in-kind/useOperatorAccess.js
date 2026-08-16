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
const SESSION_TIMEOUT_MS = 6000
const RPC_TIMEOUT_MS = 5000
const TENANT_TIMEOUT_MS = 2500
const LINK_TIMEOUT_MS = 10000

function isLocalUrl(value) {
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function withTimeout(promise, milliseconds, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => window.clearTimeout(timer))
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
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('resolve_tenant_host', { host_input: window.location.hostname.toLowerCase() }),
      TENANT_TIMEOUT_MS,
      'Tenant lookup timed out.',
    )
    if (error) return null
    return Array.isArray(data) ? data[0] ?? null : data ?? null
  } catch {
    // Tenant resolution is an additional boundary. RLS remains authoritative,
    // so a slow host lookup must never freeze the whole sign-in experience.
    return null
  }
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

    let profileResponse
    try {
      profileResponse = await withTimeout(
        supabase.rpc('current_operator_profile'),
        RPC_TIMEOUT_MS,
        'La verificación del perfil tardó demasiado.',
      )
    } catch (error) {
      profileResponse = { data: null, error }
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

    try {
      const { data, error } = await withTimeout(
        supabase.rpc('current_operator_access'),
        RPC_TIMEOUT_MS,
        'La verificación del acceso tardó demasiado.',
      )
      if (error) throw error

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
    } catch (error) {
      setState({
        status: 'signed_out',
        ...emptyIdentity,
        email: identity.email,
        message: error.message || 'No fue posible verificar el acceso. Solicita un enlace nuevo.',
      })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    let active = true

    const bootstrap = async () => {
      setState((current) => ({ ...current, status: 'loading', message: '' }))
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'La sesión guardada no respondió a tiempo.',
        )
        if (!active) return
        if (error) throw error
        await checkAccess(data.session)
      } catch (error) {
        if (!active) return
        setState({
          status: 'signed_out',
          ...emptyIdentity,
          message: 'La sesión anterior no pudo recuperarse. Solicita un enlace nuevo para ingresar.',
        })
      }
    }

    bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!active) return
        if (event === 'SIGNED_OUT') {
          setState({ status: 'signed_out', ...emptyIdentity })
          return
        }
        if (session?.user) checkAccess(session)
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

    let gate
    try {
      const response = await withTimeout(
        supabase.rpc('request_login_access', { target_email: email }),
        RPC_TIMEOUT_MS,
        'La validación del correo tardó demasiado.',
      )
      if (response.error) throw response.error
      gate = response.data
    } catch {
      // Existing Auth users can still request a link safely. Authorization is
      // enforced again by current_operator_profile and by RLS after sign-in.
      gate = { ready: true, fallback: true }
    }

    if (!gate?.ready) {
      setState({ status: 'confirmation_sent', ...emptyIdentity, email })
      return { error: null }
    }

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAppRedirectUrl(getOriginPath()),
            shouldCreateUser: gate.fallback ? false : true,
          },
        }),
        LINK_TIMEOUT_MS,
        'El servicio de correo tardó demasiado en responder.',
      )
      if (error) throw error
      setState({ status: 'link_sent', ...emptyIdentity, email })
      return { error: null }
    } catch (error) {
      setState({
        status: 'signed_out',
        ...emptyIdentity,
        email,
        message: error.message || 'No fue posible enviar el enlace de acceso.',
      })
      return { error }
    }
  }

  const signOut = async () => {
    setState({ status: 'loading', ...emptyIdentity })
    try {
      if (supabase) await withTimeout(supabase.auth.signOut({ scope: 'local' }), SESSION_TIMEOUT_MS, 'Sign out timed out.')
    } catch {
      // Local cache cleanup below is the last-resort escape hatch for a stuck session.
    }
    clearLocalAuthCache()
    window.location.replace(`/?signed_out=1&t=${Date.now()}`)
  }

  return { ...state, requestMagicLink, signOut }
}
