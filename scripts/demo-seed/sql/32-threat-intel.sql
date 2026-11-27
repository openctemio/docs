-- The public CISA KEV and EPSS entries of the CVEs the demo findings name.
--
-- An installation downloads both catalogs; a scratch stack without internet
-- access (or before its first sync) has neither, so the KEV badges, EPSS
-- figures and the priority rules that read them would show nothing. These
-- are the public values for those CVEs only. A later real sync overwrites
-- them. The findings' assets are queued for reclassification so the
-- priority classes pick the values up.

INSERT INTO kev_catalog (cve_id, vendor_project, product, vulnerability_name, date_added, due_date, known_ransomware_campaign_use, created_at, updated_at)
VALUES
 ('CVE-2017-0144', 'Microsoft', 'SMBv1', 'Microsoft SMBv1 Remote Code Execution Vulnerability', '2022-02-10', '2022-08-10', 'Known', now(), now()),
 ('CVE-2021-44228', 'Apache', 'Log4j2', 'Apache Log4j2 Remote Code Execution Vulnerability', '2021-12-10', '2021-12-24', 'Known', now(), now()),
 ('CVE-2023-27997', 'Fortinet', 'FortiOS and FortiProxy SSL-VPN', 'Fortinet FortiOS and FortiProxy SSL-VPN Heap-Based Buffer Overflow Vulnerability', '2023-06-13', '2023-07-04', 'Known', now(), now()),
 ('CVE-2023-44487', 'IETF', 'HTTP/2', 'HTTP/2 Rapid Reset Attack Vulnerability', '2023-10-10', '2023-10-31', 'Unknown', now(), now()),
 ('CVE-2023-46604', 'Apache', 'ActiveMQ', 'Apache ActiveMQ Deserialization of Untrusted Data Vulnerability', '2023-11-02', '2023-11-23', 'Known', now(), now()),
 ('CVE-2024-23897', 'Jenkins', 'Jenkins Command Line Interface (CLI)', 'Jenkins Command Line Interface (CLI) Path Traversal Vulnerability', '2024-08-19', '2024-09-09', 'Known', now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO epss_scores (cve_id, epss_score, model_version, created_at, updated_at)
VALUES
 ('CVE-2017-0144', 0.99230, 'v2025.03.14', now(), now()),
 ('CVE-2021-23017', 0.53461, 'v2025.03.14', now(), now()),
 ('CVE-2021-23337', 0.20158, 'v2025.03.14', now(), now()),
 ('CVE-2021-3749', 0.08515, 'v2025.03.14', now(), now()),
 ('CVE-2021-44228', 0.99999, 'v2025.03.14', now(), now()),
 ('CVE-2023-26136', 0.02627, 'v2025.03.14', now(), now()),
 ('CVE-2023-27997', 0.86750, 'v2025.03.14', now(), now()),
 ('CVE-2023-38408', 0.79700, 'v2025.03.14', now(), now()),
 ('CVE-2023-44487', 0.99999, 'v2025.03.14', now(), now()),
 ('CVE-2023-45288', 0.89455, 'v2025.03.14', now(), now()),
 ('CVE-2023-46604', 0.99992, 'v2025.03.14', now(), now()),
 ('CVE-2023-48795', 0.93547, 'v2025.03.14', now(), now()),
 ('CVE-2024-23897', 0.99999, 'v2025.03.14', now(), now()),
 ('CVE-2024-28849', 0.01044, 'v2025.03.14', now(), now()),
 ('CVE-2024-34351', 0.05453, 'v2025.03.14', now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO finding_priority_queue (asset_id, tenant_id, reason, enqueued_at)
SELECT DISTINCT f.asset_id, f.tenant_id, 'asset_change', now()
FROM findings f JOIN tenants t ON t.id = f.tenant_id
WHERE t.slug = 'example-corp' AND f.asset_id IS NOT NULL AND f.cve_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- What the threat intelligence page reports about the catalogs: loaded
-- (the vulnerability feed has nothing to download on a scratch stack).
UPDATE threat_intel_sync_status SET last_sync_status = 'success', last_sync_error = NULL, last_sync_at = now(),
  records_synced = CASE source_name WHEN 'kev' THEN 6 WHEN 'epss' THEN 15 ELSE 0 END, updated_at = now()
WHERE source_name IN ('kev', 'epss', 'vulnfeed') AND last_sync_status <> 'success';
