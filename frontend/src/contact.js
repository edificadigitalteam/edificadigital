const DEFAULT_PUBLIC_CONTACT_URL = 'https://wa.me/'

export function buildPublicContactUrl(message, configuredUrl = '') {
  let url

  try {
    url = new URL(configuredUrl.trim() || DEFAULT_PUBLIC_CONTACT_URL)
  } catch {
    url = new URL(DEFAULT_PUBLIC_CONTACT_URL)
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    url = new URL(DEFAULT_PUBLIC_CONTACT_URL)
  }

  url.searchParams.set('text', message)
  return url.toString()
}
