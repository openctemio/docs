-- History for the trend charts of the demo organization.
--
-- The seed creates everything today; a real organization has months of
-- history. This spreads detection dates over the last two months, gives the
-- resolved findings a plausible time to fix, and writes the daily risk
-- snapshots the dashboard trends read (the risk-snapshot job writes one per
-- day from now on).

DO $$
DECLARE
  t_id uuid := (SELECT id FROM tenants WHERE slug = 'example-corp');
  d    int;
BEGIN
  IF t_id IS NULL THEN RAISE EXCEPTION 'organization example-corp not found'; END IF;

  -- Detection dates: 2 to 25 days ago, stable per finding; the SLA deadline
  -- moves with it. Run once: it shifts from the current dates.
  UPDATE findings f SET
    first_detected_at = f.first_detected_at - s.shift,
    created_at        = f.created_at - s.shift,
    sla_deadline      = f.sla_deadline - s.shift,
    last_seen_at      = now() - interval '2 hours'
  FROM (SELECT id, (2 + (('x' || substr(md5(id::text), 1, 6))::bit(24)::int % 24)) * interval '1 day' AS shift
        FROM findings WHERE tenant_id = t_id) s
  WHERE f.id = s.id AND f.first_detected_at > now() - interval '1 day';

  UPDATE findings SET sla_status = CASE
      WHEN sla_deadline < now() THEN 'overdue'
      WHEN sla_deadline < now() + interval '3 days' THEN 'warning'
      ELSE 'on_track' END
  WHERE tenant_id = t_id AND sla_deadline IS NOT NULL
    AND status IN ('new', 'confirmed', 'in_progress', 'fix_applied');

  -- Resolved findings: fixed 2 to 12 days after detection.
  UPDATE findings f SET
    resolved_at = f.first_detected_at + ((2 + (('x' || substr(md5(f.id::text), 7, 4))::bit(16)::int % 11)) * interval '1 day')
  WHERE f.tenant_id = t_id AND f.status = 'resolved';

  -- Daily risk snapshots for the last 90 days: risk and open P0/P1 going down.
  DELETE FROM risk_snapshots WHERE tenant_id = t_id AND snapshot_date < current_date;
  FOR d IN 1..90 LOOP
    INSERT INTO risk_snapshots (tenant_id, snapshot_date, risk_score_avg, risk_score_max, findings_open,
      findings_closed_today, exposures_active, sla_compliance_pct, mttr_critical_hours, mttr_high_hours,
      mttr_medium_hours, mttr_low_hours, p0_open, p1_open, p2_open, p3_open, asset_ownership_pct)
    VALUES (t_id, current_date - d,
      round((78 + d * 0.16 + 3 * sin(d / 4.0))::numeric, 2),
      round(least(100, 92 + d * 0.06)::numeric, 2),
      44 + d / 3 + (d % 5),
      (d * 7) % 4,
      9 + d / 12,
      round(greatest(70, 96 - d * 0.22 + 2 * cos(d / 3.0))::numeric, 2),
      round((96 + d * 1.1)::numeric, 2),
      round((210 + d * 2.3)::numeric, 2),
      round((520 + d * 3.0)::numeric, 2),
      round((900 + d * 4.0)::numeric, 2),
      5 + d / 18,
      6 + d / 15,
      14 + d / 10,
      18 + d / 9,
      round(least(90, 35 + (90 - d) * 0.5)::numeric, 2))
    ON CONFLICT (tenant_id, snapshot_date) DO NOTHING;
  END LOOP;
END $$;
