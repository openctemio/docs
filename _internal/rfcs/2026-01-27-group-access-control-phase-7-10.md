# Group Access Control: Phase 7-10 Implementation Plan

**Status:** Planning
**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Prerequisites:** Phases 1-6 (Complete)

---

## Overview

This document details the implementation plan for the remaining phases of Group Access Control:

| Phase | Feature | Estimated Duration |
|-------|---------|-------------------|
| Phase 7 | Auto-Assignment Rules | 1-2 weeks |
| Phase 8 | Notifications | 1-2 weeks |
| Phase 9 | External Sync (GitHub/GitLab/Azure AD) | 2-3 weeks |
| Phase 10 | Permission Set Updates | 1 week |

**Total Estimated Duration:** 5-8 weeks

---

## Phase 7: Auto-Assignment Rules

### Goal
Automatically assign findings to the appropriate group based on configurable rules.

### Database Schema

```sql
-- Migration: 000088_assignment_rules.up.sql

CREATE TABLE assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0,  -- Higher = checked first
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Matching conditions (JSONB for flexibility)
    conditions JSONB NOT NULL DEFAULT '{}',
    -- Structure:
    -- {
    --   "asset_type": ["repository", "domain"],
    --   "asset_tags": ["team:api", "env:prod"],
    --   "asset_name_pattern": "api-*",
    --   "finding_source": ["semgrep", "trivy"],
    --   "finding_severity": ["critical", "high"],
    --   "finding_type": ["sast", "sca"],
    --   "file_path_pattern": "src/api/**"
    -- }

    -- Target
    target_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

    -- Options
    options JSONB NOT NULL DEFAULT '{}',
    -- Structure:
    -- {
    --   "notify_group": true,
    --   "set_finding_priority": "high"
    -- }

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT unique_rule_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX idx_assignment_rules_tenant ON assignment_rules(tenant_id);
CREATE INDEX idx_assignment_rules_active ON assignment_rules(tenant_id, is_active, priority DESC);
CREATE INDEX idx_assignment_rules_target_group ON assignment_rules(target_group_id);
```

### Domain Entity

```go
// api/internal/domain/assignmentrule/entity.go

package assignmentrule

type AssignmentRule struct {
    ID          string
    TenantID    string
    Name        string
    Description string
    Priority    int
    IsActive    bool
    Conditions  RuleConditions
    TargetGroupID string
    Options     RuleOptions
    CreatedAt   time.Time
    UpdatedAt   time.Time
    CreatedBy   *string
}

type RuleConditions struct {
    AssetTypes       []string `json:"asset_type,omitempty"`
    AssetTags        []string `json:"asset_tags,omitempty"`
    AssetNamePattern string   `json:"asset_name_pattern,omitempty"`
    FindingSources   []string `json:"finding_source,omitempty"`
    FindingSeverity  []string `json:"finding_severity,omitempty"`
    FindingTypes     []string `json:"finding_type,omitempty"`
    FilePathPattern  string   `json:"file_path_pattern,omitempty"`
}

type RuleOptions struct {
    NotifyGroup        bool    `json:"notify_group"`
    SetFindingPriority *string `json:"set_finding_priority,omitempty"`
}
```

### Rule Evaluation Engine

```go
// api/internal/app/assignment_rule_service.go

type AssignmentRuleService struct {
    repo    AssignmentRuleRepository
    groupRepo GroupRepository
    findingRepo FindingRepository
}

// EvaluateRules finds the first matching rule for a finding
func (s *AssignmentRuleService) EvaluateRules(ctx context.Context, finding *Finding, asset *Asset) (*AssignmentRule, error) {
    rules, err := s.repo.ListActiveByTenant(ctx, finding.TenantID)
    if err != nil {
        return nil, err
    }

    // Rules are sorted by priority DESC
    for _, rule := range rules {
        if s.matchesRule(rule, finding, asset) {
            return rule, nil
        }
    }

    return nil, nil // No match
}

func (s *AssignmentRuleService) matchesRule(rule *AssignmentRule, finding *Finding, asset *Asset) bool {
    c := rule.Conditions

    // Asset type check
    if len(c.AssetTypes) > 0 && !contains(c.AssetTypes, asset.Type) {
        return false
    }

    // Asset tags check (all specified tags must be present)
    if len(c.AssetTags) > 0 {
        for _, tag := range c.AssetTags {
            if !asset.HasTag(tag) {
                return false
            }
        }
    }

    // Asset name pattern check
    if c.AssetNamePattern != "" {
        matched, _ := filepath.Match(c.AssetNamePattern, asset.Name)
        if !matched {
            return false
        }
    }

    // Finding source check
    if len(c.FindingSources) > 0 && !contains(c.FindingSources, finding.Source) {
        return false
    }

    // Finding severity check
    if len(c.FindingSeverity) > 0 && !contains(c.FindingSeverity, finding.Severity) {
        return false
    }

    // Finding type check
    if len(c.FindingTypes) > 0 && !contains(c.FindingTypes, finding.Type) {
        return false
    }

    // File path pattern check
    if c.FilePathPattern != "" && finding.FilePath != "" {
        matched, _ := doublestar.Match(c.FilePathPattern, finding.FilePath)
        if !matched {
            return false
        }
    }

    return true
}
```

### Integration with Finding Creation

```go
// In finding_service.go - CreateFinding method

func (s *FindingService) CreateFinding(ctx context.Context, input CreateFindingInput) (*Finding, error) {
    // ... existing creation logic ...

    // After finding is created, evaluate assignment rules
    if input.AutoAssign {
        rule, err := s.assignmentRuleSvc.EvaluateRules(ctx, finding, asset)
        if err != nil {
            // Log error but don't fail the creation
            slog.Warn("failed to evaluate assignment rules", "error", err)
        } else if rule != nil {
            // Assign to group
            err = s.AssignToGroup(ctx, finding.ID, rule.TargetGroupID)
            if err != nil {
                slog.Warn("failed to assign finding to group", "error", err)
            }

            // Trigger notification if configured
            if rule.Options.NotifyGroup {
                s.notificationSvc.NotifyFindingAssigned(ctx, finding, rule.TargetGroupID)
            }
        }
    }

    return finding, nil
}
```

### API Endpoints

```yaml
# Assignment Rules API
GET    /api/v1/assignment-rules           # List rules (paginated)
POST   /api/v1/assignment-rules           # Create rule
GET    /api/v1/assignment-rules/{id}      # Get rule
PUT    /api/v1/assignment-rules/{id}      # Update rule
DELETE /api/v1/assignment-rules/{id}      # Delete rule
POST   /api/v1/assignment-rules/test      # Test rules against sample finding
POST   /api/v1/assignment-rules/reorder   # Reorder priorities
```

### UI Components

```
ui/src/features/assignment-rules/
├── components/
│   ├── rule-list.tsx              # Rules table with drag-to-reorder
│   ├── rule-form.tsx              # Create/edit rule form
│   ├── rule-conditions-builder.tsx # Visual conditions builder
│   └── rule-test-modal.tsx        # Test rule against sample finding
├── hooks/
│   └── use-assignment-rules.ts    # SWR hooks for rules API
└── pages/
    └── assignment-rules-page.tsx   # Main page
```

### Deliverables Checklist

- [ ] Database migration for `assignment_rules` table
- [ ] Domain entity: `assignmentrule`
- [ ] Repository: `assignment_rule_repository.go`
- [ ] Service: `assignment_rule_service.go` with evaluation engine
- [ ] Handler: `assignment_rule_handler.go` with CRUD + test endpoint
- [ ] Routes: Register in `routes/access-control.go`
- [ ] Integration: Hook into `finding_service.CreateFinding`
- [ ] UI: Rules management page
- [ ] UI: Conditions builder component
- [ ] UI: Rule testing modal
- [ ] Tests: Unit tests for rule evaluation
- [ ] Tests: Integration tests for API

---

## Phase 8: Notifications

### Goal
Alert users when findings are assigned to their group.

### Database Schema

```sql
-- Migration: 000089_group_notification_configs.up.sql

CREATE TABLE group_notification_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

    -- Slack channel
    slack_enabled BOOLEAN NOT NULL DEFAULT false,
    slack_channel VARCHAR(255),
    slack_mention_on_critical BOOLEAN NOT NULL DEFAULT true,

    -- Email notifications
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    email_recipients TEXT[],  -- Array of email addresses
    email_digest_frequency VARCHAR(50) DEFAULT 'daily',  -- realtime, daily, weekly

    -- Webhook
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT,
    webhook_secret TEXT,

    -- What to notify
    notify_on_new_critical BOOLEAN NOT NULL DEFAULT true,
    notify_on_new_high BOOLEAN NOT NULL DEFAULT true,
    notify_on_new_medium BOOLEAN NOT NULL DEFAULT false,
    notify_on_sla_warning BOOLEAN NOT NULL DEFAULT true,
    notify_on_sla_breach BOOLEAN NOT NULL DEFAULT true,
    notify_weekly_digest BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_config_per_group UNIQUE (group_id)
);

-- Notification queue for async processing
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,  -- new_finding, sla_warning, sla_breach, weekly_digest
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, sent, failed
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_pending ON notification_queue(status, scheduled_at)
    WHERE status = 'pending';
CREATE INDEX idx_notification_queue_group ON notification_queue(group_id);
```

### Notification Service

```go
// api/internal/app/notification_service.go

type NotificationService struct {
    configRepo NotificationConfigRepository
    queueRepo  NotificationQueueRepository
    slackClient *slack.Client
    emailClient *email.Client
}

// NotifyFindingAssigned queues notification for assigned finding
func (s *NotificationService) NotifyFindingAssigned(ctx context.Context, finding *Finding, groupID string) error {
    config, err := s.configRepo.GetByGroupID(ctx, groupID)
    if err != nil || config == nil {
        return nil // No config = no notification
    }

    // Check if we should notify for this severity
    if !s.shouldNotify(config, finding.Severity) {
        return nil
    }

    // Queue notification
    return s.queueRepo.Create(ctx, &NotificationQueue{
        TenantID:        finding.TenantID,
        GroupID:         groupID,
        NotificationType: "new_finding",
        Payload: map[string]any{
            "finding_id":   finding.ID,
            "finding_title": finding.Title,
            "severity":      finding.Severity,
            "asset_name":    finding.AssetName,
        },
        Status:      "pending",
        ScheduledAt: time.Now(),
    })
}

// ProcessQueue processes pending notifications (called by worker)
func (s *NotificationService) ProcessQueue(ctx context.Context) error {
    notifications, err := s.queueRepo.GetPending(ctx, 100)
    if err != nil {
        return err
    }

    for _, n := range notifications {
        if err := s.processNotification(ctx, n); err != nil {
            n.RetryCount++
            if n.RetryCount >= n.MaxRetries {
                n.Status = "failed"
                n.ErrorMessage = err.Error()
            }
            s.queueRepo.Update(ctx, n)
        } else {
            n.Status = "sent"
            n.ProcessedAt = ptr(time.Now())
            s.queueRepo.Update(ctx, n)
        }
    }

    return nil
}

func (s *NotificationService) processNotification(ctx context.Context, n *NotificationQueue) error {
    config, err := s.configRepo.GetByGroupID(ctx, n.GroupID)
    if err != nil {
        return err
    }

    var errs []error

    // Send to Slack
    if config.SlackEnabled && config.SlackChannel != "" {
        if err := s.sendSlackNotification(ctx, config, n); err != nil {
            errs = append(errs, fmt.Errorf("slack: %w", err))
        }
    }

    // Send email
    if config.EmailEnabled && len(config.EmailRecipients) > 0 {
        if err := s.sendEmailNotification(ctx, config, n); err != nil {
            errs = append(errs, fmt.Errorf("email: %w", err))
        }
    }

    // Send webhook
    if config.WebhookEnabled && config.WebhookURL != "" {
        if err := s.sendWebhookNotification(ctx, config, n); err != nil {
            errs = append(errs, fmt.Errorf("webhook: %w", err))
        }
    }

    return errors.Join(errs...)
}
```

### Weekly Digest Job

```go
// api/internal/app/jobs/weekly_digest_job.go

type WeeklyDigestJob struct {
    notificationSvc *NotificationService
    findingSvc      *FindingService
    groupRepo       GroupRepository
}

func (j *WeeklyDigestJob) Run(ctx context.Context) error {
    // Get all groups with weekly digest enabled
    groups, err := j.groupRepo.ListWithWeeklyDigest(ctx)
    if err != nil {
        return err
    }

    for _, group := range groups {
        // Get findings summary for the week
        summary, err := j.findingSvc.GetWeeklySummary(ctx, group.ID)
        if err != nil {
            slog.Error("failed to get weekly summary", "group_id", group.ID, "error", err)
            continue
        }

        // Queue digest notification
        j.notificationSvc.QueueWeeklyDigest(ctx, group.ID, summary)
    }

    return nil
}
```

### API Endpoints

```yaml
# Group Notification Config API
GET    /api/v1/groups/{id}/notification-config     # Get config
PUT    /api/v1/groups/{id}/notification-config     # Update config
POST   /api/v1/groups/{id}/notification-config/test # Test notification
```

### UI Components

```
ui/src/features/groups/components/
├── notification-settings-form.tsx  # Notification config form
├── notification-channels.tsx       # Channel configuration (Slack, Email, Webhook)
└── notification-test-button.tsx    # Test notification button
```

### Deliverables Checklist

- [ ] Database migration for `group_notification_configs` and `notification_queue`
- [ ] Domain entity: `notificationconfig`
- [ ] Repository: `notification_config_repository.go`
- [ ] Service: `notification_service.go`
- [ ] Worker: `notification_worker.go` for processing queue
- [ ] Job: `weekly_digest_job.go`
- [ ] Handler: Add notification config endpoints to group handler
- [ ] Slack integration: Message formatting
- [ ] Email integration: HTML templates
- [ ] Webhook integration: Payload signing
- [ ] UI: Notification settings in group detail page
- [ ] Tests: Unit tests for notification service
- [ ] Tests: Integration tests for API

---

## Phase 9: External Sync

### Goal
Sync groups and memberships from GitHub Teams, GitLab Groups, and Azure AD.

### Database Schema

```sql
-- Migration: 000090_external_sync.up.sql

CREATE TABLE external_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,  -- github, gitlab, azure_ad, okta
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Connection settings (encrypted)
    connection_config JSONB NOT NULL,
    -- For GitHub:
    -- {
    --   "organization": "my-org",
    --   "token_encrypted": "...",
    --   "team_mappings": [
    --     {"github_team": "backend", .openctem_group": "api-team", "sync_members": true}
    --   ],
    --   "codeowners_sync": true
    -- }

    -- Sync settings
    sync_interval VARCHAR(20) NOT NULL DEFAULT '6h',  -- 1h, 6h, 24h
    remove_stale_members BOOLEAN NOT NULL DEFAULT false,

    -- Status
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50),  -- success, partial, failed
    last_sync_error TEXT,
    next_sync_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_source_per_tenant UNIQUE (tenant_id, source)
);

-- Sync history for audit
CREATE TABLE external_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES external_sync_configs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,  -- running, success, partial, failed

    -- Changes made
    groups_created INTEGER DEFAULT 0,
    groups_updated INTEGER DEFAULT 0,
    groups_deleted INTEGER DEFAULT 0,
    members_added INTEGER DEFAULT 0,
    members_removed INTEGER DEFAULT 0,
    rules_created INTEGER DEFAULT 0,

    error_message TEXT,
    details JSONB  -- Detailed change log
);

CREATE INDEX idx_sync_history_config ON external_sync_history(config_id, started_at DESC);
```

### GitHub Sync Service

```go
// api/internal/app/sync/github_sync_service.go

type GitHubSyncService struct {
    configRepo  ExternalSyncConfigRepository
    historyRepo SyncHistoryRepository
    groupRepo   GroupRepository
    ruleRepo    AssignmentRuleRepository
}

func (s *GitHubSyncService) Sync(ctx context.Context, configID string) error {
    config, err := s.configRepo.Get(ctx, configID)
    if err != nil {
        return err
    }

    // Start history record
    history := &SyncHistory{
        ConfigID:  configID,
        StartedAt: time.Now(),
        Status:    "running",
    }
    s.historyRepo.Create(ctx, history)

    defer func() {
        history.CompletedAt = ptr(time.Now())
        s.historyRepo.Update(ctx, history)
    }()

    // Initialize GitHub client
    client := github.NewClient(oauth2.NewClient(ctx,
        oauth2.StaticTokenSource(&oauth2.Token{AccessToken: config.DecryptedToken()})))

    // Process each team mapping
    for _, mapping := range config.TeamMappings {
        if err := s.syncTeam(ctx, client, config, mapping, history); err != nil {
            history.Status = "partial"
            history.ErrorMessage = err.Error()
        }
    }

    // Sync CODEOWNERS if enabled
    if config.CodeownersSync {
        if err := s.syncCodeowners(ctx, client, config, history); err != nil {
            slog.Warn("CODEOWNERS sync failed", "error", err)
        }
    }

    if history.Status == "running" {
        history.Status = "success"
    }

    // Update config status
    config.LastSyncAt = ptr(time.Now())
    config.LastSyncStatus = history.Status
    config.NextSyncAt = ptr(time.Now().Add(config.SyncIntervalDuration()))
    s.configRepo.Update(ctx, config)

    return nil
}

func (s *GitHubSyncService) syncTeam(ctx context.Context, client *github.Client,
    config *ExternalSyncConfig, mapping TeamMapping, history *SyncHistory) error {

    // Get GitHub team members
    members, _, err := client.Teams.ListTeamMembersBySlug(ctx, config.Organization,
        mapping.GitHubTeam, nil)
    if err != nil {
        return fmt.Errorf("failed to list team members: %w", err)
    }

    // Get or create OpenCTEM group
    group, err := s.groupRepo.GetBySlug(ctx, config.TenantID, mapping.OpenCTEMGroup)
    if err != nil {
        // Create group
        group = &Group{
            TenantID:       config.TenantID,
            Name:           mapping.GitHubTeam,
            Slug:           mapping.OpenCTEMGroup,
            GroupType:      "team",
            ExternalID:     ptr(fmt.Sprintf("github:%s/%s", config.Organization, mapping.GitHubTeam)),
            ExternalSource: ptr("github"),
        }
        if err := s.groupRepo.Create(ctx, group); err != nil {
            return err
        }
        history.GroupsCreated++
    }

    if mapping.SyncMembers {
        if err := s.syncMembers(ctx, config.TenantID, group.ID, members, history); err != nil {
            return err
        }
    }

    return nil
}

func (s *GitHubSyncService) syncCodeowners(ctx context.Context, client *github.Client,
    config *ExternalSyncConfig, history *SyncHistory) error {

    // List repos in organization
    repos, _, err := client.Repositories.ListByOrg(ctx, config.Organization, nil)
    if err != nil {
        return err
    }

    for _, repo := range repos {
        // Try to get CODEOWNERS file
        content, _, _, err := client.Repositories.GetContents(ctx, config.Organization,
            *repo.Name, "CODEOWNERS", nil)
        if err != nil {
            continue // No CODEOWNERS file
        }

        // Parse CODEOWNERS
        rules := s.parseCodeowners(*content.Content)

        // Create assignment rules
        for _, rule := range rules {
            existingRule, _ := s.ruleRepo.GetByName(ctx, config.TenantID, rule.Name)
            if existingRule == nil {
                if err := s.ruleRepo.Create(ctx, rule); err != nil {
                    slog.Warn("failed to create rule from CODEOWNERS", "error", err)
                    continue
                }
                history.RulesCreated++
            }
        }
    }

    return nil
}

func (s *GitHubSyncService) parseCodeowners(content string) []*AssignmentRule {
    var rules []*AssignmentRule

    lines := strings.Split(content, "\n")
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // Parse: /src/api/** @my-org/api-team
        parts := strings.Fields(line)
        if len(parts) < 2 {
            continue
        }

        path := parts[0]
        team := strings.TrimPrefix(parts[1], "@")

        // Convert @org/team to group slug
        teamParts := strings.Split(team, "/")
        groupSlug := teamParts[len(teamParts)-1]

        rules = append(rules, &AssignmentRule{
            Name:        fmt.Sprintf("CODEOWNERS: %s", path),
            Description: fmt.Sprintf("Auto-generated from CODEOWNERS: %s", line),
            Priority:    50,
            IsActive:    true,
            Conditions: RuleConditions{
                FilePathPattern: path,
            },
            // TargetGroupID will be resolved later
            targetGroupSlug: groupSlug,
        })
    }

    return rules
}
```

### API Endpoints

```yaml
# External Sync API
GET    /api/v1/external-sync                  # List sync configs
GET    /api/v1/external-sync/{source}         # Get config by source
PUT    /api/v1/external-sync/{source}         # Create/update config
DELETE /api/v1/external-sync/{source}         # Delete config
POST   /api/v1/external-sync/{source}/sync    # Trigger manual sync
GET    /api/v1/external-sync/{source}/status  # Get sync status
GET    /api/v1/external-sync/{source}/history # Get sync history
```

### UI Components

```
ui/src/features/external-sync/
├── components/
│   ├── sync-config-list.tsx        # List of sync configurations
│   ├── github-sync-form.tsx        # GitHub sync configuration
│   ├── gitlab-sync-form.tsx        # GitLab sync configuration
│   ├── azure-ad-sync-form.tsx      # Azure AD sync configuration
│   ├── team-mapping-editor.tsx     # Map external teams to groups
│   ├── sync-status-badge.tsx       # Status indicator
│   └── sync-history-table.tsx      # Sync history log
├── hooks/
│   └── use-external-sync.ts        # SWR hooks for sync API
└── pages/
    └── external-sync-page.tsx      # Main configuration page
```

### Deliverables Checklist

- [ ] Database migration for `external_sync_configs` and `external_sync_history`
- [ ] Domain entity: `externalsync`
- [ ] Repository: `external_sync_repository.go`
- [ ] Service: `github_sync_service.go`
- [ ] Service: `gitlab_sync_service.go`
- [ ] Service: `azure_ad_sync_service.go`
- [ ] CODEOWNERS parser
- [ ] Encryption for connection tokens
- [ ] Worker: `sync_scheduler.go` for scheduled syncs
- [ ] Handler: `external_sync_handler.go`
- [ ] Routes: Register in `routes/access-control.go`
- [ ] UI: External sync configuration pages
- [ ] UI: Team mapping editor
- [ ] UI: Sync status and history
- [ ] Tests: Unit tests for sync services
- [ ] Tests: Integration tests for API

---

## Phase 10: Permission Set Updates

### Goal
Track changes to system permission sets and notify tenants using cloned sets.

### Database Schema

```sql
-- Migration: 000091_permission_set_versions.up.sql

CREATE TABLE permission_set_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,

    -- Snapshot of permissions at this version
    permissions JSONB NOT NULL,

    -- Change description
    change_summary TEXT,
    changed_by VARCHAR(255),  -- "system" or admin email

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_version UNIQUE (permission_set_id, version)
);

CREATE TABLE permission_set_update_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
    source_version INTEGER NOT NULL,
    target_version INTEGER NOT NULL,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, reviewed, applied, dismissed

    -- Changes
    added_permissions TEXT[],
    removed_permissions TEXT[],

    -- Actions
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    action_taken VARCHAR(50),  -- apply_all, apply_partial, dismiss

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_update_notifications_tenant ON permission_set_update_notifications(tenant_id, status);
```

### Update Detection Service

```go
// api/internal/app/permission_set_update_service.go

type PermissionSetUpdateService struct {
    permSetRepo    PermissionSetRepository
    versionRepo    PermissionSetVersionRepository
    notifyRepo     PermissionSetUpdateNotificationRepository
    notificationSvc *NotificationService
}

// CreateVersion creates a new version when system set is updated
func (s *PermissionSetUpdateService) CreateVersion(ctx context.Context, setID string,
    permissions []string, summary string, changedBy string) error {

    // Get current version
    currentVersion, _ := s.versionRepo.GetLatest(ctx, setID)
    newVersion := 1
    if currentVersion != nil {
        newVersion = currentVersion.Version + 1
    }

    // Create version record
    version := &PermissionSetVersion{
        PermissionSetID: setID,
        Version:         newVersion,
        Permissions:     permissions,
        ChangeSummary:   summary,
        ChangedBy:       changedBy,
    }
    if err := s.versionRepo.Create(ctx, version); err != nil {
        return err
    }

    // Find all tenants with cloned sets from this parent
    clonedSets, err := s.permSetRepo.ListClonedFrom(ctx, setID)
    if err != nil {
        return err
    }

    // Create notifications for each tenant
    for _, clonedSet := range clonedSets {
        added, removed := s.diffPermissions(currentVersion.Permissions, permissions)

        notification := &PermissionSetUpdateNotification{
            TenantID:           clonedSet.TenantID,
            PermissionSetID:    clonedSet.ID,
            SourceVersion:      currentVersion.Version,
            TargetVersion:      newVersion,
            Status:             "pending",
            AddedPermissions:   added,
            RemovedPermissions: removed,
        }
        s.notifyRepo.Create(ctx, notification)

        // Also send email/Slack notification to tenant admins
        s.notificationSvc.NotifyPermissionSetUpdate(ctx, notification)
    }

    return nil
}

// ApplyUpdate applies pending update to a tenant's cloned set
func (s *PermissionSetUpdateService) ApplyUpdate(ctx context.Context, notificationID string,
    userID string, applyAll bool, permissionsToApply []string) error {

    notification, err := s.notifyRepo.Get(ctx, notificationID)
    if err != nil {
        return err
    }

    // Get the target version
    version, err := s.versionRepo.Get(ctx, notification.PermissionSetID, notification.TargetVersion)
    if err != nil {
        return err
    }

    // Update the cloned set
    clonedSet, err := s.permSetRepo.Get(ctx, notification.PermissionSetID)
    if err != nil {
        return err
    }

    if applyAll {
        clonedSet.Permissions = version.Permissions
    } else {
        // Apply only selected permissions
        for _, perm := range permissionsToApply {
            if contains(notification.AddedPermissions, perm) {
                clonedSet.Permissions = append(clonedSet.Permissions, perm)
            }
        }
        for _, perm := range permissionsToApply {
            if contains(notification.RemovedPermissions, perm) {
                clonedSet.Permissions = remove(clonedSet.Permissions, perm)
            }
        }
    }

    if err := s.permSetRepo.Update(ctx, clonedSet); err != nil {
        return err
    }

    // Mark notification as applied
    notification.Status = "applied"
    notification.ReviewedBy = &userID
    notification.ReviewedAt = ptr(time.Now())
    notification.ActionTaken = ifelse(applyAll, "apply_all", "apply_partial")

    return s.notifyRepo.Update(ctx, notification)
}
```

### API Endpoints

```yaml
# Permission Set Update Notifications API
GET    /api/v1/permission-set-updates           # List pending updates
GET    /api/v1/permission-set-updates/{id}      # Get update details
POST   /api/v1/permission-set-updates/{id}/apply # Apply update
POST   /api/v1/permission-set-updates/{id}/dismiss # Dismiss update
```

### UI Components

```
ui/src/features/permission-sets/components/
├── update-notification-banner.tsx   # Banner showing pending updates
├── update-review-modal.tsx          # Modal to review and apply changes
└── permission-diff-viewer.tsx       # Side-by-side permission diff
```

### Deliverables Checklist

- [ ] Database migration for `permission_set_versions` and `permission_set_update_notifications`
- [ ] Domain entity: `permissionsetversion`, `permissionsetupdatenotification`
- [ ] Repository: `permission_set_version_repository.go`
- [ ] Service: `permission_set_update_service.go`
- [ ] Handler: `permission_set_update_handler.go`
- [ ] Routes: Register in `routes/access-control.go`
- [ ] Version tracking on system set updates
- [ ] UI: Update notification banner
- [ ] UI: Review modal with diff viewer
- [ ] Tests: Unit tests for version tracking
- [ ] Tests: Integration tests for API

---

## Dependencies and Order

```
Phase 7 (Auto-Assignment) ──┬──> Phase 8 (Notifications)
                           │
Phase 9 (External Sync) ───┴──> (can run in parallel with Phase 7-8)

Phase 4 (existing) ────────────> Phase 10 (Permission Set Updates)
```

**Recommended Execution Order:**
1. **Week 1-2:** Phase 7 (Auto-Assignment Rules)
2. **Week 3-4:** Phase 8 (Notifications) - depends on Phase 7
3. **Week 3-5:** Phase 9 (External Sync) - can start during Phase 8
4. **Week 6:** Phase 10 (Permission Set Updates) - can start after Phase 4

---

## Testing Strategy

### Unit Tests

```go
// Phase 7
func TestRuleEvaluation_MatchesAssetType(t *testing.T)
func TestRuleEvaluation_MatchesFilePattern(t *testing.T)
func TestRuleEvaluation_PriorityOrdering(t *testing.T)
func TestRuleEvaluation_FirstMatchWins(t *testing.T)

// Phase 8
func TestNotificationService_ShouldNotify(t *testing.T)
func TestNotificationService_QueueProcessing(t *testing.T)
func TestWeeklyDigest_SummaryGeneration(t *testing.T)

// Phase 9
func TestGitHubSync_TeamMemberSync(t *testing.T)
func TestGitHubSync_CodeownersParser(t *testing.T)
func TestGitHubSync_StaleRemoval(t *testing.T)

// Phase 10
func TestVersionTracking_CreateVersion(t *testing.T)
func TestVersionTracking_NotifyClonedSets(t *testing.T)
func TestVersionTracking_ApplyPartial(t *testing.T)
```

### Integration Tests

```go
// Phase 7
func TestAssignmentRulesAPI_CRUD(t *testing.T)
func TestAssignmentRulesAPI_Reorder(t *testing.T)
func TestFindingCreation_AutoAssignment(t *testing.T)

// Phase 8
func TestNotificationConfigAPI_CRUD(t *testing.T)
func TestNotificationAPI_SendTest(t *testing.T)

// Phase 9
func TestExternalSyncAPI_Configure(t *testing.T)
func TestExternalSyncAPI_TriggerSync(t *testing.T)

// Phase 10
func TestPermissionSetUpdatesAPI_ListPending(t *testing.T)
func TestPermissionSetUpdatesAPI_Apply(t *testing.T)
```

---

## Success Criteria

| Phase | Criteria |
|-------|----------|
| Phase 7 | Findings auto-assigned based on rules; Rules UI functional |
| Phase 8 | Notifications sent via Slack/Email/Webhook; Weekly digest working |
| Phase 9 | GitHub teams synced; CODEOWNERS parsed; Members auto-updated |
| Phase 10 | System updates tracked; Tenants notified; Updates can be applied |

---

## Related Documentation

- [Group Access Control RFC](./2026-01-21-group-access-control.md)
- [Access Control Architecture](../architecture/access-control-flows-and-data.md)
- [Workflow Automation](../features/workflows.md) (uses similar notification infrastructure)
