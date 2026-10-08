-- Sensor state for the demo organization.
--
-- The seed pairs the sensors with the real sensor image's `pair` command,
-- which exits once approved: the sensors never run, so they never send a
-- heartbeat or a tool manifest. This sets what a running sensor would have
-- reported (the tool set of the published sensor image), so the console shows
-- them online and the scan workflows find a sensor for each step.

\set tools '[{"kind":"scanner","name":"subfinder","version":"v2.16.0","installed":true,"capabilities":["recon","subdomain","discover.subdomains"]},{"kind":"scanner","name":"dnsx","version":"1.3.1","installed":true,"capabilities":["recon","dns","resolve.dns"]},{"kind":"scanner","name":"naabu","version":"2.6.1","installed":true,"capabilities":["recon","portscan","scan.ports"]},{"kind":"scanner","name":"httpx","version":"v1.12.0","installed":true,"capabilities":["recon","http","tech_detect","probe.http"]},{"kind":"scanner","name":"nuclei","version":"v3.11.1","installed":true,"capabilities":["dast","vuln.templates"],"content":[{"name":"nuclei-templates","source":"image","managed":true,"version":"v10.4.9"}]},{"kind":"scanner","name":"katana","version":"v1.7.0","installed":true,"capabilities":["recon","crawler","url_discovery","crawl.web"]}]'

UPDATE sensors s
SET reported_tools        = :'tools'::jsonb,
    reported_tool_names   = ARRAY['subfinder','dnsx','naabu','httpx','nuclei','katana'],
    reported_capabilities = ARRAY['subfinder','recon','subdomain','discover.subdomains','dnsx','dns','resolve.dns','naabu','portscan','scan.ports','httpx','http','tech_detect','probe.http','nuclei','dast','vuln.templates','katana','crawler','url_discovery','crawl.web'],
    reported_os           = 'linux',
    reported_arch         = 'amd64',
    reported_at           = now(),
    version               = 'v0.11.0',
    sensor_product        = 'openctemio-sensor',
    protocol_version      = 2,
    protocol_seen_at      = now(),
    hostname              = s.name,
    ip_address            = (CASE s.name WHEN 'dc-a-scanner-01' THEN '203.0.113.5' ELSE '198.51.100.5' END)::inet,
    health                = 'online',
    status                = 'active',
    trust_level           = CASE s.name WHEN 'dc-a-scanner-01' THEN 'trusted' ELSE 'new' END,
    config_health         = 'ok',
    last_seen_at          = now(),
    process_started_at    = now() - interval '3 days 4 hours',
    heartbeat_interval_seconds = 30,
    heartbeat_due_at      = now() + interval '30 days',
    cpu_percent           = CASE s.name WHEN 'dc-a-scanner-01' THEN 23.5 ELSE 8.2 END,
    memory_percent        = CASE s.name WHEN 'dc-a-scanner-01' THEN 41.0 ELSE 27.3 END,
    total_scans           = CASE s.name WHEN 'dc-a-scanner-01' THEN 42 ELSE 17 END,
    total_findings        = CASE s.name WHEN 'dc-a-scanner-01' THEN 128 ELSE 36 END,
    metrics_updated_at    = now(),
    updated_at            = now()
FROM tenants t
WHERE t.slug = 'example-corp'
  AND s.tenant_id = t.id
  AND s.name IN ('dc-a-scanner-01', 'edge-easm-01');
