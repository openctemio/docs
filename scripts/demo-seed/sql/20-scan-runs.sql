-- Scan run history for the demo organization.
--
-- The seed triggers the demo scans through the API, which plans each run
-- (steps, targets, the first task) exactly as for a real scan. No sensor
-- runs in the scratch stack, so nothing is ever scanned and the runs would
-- wait forever. demo.finish_run() then writes what a sensor would have
-- reported: step and task results, timings, and the targets each step
-- derived from the previous one (the run map).
--
-- Usage (the seed calls it after each trigger):
--   SELECT demo.finish_run('Weekly external surface', 7, 'completed');
--   SELECT demo.finish_run('Shop web application', 3, 'failed', 'crawl');
--   SELECT demo.finish_run('Weekly external surface', 0.02, 'running');

CREATE SCHEMA IF NOT EXISTS demo;

-- Targets each stage derives, by workflow shape (named after its first step).
DROP TABLE IF EXISTS demo.run_targets;
CREATE TABLE demo.run_targets (
  shape text, stage_key text, target_key text, asset_name text, parent_name text, parent_stage text, relation text, hop int
);
INSERT INTO demo.run_targets VALUES
  -- External attack surface: subdomains -> dns -> ports -> http -> vulns
  ('subdomains', 'dns', 'www.example.com', 'www.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'app.example.com', 'app.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'api.example.com', 'api.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'auth.example.com', 'auth.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'staging.example.com', 'staging.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'mail.example.com', 'mail.example.com', 'example.com', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'shop.example.org', 'shop.example.org', 'example.org', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'status.example.org', 'status.example.org', 'example.org', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'vpn.example.net', 'vpn.example.net', 'example.net', 'subdomains', 'contains', 1),
  ('subdomains', 'dns', 'legacy.example.net', 'legacy.example.net', 'example.net', 'subdomains', 'contains', 1),
  ('subdomains', 'ports', '203.0.113.10', '203.0.113.10', 'app.example.com', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '203.0.113.11', '203.0.113.11', 'api.example.com', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '203.0.113.20', '203.0.113.20', 'mail.example.com', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '203.0.113.30', '203.0.113.30', 'staging.example.com', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '198.51.100.15', '198.51.100.15', 'vpn.example.net', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '198.51.100.30', '198.51.100.30', 'shop.example.org', 'dns', 'resolves_to', 2),
  ('subdomains', 'ports', '198.51.100.44', '198.51.100.44', 'legacy.example.net', 'dns', 'resolves_to', 2),
  ('subdomains', 'http', 'app.example.com:443', 'app.example.com', '203.0.113.10', 'ports', 'exposes', 3),
  ('subdomains', 'http', 'api.example.com:443', 'api.example.com', '203.0.113.11', 'ports', 'exposes', 3),
  ('subdomains', 'http', 'staging.example.com:443', 'staging.example.com', '203.0.113.30', 'ports', 'exposes', 3),
  ('subdomains', 'http', 'vpn.example.net:443', 'vpn.example.net', '198.51.100.15', 'ports', 'exposes', 3),
  ('subdomains', 'http', 'shop.example.org:443', 'shop.example.org', '198.51.100.30', 'ports', 'exposes', 3),
  ('subdomains', 'http', 'legacy.example.net:443', 'legacy.example.net', '198.51.100.44', 'ports', 'exposes', 3),
  ('subdomains', 'vulns', 'https://app.example.com', 'https://app.example.com', 'app.example.com', 'http', 'serves', 4),
  ('subdomains', 'vulns', 'https://api.example.com', 'https://api.example.com', 'api.example.com', 'http', 'serves', 4),
  ('subdomains', 'vulns', 'https://staging.example.com', NULL, 'staging.example.com', 'http', 'serves', 4),
  ('subdomains', 'vulns', 'https://shop.example.org', 'https://shop.example.org', 'shop.example.org', 'http', 'serves', 4),
  ('subdomains', 'vulns', 'https://legacy.example.net', NULL, 'legacy.example.net', 'http', 'serves', 4),
  ('subdomains', 'vulns', 'legacy.example.net:61616', NULL, 'legacy.example.net', 'ports', 'exposes', 4),
  -- Perimeter network: ports -> http -> vulns
  ('ports', 'http', '203.0.113.10:443', '203.0.113.10', NULL, 'ports', 'exposes', 1),
  ('ports', 'http', '203.0.113.11:443', '203.0.113.11', NULL, 'ports', 'exposes', 1),
  ('ports', 'http', '203.0.113.20:443', '203.0.113.20', NULL, 'ports', 'exposes', 1),
  ('ports', 'http', '198.51.100.15:443', '198.51.100.15', NULL, 'ports', 'exposes', 1),
  ('ports', 'http', '198.51.100.30:443', '198.51.100.30', NULL, 'ports', 'exposes', 1),
  ('ports', 'http', '198.51.100.44:443', '198.51.100.44', NULL, 'ports', 'exposes', 1),
  ('ports', 'vulns', '203.0.113.10:22', '203.0.113.10', NULL, 'ports', 'exposes', 1),
  ('ports', 'vulns', '203.0.113.11:22', '203.0.113.11', NULL, 'ports', 'exposes', 1),
  ('ports', 'vulns', '198.51.100.44:3389', '198.51.100.44', NULL, 'ports', 'exposes', 1),
  ('ports', 'vulns', '198.51.100.44:445', '198.51.100.44', NULL, 'ports', 'exposes', 1),
  ('ports', 'vulns', 'https://203.0.113.10', '203.0.113.10', '203.0.113.10', 'http', 'serves', 2),
  ('ports', 'vulns', 'https://198.51.100.15', '198.51.100.15', '198.51.100.15', 'http', 'serves', 2),
  -- Web application: http -> crawl -> vulns
  ('http', 'crawl', 'https://shop.example.org', 'https://shop.example.org', 'shop.example.org', 'http', 'serves', 1),
  ('http', 'vulns', 'https://shop.example.org/cart', NULL, 'https://shop.example.org', 'crawl', 'links_to', 2),
  ('http', 'vulns', 'https://shop.example.org/account/login', NULL, 'https://shop.example.org', 'crawl', 'links_to', 2),
  ('http', 'vulns', 'https://shop.example.org/api/products', NULL, 'https://shop.example.org', 'crawl', 'links_to', 2),
  ('http', 'vulns', 'https://shop.example.org/search?q=', NULL, 'https://shop.example.org', 'crawl', 'links_to', 2);

CREATE OR REPLACE FUNCTION demo.finish_run(scan_name text, days_ago numeric, final_status text, fail_step text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  t_id      uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  sensor    uuid;
  r         record;
  st        record;
  base      timestamptz := now() - days_ago * interval '1 day';
  run_shape text;
  s_start   timestamptz;
  s_end     timestamptz;
  s_status  text;
  cmd       uuid;
  n_found   int;
  total_f   int := 0;
  done_n    int := 0;
  fail_n    int := 0;
  skip_n    int := 0;
  failed    boolean := false;
  last_end  timestamptz := base;
  tool_of   jsonb := '{"discover.subdomains":"subfinder","resolve.dns":"dnsx","scan.ports":"naabu","probe.http":"httpx","vuln.templates":"nuclei","crawl.web":"katana"}';
  cap       text;
BEGIN
  SELECT id INTO sensor FROM sensors WHERE tenant_id = t_id AND name = 'dc-a-scanner-01';
  SELECT sr.* INTO r FROM scan_runs sr JOIN scans s ON s.id = sr.scan_id
   WHERE sr.tenant_id = t_id AND s.name = scan_name AND sr.status IN ('pending', 'running')
   ORDER BY sr.created_at DESC LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'no open run for scan %', scan_name; END IF;
  SELECT step_key INTO run_shape FROM scan_run_steps WHERE scan_run_id = r.id ORDER BY step_order LIMIT 1;

  FOR st IN SELECT * FROM scan_run_steps WHERE scan_run_id = r.id ORDER BY step_order LOOP
    cap := (SELECT ws.capabilities[1] FROM scan_workflow_steps ws WHERE ws.id = st.step_id);
    s_start := base + (st.step_order - 1) * interval '5 minutes' + interval '20 seconds';
    s_end := s_start + interval '3 minutes 25 seconds' + (st.step_order * interval '13 seconds');
    IF failed THEN
      s_status := 'skipped';
    ELSIF final_status = 'running' THEN
      s_status := CASE WHEN st.step_order <= 2 THEN 'completed' WHEN st.step_order = 3 THEN 'running' ELSE 'pending' END;
    ELSIF st.step_key = fail_step THEN
      s_status := CASE WHEN final_status = 'partial' THEN 'partial' ELSE 'timeout' END;
    ELSE
      s_status := 'completed';
    END IF;
    n_found := CASE WHEN s_status = 'completed' AND st.step_key = 'vulns' THEN 4 + (st.step_order + floor(days_ago)::int) % 5 ELSE 0 END;

    cmd := st.command_id;
    IF cmd IS NULL AND s_status IN ('completed', 'running', 'timeout', 'partial') THEN
      cmd := gen_random_uuid();
      INSERT INTO commands (id, tenant_id, sensor_id, scan_run_step_id, type, priority, payload, status, created_at, expires_at)
      VALUES (cmd, t_id, sensor, st.id, 'scan', 'normal',
        jsonb_build_object('step_key', st.step_key, 'scan_run_id', r.id, 'scan_run_step_id', st.id,
          'scanner', tool_of ->> cap, 'capability', cap || '@1', 'required_capabilities', jsonb_build_array(cap)),
        'pending', s_start - interval '15 seconds', s_start + interval '2 days');
    END IF;
    IF cmd IS NOT NULL THEN
      UPDATE commands SET
        sensor_id = sensor,
        status = CASE s_status WHEN 'completed' THEN 'completed' WHEN 'running' THEN 'running' WHEN 'pending' THEN 'pending' ELSE 'failed' END,
        created_at = s_start - interval '15 seconds',
        queued_at = s_start - interval '15 seconds',
        acknowledged_at = CASE WHEN s_status <> 'pending' THEN s_start - interval '5 seconds' END,
        started_at = CASE WHEN s_status <> 'pending' THEN s_start END,
        completed_at = CASE WHEN s_status IN ('completed', 'timeout', 'partial') THEN s_end END,
        error_message = CASE WHEN s_status IN ('timeout', 'partial') THEN 'step exceeded its timeout on 1 of 4 targets' END,
        expires_at = s_start + interval '2 days'
      WHERE id = cmd;
    END IF;

    UPDATE scan_run_steps SET
      status = s_status,
      sensor_id = CASE WHEN s_status IN ('pending', 'skipped') THEN NULL ELSE sensor END,
      command_id = cmd,
      tool = COALESCE(NULLIF(tool, ''), tool_of ->> cap),
      capability = COALESCE(NULLIF(capability, ''), cap || '@1'),
      queued_at = CASE WHEN s_status NOT IN ('pending', 'skipped') THEN s_start - interval '15 seconds' END,
      started_at = CASE WHEN s_status NOT IN ('pending', 'skipped') THEN s_start END,
      completed_at = CASE WHEN s_status IN ('completed', 'timeout', 'partial', 'skipped') THEN s_end END,
      findings_count = n_found,
      error_message = CASE WHEN s_status IN ('timeout', 'partial') THEN 'The step exceeded its timeout on https://shop.example.org/search (crawl depth 3).'
                           WHEN s_status = 'skipped' THEN NULL END,
      error_code = CASE WHEN s_status IN ('timeout', 'partial') THEN 'STEP_TIMEOUT' END,
      skip_reason = CASE WHEN s_status = 'skipped' THEN 'an earlier step failed' END,
      created_at = base
    WHERE id = st.id;

    IF s_status IN ('completed', 'running', 'partial') THEN
      -- The targets this stage derived from the previous one.
      INSERT INTO scan_run_targets (tenant_id, run_id, stage_key, target_key, asset_id, origin, parent_asset_id, parent_stage_key, relation, hop, decision, reason, created_at)
      SELECT t_id, r.id, rt.stage_key, rt.target_key,
             (SELECT id FROM assets WHERE tenant_id = t_id AND name = rt.asset_name LIMIT 1), 'derived',
             (SELECT id FROM assets WHERE tenant_id = t_id AND name = rt.parent_name LIMIT 1),
             rt.parent_stage, rt.relation, rt.hop, 'planned', 'derived', s_start
      FROM demo.run_targets rt
      WHERE rt.shape = run_shape AND rt.stage_key = (SELECT step_key FROM scan_run_steps WHERE scan_run_id = r.id AND step_order = st.step_order + 1)
      ON CONFLICT DO NOTHING;
    END IF;

    total_f := total_f + n_found;
    IF s_status = 'completed' THEN done_n := done_n + 1; last_end := s_end; END IF;
    IF s_status IN ('timeout', 'failed') THEN fail_n := fail_n + 1; failed := true; last_end := s_end; END IF;
    IF s_status = 'partial' THEN done_n := done_n + 1; fail_n := fail_n + 1; last_end := s_end; END IF;
    IF s_status = 'skipped' THEN skip_n := skip_n + 1; END IF;
  END LOOP;

  UPDATE scan_run_targets SET created_at = base WHERE run_id = r.id AND origin = 'seed';

  -- Stage plans (what the run map shows per stage).
  INSERT INTO scan_run_stage_plans (tenant_id, run_id, stage_key, stage, tool, tier, chained, inputs, planned, max_hop, planned_at)
  SELECT t_id, r.id, s.step_key, ws.capabilities[1], tool_of ->> ws.capabilities[1],
         CASE WHEN ws.capabilities[1] IN ('discover.subdomains', 'resolve.dns') THEN 0 ELSE 1 END,
         s.step_order > 1, count(t.target_key), count(t.target_key), COALESCE(max(t.hop), 0), COALESCE(min(s.started_at), base)
  FROM scan_run_steps s
  JOIN scan_workflow_steps ws ON ws.id = s.step_id
  LEFT JOIN scan_run_targets t ON t.run_id = r.id AND t.stage_key = s.step_key
  WHERE s.scan_run_id = r.id AND s.status <> 'pending'
  GROUP BY s.step_key, ws.capabilities, s.step_order
  ON CONFLICT (run_id, stage_key) DO UPDATE SET inputs = EXCLUDED.inputs, planned = EXCLUDED.planned,
    max_hop = EXCLUDED.max_hop, tool = EXCLUDED.tool, chained = EXCLUDED.chained, planned_at = EXCLUDED.planned_at;

  -- Task timeline: the events a sensor's claims and results would have written.
  DELETE FROM command_events WHERE run_id = r.id;
  INSERT INTO command_events (tenant_id, command_id, run_id, event, status, sensor_id, code, message, created_at)
  SELECT t_id, c.id, r.id, e.event, e.status, CASE WHEN e.event = 'queued' THEN NULL ELSE sensor END, e.code, e.message, e.at
  FROM scan_run_steps s
  JOIN commands c ON c.id = s.command_id
  CROSS JOIN LATERAL (VALUES
    ('queued', 'pending', NULL::text, NULL::text, s.queued_at),
    ('claimed', 'acknowledged', NULL, NULL, s.started_at - interval '5 seconds'),
    ('started', 'running', NULL, NULL, s.started_at),
    (CASE WHEN s.status IN ('completed', 'partial') THEN 'completed' ELSE 'failed' END,
     CASE WHEN s.status IN ('completed', 'partial') THEN 'completed' ELSE 'failed' END,
     CASE WHEN s.status IN ('timeout', 'partial') THEN 'STEP_TIMEOUT' END,
     CASE WHEN s.status IN ('timeout', 'partial') THEN s.error_message END,
     s.completed_at)
  ) AS e(event, status, code, message, at)
  WHERE s.scan_run_id = r.id AND e.at IS NOT NULL;
  UPDATE scan_runs SET
    status = final_status,
    sensor_id = sensor,
    created_at = base,
    started_at = base + interval '5 seconds',
    completed_at = CASE WHEN final_status = 'running' THEN NULL ELSE last_end + interval '10 seconds' END,
    deadline_at = CASE WHEN final_status = 'running' THEN now() + interval '1 day' ELSE deadline_at END,
    completed_steps = done_n,
    failed_steps = fail_n,
    skipped_steps = skip_n,
    total_findings = total_f,
    error_message = CASE WHEN final_status IN ('failed', 'partial') THEN 'Step "' || fail_step || '" did not finish: it exceeded its timeout.' END
  WHERE id = r.id;
  RETURN r.id::text || ' ' || final_status;
END
$fn$;
