import { describe, expect, it } from 'vitest';
import { createMockPool, sqlError } from '../test-helpers/mockPool.js';
import {
  getEmailDomain,
  inferOrganizationNameFromDomain,
  isPublicEmailDomain,
  resolveOrganizationForEmail,
} from './organizations.js';

describe('organization helpers', () => {
  it('normalizes email domains', () => {
    expect(getEmailDomain(' Ada@Contoso.COM  ')).toBe('contoso.com');
    expect(getEmailDomain('not-an-email')).toBe('');
  });

  it('detects public email domains', () => {
    expect(isPublicEmailDomain('alex@gmail.com')).toBe(true);
    expect(isPublicEmailDomain('outlook.com')).toBe(true);
    expect(isPublicEmailDomain('contoso.com')).toBe(false);
  });

  it('infers readable organization names from domains', () => {
    expect(inferOrganizationNameFromDomain('contoso.com')).toBe('Contoso');
    expect(inferOrganizationNameFromDomain('northwind.co.uk')).toBe('Northwind');
    expect(inferOrganizationNameFromDomain('fabrikam-research.com')).toBe('Fabrikam Research');
  });
});

describe('resolveOrganizationForEmail', () => {
  it('uses an existing mapped domain before inference', async () => {
    const { pool, calls } = createMockPool([[{ id: 7, name: 'NUS' }]]);

    const result = await resolveOrganizationForEmail(pool, { email: 'ada@nus.edu.sg' });

    expect(result).toMatchObject({ orgId: 7, orgName: 'NUS', source: 'mapped-domain' });
    expect(calls).toHaveLength(1);
    expect(calls[0].inputs.domain).toBe('nus.edu.sg');
  });

  it('infers and maps an unknown non-public company domain', async () => {
    const { pool, calls } = createMockPool([
      [],
      [],
      [{ id: 30, name: 'Contoso' }],
      { recordset: [], rowsAffected: [1] },
    ]);

    const result = await resolveOrganizationForEmail(pool, { email: 'alex@contoso.com' });

    expect(result).toMatchObject({ orgId: 30, orgName: 'Contoso', source: 'inferred-domain' });
    expect(calls[1].inputs.orgName).toBe('Contoso');
    expect(calls[3].inputs).toEqual({ orgId: 30, domain: 'contoso.com' });
  });

  it('re-reads the existing domain mapping when inference races with another request', async () => {
    const { pool } = createMockPool([
      [],
      [],
      [{ id: 30, name: 'Contoso' }],
      sqlError(2627),
      [{ id: 31, name: 'Contoso Ltd' }],
    ]);

    const result = await resolveOrganizationForEmail(pool, { email: 'alex@contoso.com' });

    expect(result).toMatchObject({ orgId: 31, orgName: 'Contoso Ltd', source: 'mapped-domain' });
  });

  it('requires an organization for unmapped public email domains', async () => {
    const { pool } = createMockPool([[]]);

    const result = await resolveOrganizationForEmail(pool, { email: 'alex@gmail.com' });

    expect(result).toMatchObject({ orgId: null, requiresOrganization: true, isPublicDomain: true });
  });

  it('resolves public email domains from a supplied organization without mapping the domain', async () => {
    const { pool, calls } = createMockPool([[], [], [{ id: 44, name: 'Contoso' }]]);

    const result = await resolveOrganizationForEmail(pool, {
      email: 'alex@gmail.com',
      organizationName: ' Contoso ',
    });

    expect(result).toMatchObject({ orgId: 44, orgName: 'Contoso', source: 'manual-public-domain' });
    expect(calls).toHaveLength(3);
    expect(calls.some((call) => call.query?.includes('INSERT INTO org_domains'))).toBe(false);
  });
});
