-- Attack surface data for the demo organization.
--
-- Certificate Transparency and the DNS checks read real public sources, so
-- the scratch stack runs with them off (CERT_MONITOR_ENABLED=false) and the
-- Attack surface pages would stay empty. This writes what those checks would
-- have found for the example domains: watched domains, certificate assets and
-- the exposures they raise. Run once, after the seed.

DO $$
DECLARE
  t_id uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  a    record;
BEGIN
  IF t_id IS NULL THEN RAISE EXCEPTION 'organization example-corp not found'; END IF;

  -- Domains watched in Certificate Transparency logs.
  INSERT INTO ct_monitor_state (tenant_id, domain, last_checked_at, last_success_at, last_source, subdomains_seen, next_attempt_at)
  VALUES (t_id, 'example.com', now() - interval '3 hours', now() - interval '3 hours', 'crt.sh', 6, now() + interval '21 hours'),
         (t_id, 'example.org', now() - interval '3 hours', now() - interval '3 hours', 'crt.sh', 2, now() + interval '21 hours'),
         (t_id, 'example.net', now() - interval '3 hours', now() - interval '3 hours', 'certspotter', 2, now() + interval '21 hours')
  ON CONFLICT (tenant_id, domain) DO NOTHING;

  -- Certificate assets: one per name, with the fields a TLS probe reports.
  FOR a IN SELECT * FROM (VALUES
      ('www.example.com',     'www.example.com',    'R11',               'Let''s Encrypt', 75,  false),
      ('app.example.com',     'app.example.com',    'R11',               'Let''s Encrypt', 21,  false),
      ('api.example.com',     '*.example.com',      'Example TLS RSA CA','Example Trust',  190, true),
      ('auth.example.com',    'auth.example.com',   'R10',               'Let''s Encrypt', 48,  false),
      ('shop.example.org',    'shop.example.org',   'E6',                'Let''s Encrypt', 9,   false),
      ('status.example.org',  'status.example.org', 'E5',                'Let''s Encrypt', 62,  false),
      ('legacy.example.net',  'legacy.example.net', 'legacy.example.net','',               -12, false),
      ('vpn.example.net',     'vpn.example.net',    'Example TLS RSA CA','Example Trust',  301, false)
    ) AS c(host, cn, issuer_cn, issuer_org, days, wildcard)
  LOOP
    INSERT INTO assets (tenant_id, name, asset_type, criticality, status, scope, exposure, properties, first_seen, last_seen, discovery_source, discovery_tool)
    SELECT t_id, a.host || ':443', 'certificate', 'medium', 'active', 'external', 'public',
      jsonb_build_object(
        'subject_cn', a.cn, 'issuer_cn', a.issuer_cn, 'issuer_org', a.issuer_org,
        'not_before', to_char((now() + make_interval(days => a.days) - interval '90 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'not_after',  to_char((now() + make_interval(days => a.days)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'fingerprint_sha256', encode(sha256(convert_to('demo-cert-' || a.host, 'UTF8')), 'hex'),
        'signature_algorithm', CASE WHEN a.issuer_cn LIKE 'E%' THEN 'ECDSA-SHA384' ELSE 'SHA256-RSA' END,
        'is_self_signed', (a.issuer_org = ''), 'is_wildcard', a.wildcard),
      now() - interval '20 days', now() - interval '3 hours', 'scan', 'httpx'
    WHERE NOT EXISTS (SELECT 1 FROM assets WHERE tenant_id = t_id AND name = a.host || ':443' AND asset_type = 'certificate');
  END LOOP;

  -- Exposures the platform's checks raise.
  INSERT INTO exposure_events (tenant_id, asset_id, event_type, severity, title, description, details, fingerprint, source, first_seen_at, last_seen_at)
  SELECT t_id, x.asset_id, x.event_type, x.severity, x.title, x.description, x.details::jsonb, 'demo:' || x.event_type || ':' || x.name, x.source,
         now() - x.age, now() - interval '3 hours'
  FROM (
    SELECT (SELECT id FROM assets WHERE tenant_id = t_id AND name = v.name AND asset_type IN ('domain','subdomain') LIMIT 1) AS asset_id, v.*
    FROM (VALUES
      ('legacy.example.net', 'dangling_cname', 'high', 'Dangling CNAME: legacy.example.net',
       'legacy.example.net is a CNAME to old-shop.example-hosting.net, which does not exist.', '{"target":"old-shop.example-hosting.net","rcode":"NXDOMAIN"}', 'easm-dns', interval '6 days'),
      ('shop.example.org', 'certificate_expiring', 'medium', 'Certificate expires in 9 days: shop.example.org',
       'The newest certificate logged for shop.example.org expires in 9 days.', '{"days_left":9,"issuer":"E6"}', 'cert-monitor', interval '2 days'),
      ('example.org', 'email_security_weak', 'medium', 'Weak email posture: example.org',
       'DMARC policy is none and MTA-STS is not published.', '{"dmarc":"p=none","mta_sts":false,"spf":"~all"}', 'easm-dns', interval '12 days'),
      ('status.example.org', 'dangling_ns', 'medium', 'Delegation without answer: status.example.org',
       'The name servers of status.example.org do not answer for the zone.', '{"ns":["ns1.example-dns.net","ns2.example-dns.net"]}', 'easm-dns', interval '4 days'),
      ('auth.example.com', 'subdomain_discovered', 'info', 'New subdomain: auth.example.com',
       'auth.example.com appeared in a logged certificate.', '{"source":"crt.sh"}', 'cert-monitor', interval '1 day'),
      ('staging.example.com', 'subdomain_discovered', 'info', 'New subdomain: staging.example.com',
       'staging.example.com appeared in a logged certificate.', '{"source":"crt.sh"}', 'cert-monitor', interval '3 days')
    ) AS v(name, event_type, severity, title, description, details, source, age)
  ) x
  WHERE x.asset_id IS NOT NULL
  ON CONFLICT (tenant_id, fingerprint) DO NOTHING;
END $$;
