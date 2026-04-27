import sql from 'mssql';

export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

const GENERIC_SECOND_LEVEL_DOMAINS = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'net',
  'org',
]);

function isDuplicateKeyError(err) {
  return err?.number === 2627 || err?.number === 2601;
}

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function normalizeDomain(domain) {
  return (domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
}

export function getEmailDomain(email) {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex < 0 || atIndex === normalizedEmail.length - 1) return '';
  return normalizeDomain(normalizedEmail.slice(atIndex + 1));
}

export function isPublicEmailDomain(value) {
  const domain = value.includes('@') ? getEmailDomain(value) : normalizeDomain(value);
  return PUBLIC_EMAIL_DOMAINS.has(domain);
}

export function normalizeOrganizationName(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

export function inferOrganizationNameFromDomain(domain) {
  const normalizedDomain = normalizeDomain(domain);
  const parts = normalizedDomain.split('.').filter(Boolean);
  if (parts.length === 0) return '';

  let labelIndex = Math.max(0, parts.length - 2);
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];
  if (
    parts.length >= 3
    && lastPart.length === 2
    && GENERIC_SECOND_LEVEL_DOMAINS.has(secondLastPart)
  ) {
    labelIndex = parts.length - 3;
  }

  return parts[labelIndex]
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function findOrganizationByDomain(pool, domain) {
  const result = await pool
    .request()
    .input('domain', sql.NVarChar(255), normalizeDomain(domain))
    .query(`
      SELECT TOP 1 o.id, o.name
      FROM org_domains od
      JOIN organizations o ON o.id = od.org_id
      WHERE od.domain = @domain;
    `);

  return result.recordset[0] || null;
}

async function findOrganizationByName(pool, name) {
  const result = await pool
    .request()
    .input('orgName', sql.NVarChar(100), normalizeOrganizationName(name))
    .query('SELECT TOP 1 id, name FROM organizations WHERE name = @orgName;');

  return result.recordset[0] || null;
}

async function upsertOrganization(pool, name) {
  const orgName = normalizeOrganizationName(name);
  if (!orgName) return null;

  const existing = await findOrganizationByName(pool, orgName);
  if (existing) return existing;

  try {
    const insertResult = await pool
      .request()
      .input('orgName', sql.NVarChar(100), orgName)
      .query('INSERT INTO organizations (name) OUTPUT inserted.id, inserted.name VALUES (@orgName);');

    return insertResult.recordset[0] || null;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    return findOrganizationByName(pool, orgName);
  }
}

async function addDomainMapping(pool, orgId, domain) {
  const normalizedDomain = normalizeDomain(domain);
  try {
    await pool
      .request()
      .input('orgId', sql.Int, orgId)
      .input('domain', sql.NVarChar(255), normalizedDomain)
      .query('INSERT INTO org_domains (org_id, domain) VALUES (@orgId, @domain);');

    return null;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    return findOrganizationByDomain(pool, normalizedDomain);
  }
}

export async function resolveOrganizationForEmail(pool, { email, organizationName } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const domain = getEmailDomain(normalizedEmail);

  if (!domain) {
    return {
      orgId: null,
      orgName: null,
      domain,
      source: 'none',
      isPublicDomain: false,
      requiresOrganization: false,
    };
  }

  const mappedOrganization = await findOrganizationByDomain(pool, domain);
  if (mappedOrganization) {
    return {
      orgId: mappedOrganization.id,
      orgName: mappedOrganization.name,
      domain,
      source: 'mapped-domain',
      isPublicDomain: isPublicEmailDomain(domain),
      requiresOrganization: false,
    };
  }

  if (isPublicEmailDomain(domain)) {
    const manualOrgName = normalizeOrganizationName(organizationName);
    if (!manualOrgName) {
      return {
        orgId: null,
        orgName: null,
        domain,
        source: 'public-domain',
        isPublicDomain: true,
        requiresOrganization: true,
      };
    }

    const organization = await upsertOrganization(pool, manualOrgName);
    return {
      orgId: organization?.id ?? null,
      orgName: organization?.name ?? manualOrgName,
      domain,
      source: 'manual-public-domain',
      isPublicDomain: true,
      requiresOrganization: false,
    };
  }

  const inferredOrgName = inferOrganizationNameFromDomain(domain);
  const organization = await upsertOrganization(pool, inferredOrgName);
  if (!organization) {
    return {
      orgId: null,
      orgName: null,
      domain,
      source: 'none',
      isPublicDomain: false,
      requiresOrganization: false,
    };
  }

  const racedMapping = await addDomainMapping(pool, organization.id, domain);
  if (racedMapping) {
    return {
      orgId: racedMapping.id,
      orgName: racedMapping.name,
      domain,
      source: 'mapped-domain',
      isPublicDomain: false,
      requiresOrganization: false,
    };
  }

  return {
    orgId: organization.id,
    orgName: organization.name,
    domain,
    source: 'inferred-domain',
    isPublicDomain: false,
    requiresOrganization: false,
  };
}