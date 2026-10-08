-- Run right before capturing screenshots (the seed runs it once at the end).
--
-- No sensor runs in the scratch stack and the notification channel points at a
-- placeholder webhook, so their status drifts: the sensors go offline after a
-- few minutes and the channel records the failed delivery. This puts them back
-- to what a healthy installation shows, and keeps the demo run "running".

UPDATE sensors s SET
  health = 'online', last_seen_at = now() - interval '20 seconds', metrics_updated_at = now(),
  heartbeat_due_at = now() + interval '30 days', last_offline_at = NULL, updated_at = now()
FROM tenants t
WHERE t.slug = 'example-corp' AND s.tenant_id = t.id AND s.name IN ('dc-a-scanner-01', 'edge-easm-01');

UPDATE integrations i SET status = 'connected', status_message = NULL, sync_error = NULL,
  last_sync_at = now() - interval '25 minutes'
FROM tenants t
WHERE t.slug = 'example-corp' AND i.tenant_id = t.id AND i.category = 'notification';

UPDATE scan_runs r SET deadline_at = now() + interval '1 day'
FROM tenants t
WHERE t.slug = 'example-corp' AND r.tenant_id = t.id AND r.status = 'running';
