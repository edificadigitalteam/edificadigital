import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js'

const initialStatus = isSupabaseConfigured ? 'loading' : 'configuration'
const emptyIdentity = {
  email: '', userId: '', displayName: '', role: 'operator', organizationId: '', organizationName: '',
  tenantHost: '', tenantOrganizationId: '', message: '',
}
const demoFallbackUrl = 'https://edificadigital-git-feature-demo-acces-a82faf-yangetzes-projects.vercel.app'
const SESSION_TIMEOUT_MS = 8000
const RPC_TIMEOUT_MS = 6000
const TENANT_TIMEOUT_MS = 3000
const LINK_TIMEOUT_MS = 12000
// Upper bound on the whole bootstrap (getSession + profile/tenant checks combined),
// so a slow or wedged step downstream of getSession can't leave the UI on
// "loading" past this point even though each individual step is also timed.
const BOOTSTRAP_TIMEOUT_MS = 12000
const redirectablePathPrefixes = ['/app', '/donations']
const AUTH_NEXT_KEY = 'edifica-auth-next'

let sharedState = { status: initialStatus, ...emptyIdentity }
const subscribers = new Set()
let authStarted = false
let authSubscription = null
let sessionCheckPromise = null
let sessionCheckToken = ''
let lastAuthorizedToken = ''

function publish(next) {
  sharedState = next
  try {
    if (next.status === 'authorized') window.sessionStorage.setItem('edifica-access-role', next.role || 'operator')
    if (next.status === 'signed_out' || next.status === 'restricted') window.sessionStorage.removeItem('edifica-access-role')
  } catch { /* storage can be unavailable */ }
  subscribers.forEach((listener) => listener(sharedState))
}

function withTimeout(promise, milliseconds, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), milliseconds) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => window.clearTimeout(timer))
}

function isLocalUrl(value) {
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)
  } catch { return false }
}

function validInternalPath(path) {
  return Boolean(path && path.startsWith('/') && redirectablePathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
}

function getOriginPath() {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)
  ;['login', 't', 'auth', 'code', 'error', 'error_code', 'error_description'].forEach((key) => params.delete(key))
  const cleanedSearch = params.toString()
  const path = cleanedSearch ? `${pathname}?${cleanedSearch}` : pathname
  return path === '/app' || path === '/' ? '' : path
}

function rememberNextPath(path) {
  if (!validInternalPath(path)) return
  try { window.sessionStorage.setItem(AUTH_NEXT_KEY, path) } catch { /* ignore */ }
}

function consumeNextPath() {
  if (window.location.pathname !== '/app') return null
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('next')
  let stored = ''
  try {
    stored = window.sessionStorage.getItem(AUTH_NEXT_KEY) || ''
    window.sessionStorage.removeItem(AUTH_NEXT_KEY)
  } catch { /* ignore */ }
  if (validInternalPath(fromUrl)) return fromUrl
  if (validInternalPath(stored)) return stored
  return null
}

function getAppRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim()
  const runtimeIsLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)
  const localConfiguredUrl = configuredUrl && !isLocalUrl(configuredUrl) ? configuredUrl : ''
  const baseUrl = runtimeIsLocal ? (localConfiguredUrl || demoFallbackUrl) : window.location.origin
  const normalizedBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
  const redirect = new URL('/app', normalizedBaseUrl)
  redirect.searchParams.set('auth', 'callback')
  return redirect.toString()
}

function clearCallbackUrl() {
  if (window.location.pathname !== '/app') return
  const params = new URLSearchParams(window.location.search)
  const keys = ['code', 'auth', 'login', 'error', 'error_code', 'error_description', 't', 'next']
  if (!keys.some((key) => params.has(key)) && !window.location.hash) return
  window.history.replaceState({}, document.title, '/app')
}

function clearLocalAuthCache() {
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) window.localStorage.removeItem(key)
    })
    window.sessionStorage.removeItem('edifica-access-role')
    window.sessionStorage.removeItem(AUTH_NEXT_KEY)
  } catch { /* ignore */ }
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
  } catch { return null }
}

async function performAccessCheck(session) {
  if (!supabase || !session?.user) {
    lastAuthorizedToken = ''
    publish({ status: isSupabaseConfigured ? 'signed_out' : 'configuration', ...emptyIdentity })
    return
  }

  const identity = { email: session.user.email ?? '', userId: session.user.id ?? '' }
  const [profileResponse, tenant] = await Promise.all([
    withTimeout(supabase.rpc('current_operator_profile'), RPC_TIMEOUT_MS, 'La verificación del perfil tardó demasiado.')
      .catch((error) => ({ data: null, error })),
    resolveCurrentTenant(),
  ])
  const { data: profile, error: profileError } = profileResponse

  if (!profileError) {
    const authorized = profile?.authorized ?? profile?.active ?? false
    const profileOrganizationId = profile?.organization_id ?? ''
    const role = profile?.role ?? 'operator'
    const tenantMismatch = Boolean(
      tenant?.organization_id && profileOrganizationId && tenant.organization_id !== profileOrganizationId && role !== 'super_admin'
    )
    const nextState = {
      status: authorized && !tenantMismatch ? 'authorized' : 'restricted',
      ...identity,
      email: profile?.email ?? identity.email,
      displayName: profile?.display_name ?? '',
      role,
      organizationId: profileOrganizationId,
      organizationName: profile?.organization_name ?? '',
      tenantHost: tenant?.hostname ?? '',
      tenantOrganizationId: tenant?.organization_id ?? '',
      message: tenantMismatch ? 'Este acceso pertenece a una organización diferente al tenant solicitado.' : '',
    }
    publish(nextState)
    if (nextState.status === 'authorized') {
      lastAuthorizedToken = session.access_token || session.user.id
      const next = consumeNextPath()
      if (next) { window.location.replace(next); return }
      clearCallbackUrl()
    }
    return
  }

  try {
    const { data, error } = await withTimeout(supabase.rpc('current_operator_access'), RPC_TIMEOUT_MS, 'La verificación del acceso tardó demasiado.')
    if (error) throw error
    publish({
      status: data ? 'authorized' : 'restricted', ...identity,
      displayName: '', role: 'operator', organizationId: '', organizationName: '',
      tenantHost: tenant?.hostname ?? '', tenantOrganizationId: tenant?.organization_id ?? '', message: '',
    })
    if (data) {
      lastAuthorizedToken = session.access_token || session.user.id
      const next = consumeNextPath()
      if (next) { window.location.replace(next); return }
      clearCallbackUrl()
    }
  } catch (error) {
    publish({ status: 'signed_out', ...emptyIdentity, email: identity.email, message: error.message || 'No fue posible verificar el acceso.' })
  }
}

function checkAccess(session) {
  if (!session?.user) return performAccessCheck(session)
  const token = session.access_token || session.user.id
  if (lastAuthorizedToken === token && sharedState.status === 'authorized') {
    const next = consumeNextPath()
    if (next) window.location.replace(next)
    return Promise.resolve()
  }
  if (sessionCheckPromise && sessionCheckToken === token) return sessionCheckPromise
  sessionCheckToken = token
  sessionCheckPromise = performAccessCheck(session).finally(() => {
    if (sessionCheckToken === token) {
      sessionCheckPromise = null
      sessionCheckToken = ''
    }
  })
  return sessionCheckPromise
}

function ensureAuthStarted() {
  if (!supabase || authStarted) return
  authStarted = true
  publish({ ...sharedState, status: 'loading', message: '' })

  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      if (event === 'SIGNED_OUT') {
        lastAuthorizedToken = ''
        publish({ status: 'signed_out', ...emptyIdentity })
        return
      }
      if (session?.user) checkAccess(session)
    }, 0)
  })
  authSubscription = listener.subscription

  const bootstrap = withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, 'La sesión guardada no respondió a tiempo.')
    .then(({ data, error }) => {
      if (error) throw error
      return checkAccess(data.session)
    })

  withTimeout(bootstrap, BOOTSTRAP_TIMEOUT_MS, 'La verificación de acceso tardó demasiado.')
    .catch(() => {
      if (sharedState.status === 'loading') {
        publish({ status: 'signed_out', ...emptyIdentity, message: 'La sesión anterior no pudo recuperarse. Solicita un enlace nuevo.' })
      }
    })
}

async function requestMagicLink(email) {
  if (!supabase) return { error: new Error('Supabase configuration is unavailable.') }
  const originPath = getOriginPath()
  rememberNextPath(originPath)
  publish({ status: 'sending_link', ...emptyIdentity, email })

  let gate
  try {
    const response = await withTimeout(supabase.rpc('request_login_access', { target_email: email }), RPC_TIMEOUT_MS, 'La validación del correo tardó demasiado.')
    if (response.error) throw response.error
    gate = response.data
  } catch {
    gate = { ready: true, fallback: true }
  }

  if (!gate?.ready) {
    publish({ status: 'confirmation_sent', ...emptyIdentity, email })
    return { error: null }
  }

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: getAppRedirectUrl(), shouldCreateUser: gate.fallback ? false : true } }),
      LINK_TIMEOUT_MS,
      'El servicio de correo tardó demasiado en responder.',
    )
    if (error) throw error
    publish({ status: 'link_sent', ...emptyIdentity, email })
    return { error: null }
  } catch (error) {
    publish({ status: 'signed_out', ...emptyIdentity, email, message: error.message || 'No fue posible enviar el enlace de acceso.' })
    return { error }
  }
}

async function signOut() {
  publish({ status: 'loading', ...emptyIdentity })
  try { if (supabase) await withTimeout(supabase.auth.signOut({ scope: 'local' }), SESSION_TIMEOUT_MS, 'Sign out timed out.') } catch { /* cleanup below */ }
  lastAuthorizedToken = ''
  clearLocalAuthCache()
  window.location.replace(`/?signed_out=1&t=${Date.now()}`)
}

export function useOperatorAccess() {
  const [state, setState] = useState(sharedState)

  useEffect(() => {
    subscribers.add(setState)
    setState(sharedState)
    ensureAuthStarted()
    return () => subscribers.delete(setState)
  }, [])

  return { ...state, requestMagicLink, signOut }
}

// Kept for hot-module cleanup during development; production uses one singleton per page load.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    authSubscription?.unsubscribe?.()
    authSubscription = null
    authStarted = false
  })
}
