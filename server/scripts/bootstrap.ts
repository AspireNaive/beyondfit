/**
 * Production bootstrap: one tenant and one admin — nothing else. Reads
 * BOOTSTRAP_* from the environment; safe to re-run (skips what exists).
 */
import { hashPassword } from '../src/auth/password.js'
import { config } from '../src/config.js'
import { newId } from '../src/lib/ids.js'
import { findTenantBySlug, insertTenant } from '../src/modules/tenants/repository.js'
import { findUserRowByEmail, insertUser } from '../src/modules/users/repository.js'

async function main() {
  const { tenantName, tenantSlug, adminEmail, adminPassword } = config.bootstrap
  let tenant = await findTenantBySlug(tenantSlug)
  if (!tenant) {
    await insertTenant({ id: newId(), name: tenantName, slug: tenantSlug, plan: 'growth', seats: 500, isDefault: true })
    tenant = (await findTenantBySlug(tenantSlug))!
    console.log(`tenant created: ${tenant.name} (${tenant.slug})`)
  } else {
    console.log(`tenant exists: ${tenant.name} (${tenant.slug})`)
  }

  if (!adminEmail || !adminPassword) {
    console.log('BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD not set — no admin created')
    return
  }
  if (adminPassword.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters')
  if (await findUserRowByEmail(adminEmail)) {
    console.log(`admin exists: ${adminEmail}`)
    return
  }
  await insertUser({
    id: newId(), tenantId: tenant.id, role: 'app_manager', firstName: 'Platform', lastName: 'Admin', email: adminEmail,
    passwordHash: await hashPassword(adminPassword), joinedAt: new Date().toISOString().slice(0, 10), title: 'Platform Operations',
  })
  console.log(`admin created: ${adminEmail} (app_manager)`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
