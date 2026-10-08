-- Domain proof for the demo organization.
--
-- A domain is proven by a DNS TXT record the platform looks up, which the
-- reserved example domains cannot carry. This marks two of the three proofs
-- (and the single sign-on domain) as verified; example.net stays waiting for
-- its TXT record.

UPDATE verified_domains v SET
  status = 'verified',
  verified_at = now() - interval '12 days',
  last_checked_at = now() - interval '3 hours',
  updated_at = now()
FROM tenants t
WHERE t.slug = 'example-corp' AND v.tenant_id = t.id
  AND v.domain IN ('example.com', 'example.org');
