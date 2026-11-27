-- Rows a few documentation pictures need that no API on a scratch stack writes:
--   - CI: a pull request run blocked by the gate (with its reasons), refused
--     pipelines, a break-glass override, the GitHub App installation and a
--     GitLab group connection (pull request feedback), coverage expectations
--   - Platform console: more administrators (a second super admin makes
--     "Delete now" ask for a second approval), and accounts in other states
--     for the Users page
-- Everything is synthetic: example.* names, documentation addresses.

DO $$
DECLARE
  t_id   uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  owner  uuid := (SELECT id FROM users WHERE email = 'alex@example.com');
  trust  uuid := (SELECT id FROM ci_trust_configs WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'example-corp') ORDER BY created_at LIMIT 1);
  repo   uuid := (SELECT id FROM assets WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'example-corp') AND name = 'github.com/example-corp/payments-api');
  infra  uuid := (SELECT id FROM assets WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'example-corp') AND name = 'github.com/example-corp/infra-terraform');
  webapp uuid := (SELECT id FROM assets WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'example-corp') AND name = 'github.com/example-corp/web-app');
  pipe   uuid;
  run_id uuid := 'd0c5d0c5-0000-4000-8000-000000000001';
  iss    text := 'https://token.actions.githubusercontent.com';
  f_key  uuid;
  f_sql  uuid;
BEGIN
  IF t_id IS NULL OR repo IS NULL THEN RAISE EXCEPTION 'run seed.ts first'; END IF;
  pipe := (SELECT id FROM ci_pipelines WHERE tenant_id = t_id AND repository_asset_id = repo LIMIT 1);
  f_key := (SELECT id FROM findings WHERE tenant_id = t_id AND title LIKE 'AWS Access Key ID%' LIMIT 1);
  f_sql := (SELECT id FROM findings WHERE tenant_id = t_id AND title LIKE 'Tainted SQL string%' LIMIT 1);

  -- A pipeline of the infrastructure repository (secrets and IaC only: SAST is a coverage gap).
  IF infra IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ci_pipelines WHERE tenant_id = t_id AND repository_asset_id = infra) THEN
    INSERT INTO ci_pipelines (id, tenant_id, provider, issuer, external_repo_id, workflow_path, repository_asset_id,
      trust_config_id, repository_name, workflow_name, default_branch, first_run_at, sensor_version, tools,
      median_interval_seconds, last_run_at, last_run_status, runs_count, last_default_run_at, last_default_verdict,
      last_default_verdict_at, created_at, updated_at)
    VALUES (gen_random_uuid(), t_id, 'github', iss, '700100203', '.github/workflows/openctem.yml', infra, trust,
      'example-corp/infra-terraform', 'OpenCTEM code scan', 'main', now() - interval '30 days', 'v0.11.0',
      '[{"name":"checkov","version":"3.2.0"},{"name":"betterleaks","version":"1.1.0"}]', 86400,
      now() - interval '3 hours', 'evaluated', 21, now() - interval '3 hours', 'pass', now() - interval '3 hours',
      now() - interval '30 days', now());
  END IF;

  -- One default-branch run of the infrastructure repository (secrets and IaC
  -- fresh, no code or package scanning: the gap the Coverage tab shows).
  IF infra IS NOT NULL THEN
    DELETE FROM ci_runs WHERE id = 'd0c5d0c5-0000-4000-8000-000000000002';
    INSERT INTO ci_runs (id, tenant_id, trust_config_id, repository_asset_id, provider, issuer, repository, ref, branch,
      commit_sha, pull_request, default_branch, is_default_branch, event, actor, external_run_id, run_attempt, workflow,
      pipeline_url, status, verdict, verdict_detail, evaluated_at, reports_count, findings_count, created_at, updated_at,
      pipeline_id, sensor_version, tools)
    SELECT 'd0c5d0c5-0000-4000-8000-000000000002', t_id, trust, infra, 'github', iss, 'example-corp/infra-terraform',
      'refs/heads/main', 'main', substr(md5('infra-terraform'), 1, 40), '', 'main', true, 'push', 'casey-placeholder',
      '9100004001', '1', 'OpenCTEM code scan', 'https://github.com/example-corp/infra-terraform/actions/runs/9100004001',
      'evaluated', 'pass', '{"reasons":[]}'::jsonb, now() - interval '3 hours', 2, 3, now() - interval '3 hours 5 minutes',
      now() - interval '3 hours', p.id, 'v0.11.0', p.tools
    FROM ci_pipelines p WHERE p.tenant_id = t_id AND p.repository_asset_id = infra;
  END IF;
  -- The trust has let jobs in (the last one 40 minutes ago).
  UPDATE ci_trust_configs SET last_used_at = now() - interval '40 minutes' WHERE id = trust;

  -- The blocked pull request run of payments-api.
  DELETE FROM ci_runs WHERE id = run_id;
  INSERT INTO ci_runs (id, tenant_id, trust_config_id, repository_asset_id, provider, issuer, repository, ref, branch,
    base_ref, commit_sha, pull_request, default_branch, is_default_branch, event, actor, external_run_id, run_attempt,
    workflow, pipeline_url, fork, status, verdict, verdict_detail, evaluated_at, reports_count, findings_count,
    created_at, updated_at, pipeline_id, sensor_version, tools)
  VALUES (run_id, t_id, trust, repo, 'github', iss, 'example-corp/payments-api', 'refs/pull/118/merge',
    'feature/refund-flow', 'main', '96fcf1efb95d61b5cd191c8be0b459cecd6c572f', '118', 'main', false, 'pull_request',
    'sam-sample', '9100004217', '1', 'OpenCTEM code scan',
    'https://github.com/example-corp/payments-api/actions/runs/9100004217', false, 'evaluated', 'fail',
    jsonb_build_object('verdict', 'fail', 'would_fail', true,
      'reasons', jsonb_build_array(
        jsonb_build_object('code', 'secret', 'message', 'a secret is committed to the repository', 'finding_id', f_key,
          'fingerprint', 'demo-fp-secret', 'title', 'AWS Access Key ID', 'severity', 'critical',
          'rule_id', 'aws-access-token', 'file', 'config/refunds.env', 'line', 3),
        jsonb_build_object('code', 'severity', 'message', 'severity high is at or above high', 'finding_id', f_sql,
          'fingerprint', 'demo-fp-sqli', 'title', 'Tainted SQL string', 'severity', 'high',
          'rule_id', 'go.lang.security.audit.database.string-formatted-query', 'file', 'internal/refunds/store.go', 'line', 118)),
      'summary', jsonb_build_object('evaluated', 5, 'new', 2, 'pre_existing', 3, 'accepted', 0, 'blocking', 2),
      'policy', jsonb_build_object('source', 'tenant', 'mode', 'enforce', 'fail_on_severity', 'high',
        'new_findings_only', true, 'fail_on_kev', true),
      'baseline', jsonb_build_object('branch', 'main', 'known', true)),
    now() - interval '40 minutes', 3, 5, now() - interval '46 minutes', now() - interval '40 minutes', pipe, 'v0.11.0',
    '[{"name":"semgrep","version":"1.85.0"},{"name":"trivy","version":"0.56.2"},{"name":"betterleaks","version":"1.1.0"}]');
  INSERT INTO ci_run_findings (tenant_id, run_id, fingerprint)
  VALUES (t_id, run_id, 'demo-fp-secret'), (t_id, run_id, 'demo-fp-sqli') ON CONFLICT DO NOTHING;
  UPDATE ci_pipelines SET last_run_at = now() - interval '40 minutes', last_run_id = run_id,
    last_pr_verdict = 'fail', last_pr_verdict_at = now() - interval '40 minutes' WHERE id = pipe;

  -- Break-glass override of that commit.
  DELETE FROM ci_gate_overrides WHERE tenant_id = t_id;
  INSERT INTO ci_gate_overrides (id, tenant_id, repository_asset_id, commit_sha, reason, expires_at, created_by)
  VALUES (gen_random_uuid(), t_id, repo, '96fcf1efb95d61b5cd191c8be0b459cecd6c572f',
    'Release blocker reviewed by AppSec, ticket SEC-101', now() + interval '20 hours', owner);

  -- Refused pipelines: a fork, an owner outside the trust, a branch that is not allowed.
  DELETE FROM audit_logs WHERE tenant_id = t_id AND action = 'ci_run.token_refused';
  INSERT INTO audit_logs (tenant_id, action, resource_type, result, severity, resource_name, message, metadata, logged_at)
  SELECT t_id, 'ci_run.token_refused', 'ci_run', 'denied', 'medium', v.repo,
    'CI token from ' || v.repo || ' refused: ' || v.code,
    jsonb_build_object('reasons', jsonb_build_array(v.code), 'provider', 'github', 'ref', v.ref, 'event', v.event,
      'issuer', iss, 'owner', split_part(v.repo, '/', 1), 'environment', '',
      'workflow_definition', '.github/workflows/openctem.yml',
      'configs', jsonb_build_array(jsonb_build_object('id', trust, 'name', 'GitHub Actions (example-corp)', 'code', v.code))),
    now() - v.age
  FROM (VALUES ('example-contractor/payments-api', 'owner_not_allowed', 'refs/heads/main', 'push', interval '2 hours'),
               ('example-corp/web-app', 'event_not_allowed', 'refs/pull/77/merge', 'pull_request_target', interval '1 day'),
               ('example-corp/payments-api', 'ref_not_allowed', 'refs/heads/experiment/fast-refunds', 'push', interval '3 days'))
       AS v(repo, code, ref, event, age);
  DELETE FROM ci_unverified_refusals WHERE tenant_id = t_id;
  INSERT INTO ci_unverified_refusals (tenant_id, issuer, reason, cause, first_seen, last_seen, count)
  VALUES (t_id, 'https://gitlab.example.com', 'no_configuration', '', now() - interval '3 days', now() - interval '5 hours', 14);

  -- Pull request feedback: the GitHub App on example-corp and one GitLab group.
  DELETE FROM scm_app_installations WHERE tenant_id = t_id;
  INSERT INTO scm_app_installations (id, tenant_id, provider, installation_id, account_login, account_id, account_type,
    repository_selection, status, created_by)
  VALUES (gen_random_uuid(), t_id, 'github', 51234567, 'example-corp', 8812345, 'Organization', 'all', 'active', owner);
  DELETE FROM scm_gitlab_connections WHERE tenant_id = t_id;
  INSERT INTO scm_gitlab_connections (id, tenant_id, host, group_path, group_id, token_encrypted, token_user_id,
    token_expires_at, status, created_by)
  VALUES (gen_random_uuid(), t_id, 'gitlab.example.com', 'example-corp/platform', 1234567, 'not-a-real-token', 42,
    current_date + 90, 'active', owner);

  -- Coverage: what each repository must report.
  DELETE FROM ci_coverage_expectations WHERE tenant_id = t_id;
  INSERT INTO ci_coverage_expectations (tenant_id, repository_asset_id, capabilities)
  SELECT t_id, a, c FROM (VALUES (repo, '{sast,sca,secrets}'::text[]), (webapp, '{sast,sca,secrets}'::text[]),
                                 (infra, '{sast,iac,secrets}'::text[])) AS v(a, c) WHERE a IS NOT NULL;
END $$;

-- Platform administrators: a second super admin, an operations admin and a read-only admin.
INSERT INTO admin_users (id, email, name, role, is_active, failed_login_count, created_at, updated_at, is_break_glass, password_change_required)
SELECT gen_random_uuid(), v.email, v.name, v.role, true, 0, now() - v.age, now(), false, false
FROM (VALUES ('morgan.ops@example.com', 'Morgan Sample', 'super_admin', interval '200 days'),
             ('ops@example.com', 'Ops Placeholder', 'ops_admin', interval '120 days'),
             ('auditor@example.com', 'Audit Example', 'readonly', interval '40 days')) AS v(email, name, role, age)
WHERE NOT EXISTS (SELECT 1 FROM admin_users a WHERE a.email = v.email);
UPDATE users SET name = 'Break-glass admin' WHERE email = 'breakglass@example.com';
UPDATE admin_users SET name = 'Break-glass admin' WHERE email = 'breakglass@example.com';

-- Accounts in other states for the console's Users page (no password: they cannot sign in).
INSERT INTO users (id, email, name, status, auth_provider, email_verified, failed_login_attempts, locked_until, created_at, updated_at)
SELECT gen_random_uuid(), v.email, v.name, 'active', 'local', v.verified, v.fails, v.locked, now() - interval '10 days', now()
FROM (VALUES ('pat.pending@example.org', 'Pat Pending', false, 0, NULL::timestamptz),
             ('lee.locked@example.net', 'Lee Lockedout', true, 5, now() + interval '20 minutes')) AS v(email, name, verified, fails, locked)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email);

-- A single sign-on change the platform administrator proposed and the owner
-- has not approved yet (the console's Single sign-on tab and the owner's
-- approvals list show it).
INSERT INTO sso_pending_changes (id, tenant_id, kind, payload, status, requested_by_admin, requested_by_email, created_at, expires_at)
SELECT gen_random_uuid(), t.id, 'idp_create',
       '{"provider":"okta","display_name":"Example Corp (Okta)","client_id":"0oa1exampleclient","client_secret_set":true,"auto_provision":true,"default_role":"member","allowed_domains":["example.net"]}'::jsonb,
       'pending', a.id, a.email, now() - interval '2 hours', now() + interval '5 days'
FROM tenants t, admin_users a
WHERE t.slug = 'example-corp' AND a.email = 'admin@example.com'
  AND NOT EXISTS (SELECT 1 FROM sso_pending_changes p WHERE p.tenant_id = t.id AND p.status = 'pending');

-- A member asked to connect an AI application from a publisher the
-- organization has not approved (AI assistants > Applications).
INSERT INTO mcp_access_requests (id, tenant_id, client_host, client_name, client_id, scopes, requested_by, request_count, status, created_at, updated_at)
SELECT gen_random_uuid(), t.id, 'assistant.example.net', 'Example Assistant', 'https://assistant.example.net/oauth/client.json',
       ARRAY['mcp:findings.read', 'mcp:assets.read'], u.id, 2, 'pending', now() - interval '3 hours', now() - interval '1 hour'
FROM tenants t, users u
WHERE t.slug = 'example-corp' AND u.email = 'sam@example.com'
  AND NOT EXISTS (SELECT 1 FROM mcp_access_requests r WHERE r.tenant_id = t.id AND r.client_host = 'assistant.example.net');
