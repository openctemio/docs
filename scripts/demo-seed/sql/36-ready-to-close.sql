-- Closes waiting in Findings > Ready to close.
--
-- A proposal is written when a covered scan no longer finds an issue and the
-- organization reviews closes first. No sensor runs in the demo, so this
-- records the proposals such a scan would have made for three nuclei
-- findings. Run after 30-history.sql (the evidence must be newer than the
-- findings' last sighting).

DO $$
DECLARE
  t_id uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  s_id uuid;
BEGIN
  IF t_id IS NULL THEN RAISE EXCEPTION 'organization example-corp not found'; END IF;
  s_id := (SELECT id FROM scans WHERE tenant_id = t_id AND name = 'Daily perimeter' LIMIT 1);

  -- Review first, so the platform proposes rather than closes.
  INSERT INTO finding_closure_proposals (tenant_id, finding_id, method, evidence, proposed_at, evidence_at)
  SELECT t_id, f.id, 'covered_scan',
         jsonb_build_object('scan_id', s_id, 'tool', 'nuclei', 'scanner', 'nuclei', 'observed_at',
           to_char((now() - interval '1 hour') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'held', f.title LIKE 'Directory%'),
         now() - interval '50 minutes', now() - interval '1 hour'
  FROM findings f
  WHERE f.tenant_id = t_id AND f.tool_name = 'nuclei'
    AND f.status IN ('new', 'confirmed', 'in_progress', 'fix_applied')
    AND (f.title LIKE 'Git Configuration%' OR f.title LIKE 'Open Redirect%' OR f.title LIKE 'Directory Listing%')
    AND COALESCE(f.last_seen_at, f.created_at) <= now() - interval '1 hour'
  ON CONFLICT DO NOTHING;
END $$;
