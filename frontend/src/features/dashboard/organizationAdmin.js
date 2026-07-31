const nullable = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : value
  return normalized === '' || normalized === undefined ? null : normalized
}

// contact_email is the auto-provisioned tenant admin's login identity: NOT NULL + unique
// on public.organization (see 20260727010000_organization_admin_provisioning.sql), so unlike
// the other optional fields below it must never be nulled out here.
export function buildOrganizationPayload(form, { code } = {}) {
  return {
    id: form.id || null,
    code: (code ?? form.code).trim().toLowerCase(),
    name: form.name.trim(),
    legal_name: nullable(form.legal_name),
    tax_id: nullable(form.tax_id),
    country: nullable(form.country),
    city: nullable(form.city),
    contact_email: form.contact_email.trim().toLowerCase(),
    contact_phone: nullable(form.contact_phone),
    subscription_status: form.subscription_status,
    language: form.language,
    active: form.active,
  }
}
