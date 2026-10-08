-- CI pipelines and runs of the demo organization.
--
-- A CI run reaches the platform only with an OIDC token signed by the CI
-- provider, which a scratch stack cannot obtain. This writes what two GitHub
-- Actions pipelines would have produced over the last two weeks.

DO $$
DECLARE
  t_id   uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  trust  uuid := (SELECT id FROM ci_trust_configs WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'example-corp') ORDER BY created_at LIMIT 1);
  iss    text := 'https://token.actions.githubusercontent.com';
  tools  jsonb := '[{"name":"semgrep","version":"1.85.0"},{"name":"trivy","version":"0.56.2"},{"name":"betterleaks","version":"1.1.0"}]';
  repo   record;
  p_id   uuid;
  r_id   uuid;
  i      int;
  is_pr  boolean;
  ok     boolean;
  last_r uuid;
BEGIN
  IF t_id IS NULL THEN RAISE EXCEPTION 'organization example-corp not found'; END IF;
  DELETE FROM ci_pipelines WHERE tenant_id = t_id;

  FOR repo IN
    SELECT a.id AS asset_id, a.name AS full_name, x.repo_id, x.n_runs
    FROM assets a
    JOIN (VALUES ('github.com/example-corp/web-app', '700100201', 14),
                 ('github.com/example-corp/payments-api', '700100202', 9)) AS x(name, repo_id, n_runs)
      ON a.name = x.name
    WHERE a.tenant_id = t_id
  LOOP
    p_id := gen_random_uuid();
    INSERT INTO ci_pipelines (id, tenant_id, provider, issuer, external_repo_id, workflow_path, repository_asset_id,
      trust_config_id, repository_name, workflow_name, default_branch, first_run_at, sensor_version, tools,
      median_interval_seconds, created_at, updated_at)
    VALUES (p_id, t_id, 'github', iss, repo.repo_id, '.github/workflows/openctem.yml', repo.asset_id, trust,
      replace(repo.full_name, 'github.com/', ''), 'OpenCTEM code scan', 'main', now() - interval '14 days',
      'v0.11.0', tools, 43200, now() - interval '14 days', now());

    FOR i IN 1..repo.n_runs LOOP
      r_id := gen_random_uuid();
      is_pr := (i % 3 = 0);
      ok := NOT (i = repo.n_runs - 1 OR i = 4);
      INSERT INTO ci_runs (id, tenant_id, trust_config_id, repository_asset_id, provider, issuer, repository, ref, branch,
        commit_sha, pull_request, default_branch, is_default_branch, event, actor, external_run_id, run_attempt, workflow,
        pipeline_url, status, verdict, verdict_detail, evaluated_at, reports_count, findings_count, created_at, updated_at,
        pipeline_id, sensor_version, tools)
      VALUES (r_id, t_id, trust, repo.asset_id, 'github', iss, replace(repo.full_name, 'github.com/', ''),
        CASE WHEN is_pr THEN 'refs/pull/' || (100 + i) || '/merge' ELSE 'refs/heads/main' END,
        CASE WHEN is_pr THEN 'feature/change-' || i ELSE 'main' END,
        substr(md5(repo.full_name || i), 1, 40),
        CASE WHEN is_pr THEN (100 + i)::text ELSE '' END,
        'main', NOT is_pr, CASE WHEN is_pr THEN 'pull_request' ELSE 'push' END,
        (ARRAY['sam-lee', 'casey-kim', 'jordan-patel'])[1 + i % 3],
        (9100000000 + i * 37)::text, '1', 'OpenCTEM code scan',
        'https://github.com/' || replace(repo.full_name, 'github.com/', '') || '/actions/runs/' || (9100000000 + i * 37),
        'evaluated', CASE WHEN ok THEN 'pass' ELSE 'fail' END,
        CASE WHEN ok THEN '{"reasons":[]}'::jsonb ELSE '{"reasons":[{"rule":"fail_on_severity","severity":"high","count":2}]}'::jsonb END,
        now() - ((repo.n_runs - i) * interval '1 day') + interval '6 minutes',
        3, CASE WHEN ok THEN 4 + i % 3 ELSE 9 END,
        now() - ((repo.n_runs - i) * interval '1 day'),
        now() - ((repo.n_runs - i) * interval '1 day') + interval '6 minutes',
        p_id, 'v0.11.0', tools);
      last_r := r_id;
    END LOOP;

    UPDATE ci_pipelines SET
      last_run_at = now() - interval '1 day' + interval '6 minutes', last_run_id = last_r, last_run_status = 'evaluated',
      runs_count = repo.n_runs,
      last_default_run_at = now() - interval '1 day', last_default_verdict = 'pass', last_default_verdict_at = now() - interval '1 day',
      last_pr_verdict = 'fail', last_pr_verdict_at = now() - interval '2 days', last_scan_failures = 0
    WHERE id = p_id;
  END LOOP;
END $$;
