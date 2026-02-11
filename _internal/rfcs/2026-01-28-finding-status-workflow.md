# RFC: Finding Status Workflow Optimization

**Date:** 2026-01-28
**Status:** Draft
**Author:** Claude + Human

---

## 1. Problem Statement

### Current Issues

1. **Backend/Frontend Status Mismatch**
   - Backend: 8 statuses (`open`, `confirmed`, `in_progress`, `resolved`, `false_positive`, `ignored`, `accepted`, `wont_fix`)
   - Frontend: 9 statuses (`new`, `triaged`, `confirmed`, `in_progress`, `resolved`, `verified`, `closed`, `duplicate`, `false_positive`)
   - No clear mapping between them

2. **Actor Not Tracked in Status Changes**
   - `UpdateFindingStatus` handler didn't capture authenticated user
   - Activity shows "unknown user" in UI
   - **Fixed:** Now uses `middleware.GetUserID()`

3. **No Approval Workflow for Sensitive Actions**
   - Anyone can mark as `false_positive` without review
   - `accepted` (risk acceptance) has no expiration
   - No audit trail for who approved

4. **UI Not User-Friendly**
   - Status dropdown doesn't show valid transitions
   - No quick action buttons
   - Activity timeline doesn't show user names properly

---

## 2. Proposed Unified Status Model

### 2.1 Status Definitions (10 Statuses)

```go
// Backend: api/internal/domain/vulnerability/value_objects.go
const (
    // Open States (actionable)
    FindingStatusNew         = "new"          // Scanner just found it
    FindingStatusTriaged     = "triaged"      // Analyst reviewed, needs confirmation
    FindingStatusConfirmed   = "confirmed"    // Verified as real issue
    FindingStatusInProgress  = "in_progress"  // Developer working on fix

    // Resolution States (closed but verifiable)
    FindingStatusResolved    = "resolved"     // Fix applied
    FindingStatusVerified    = "verified"     // QA confirmed fix works

    // Terminal States (final)
    FindingStatusClosed      = "closed"       // Fully resolved, archived
    FindingStatusFalsePositive = "false_positive" // Not a real issue
    FindingStatusAccepted    = "accepted"     // Risk accepted (with expiration)
    FindingStatusDuplicate   = "duplicate"    // Linked to another finding
)
```

### 2.2 Status Categories

```go
type StatusCategory string

const (
    CategoryOpen       StatusCategory = "open"       // Needs action
    CategoryInProgress StatusCategory = "in_progress" // Work underway
    CategoryResolved   StatusCategory = "resolved"   // Fixed, needs verification
    CategoryClosed     StatusCategory = "closed"     // Terminal state
)

var StatusCategories = map[FindingStatus]StatusCategory{
    FindingStatusNew:           CategoryOpen,
    FindingStatusTriaged:       CategoryOpen,
    FindingStatusConfirmed:     CategoryOpen,
    FindingStatusInProgress:    CategoryInProgress,
    FindingStatusResolved:      CategoryResolved,
    FindingStatusVerified:      CategoryResolved,
    FindingStatusClosed:        CategoryClosed,
    FindingStatusFalsePositive: CategoryClosed,
    FindingStatusAccepted:      CategoryClosed,
    FindingStatusDuplicate:     CategoryClosed,
}
```

### 2.3 State Transitions

```
                                    ┌─────────────┐
                                    │    NEW      │ (auto from scanner)
                                    └──────┬──────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                       ┌──────────┐  ┌───────────┐  ┌───────────┐
                       │ TRIAGED  │  │ DUPLICATE │  │FALSE_POS* │
                       └────┬─────┘  └───────────┘  └───────────┘
                            │              ▲              ▲
                            ▼              │              │
                       ┌──────────┐        │              │
                       │CONFIRMED │────────┴──────────────┘
                       └────┬─────┘
                            │
                  ┌─────────┼─────────┬─────────────┐
                  ▼         │         ▼             ▼
           ┌───────────┐    │   ┌──────────┐  ┌──────────┐
           │IN_PROGRESS│    │   │ ACCEPTED*│  │FALSE_POS*│
           └─────┬─────┘    │   └──────────┘  └──────────┘
                 │          │
                 ▼          │
           ┌───────────┐    │
           │ RESOLVED  │◄───┘
           └─────┬─────┘
                 │
                 ▼
           ┌───────────┐
           │ VERIFIED  │
           └─────┬─────┘
                 │
                 ▼
           ┌───────────┐
           │  CLOSED   │
           └───────────┘

    * = Requires approval (see Section 4)

    ───► Reopen: Any closed state can go back to CONFIRMED
```

### 2.4 Transition Rules

```go
var ValidStatusTransitions = map[FindingStatus][]FindingStatus{
    // Open states
    FindingStatusNew: {
        FindingStatusTriaged,
        FindingStatusDuplicate,
        FindingStatusFalsePositive, // requires approval
    },
    FindingStatusTriaged: {
        FindingStatusConfirmed,
        FindingStatusDuplicate,
        FindingStatusFalsePositive, // requires approval
    },
    FindingStatusConfirmed: {
        FindingStatusInProgress,
        FindingStatusResolved,      // direct fix without assignment
        FindingStatusDuplicate,
        FindingStatusFalsePositive, // requires approval
        FindingStatusAccepted,      // requires approval
    },

    // In progress
    FindingStatusInProgress: {
        FindingStatusResolved,
        FindingStatusConfirmed,     // back to backlog
    },

    // Resolution states
    FindingStatusResolved: {
        FindingStatusVerified,
        FindingStatusConfirmed,     // reopen if fix didn't work
    },
    FindingStatusVerified: {
        FindingStatusClosed,
        FindingStatusConfirmed,     // reopen if regression
    },

    // Closed states (can reopen)
    FindingStatusClosed:        {FindingStatusConfirmed},
    FindingStatusFalsePositive: {FindingStatusConfirmed},
    FindingStatusAccepted:      {FindingStatusConfirmed},
    FindingStatusDuplicate:     {FindingStatusConfirmed},
}
```

---

## 3. Database Schema Changes

### 3.1 Update findings table

```sql
-- Add new columns for enhanced workflow
ALTER TABLE findings ADD COLUMN IF NOT EXISTS
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    closed_at TIMESTAMP,
    closed_by UUID REFERENCES users(id),
    duplicate_of UUID REFERENCES findings(id),
    acceptance_expires_at TIMESTAMP;

-- Add index for expiring acceptances
CREATE INDEX idx_findings_acceptance_expires
    ON findings(acceptance_expires_at)
    WHERE status = 'accepted' AND acceptance_expires_at IS NOT NULL;
```

### 3.2 Status approval requests table

```sql
CREATE TABLE finding_status_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    finding_id UUID NOT NULL REFERENCES findings(id),

    -- Request details
    requested_status VARCHAR(50) NOT NULL,
    justification TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Approval details
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_comment TEXT,

    -- For accepted status
    expires_at TIMESTAMP, -- required for 'accepted' status

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (requested_status IN ('false_positive', 'accepted'))
);

CREATE INDEX idx_status_approvals_pending
    ON finding_status_approvals(tenant_id, status)
    WHERE status = 'pending';
```

---

## 4. Approval Workflow

### 4.1 Statuses Requiring Approval

| Status | Approval Required | Approver Role | Expiration |
|--------|-------------------|---------------|------------|
| `false_positive` | Yes | Security Team | Never |
| `accepted` | Yes | Manager/Security Lead | Required (max 1 year) |
| Others | No | - | - |

### 4.2 Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATUS APPROVAL WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Developer                     Approver                   Finding        │
│      │                            │                          │           │
│      │  1. Request FP/Accepted    │                          │           │
│      │────────────────────────────►                          │           │
│      │    {                       │                          │           │
│      │      status: "false_positive",                        │           │
│      │      justification: "Test file",                      │           │
│      │      expires_at: null (FP) / "2026-12-31" (accepted)  │           │
│      │    }                       │                          │           │
│      │                            │                          │           │
│      │                            │  2. Notification         │           │
│      │                            │◄─────────────────────────│           │
│      │                            │  "Approval request"      │           │
│      │                            │                          │           │
│      │                            │  3. Review               │           │
│      │                            │  ┌──────────────────┐    │           │
│      │                            │  │ Request Details  │    │           │
│      │                            │  │ Justification... │    │           │
│      │                            │  │ [Approve][Reject]│    │           │
│      │                            │  └──────────────────┘    │           │
│      │                            │                          │           │
│      │                            │  4a. Approve ───────────►│           │
│      │                            │                          │ Status:   │
│      │  5. Notification           │                          │ FALSE_POS │
│      │◄───────────────────────────│                          │           │
│      │  "Request approved"        │                          │           │
│      │                            │                          │           │
│      │                            │  4b. Reject ────────────►│           │
│      │                            │                          │ Status:   │
│      │  5. Notification           │                          │ unchanged │
│      │◄───────────────────────────│                          │           │
│      │  "Request rejected: ..."   │                          │           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 API Endpoints

```yaml
# Request approval
POST /api/v1/findings/{id}/request-status-change
Request:
  status: "false_positive" | "accepted"
  justification: string (required, min 10 chars)
  expires_at: timestamp (required for "accepted", max 1 year)
Response:
  approval_id: uuid
  status: "pending"

# List pending approvals (for approvers)
GET /api/v1/approvals/pending
Response:
  items:
    - id: uuid
      finding: { id, title, severity, ... }
      requested_status: "false_positive"
      justification: "..."
      requested_by: { id, name, email }
      requested_at: timestamp

# Approve/Reject
POST /api/v1/approvals/{id}/review
Request:
  decision: "approved" | "rejected"
  comment: string (required for rejection)
Response:
  finding: { ... updated finding ... }
```

---

## 5. UI Components

### 5.1 Status Badge (Enhanced)

```tsx
// ui/src/features/findings/components/finding-status-badge.tsx

const FINDING_STATUS_CONFIG: Record<FindingStatus, StatusConfig> = {
  new: {
    label: "New",
    icon: CircleDot,
    color: "blue",
    category: "open",
  },
  triaged: {
    label: "Triaged",
    icon: ListChecks,
    color: "indigo",
    category: "open",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "orange",
    category: "open",
  },
  in_progress: {
    label: "In Progress",
    icon: Loader,
    color: "yellow",
    category: "in_progress",
  },
  resolved: {
    label: "Resolved",
    icon: CheckSquare,
    color: "emerald",
    category: "resolved",
  },
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    color: "green",
    category: "resolved",
  },
  closed: {
    label: "Closed",
    icon: Archive,
    color: "gray",
    category: "closed",
  },
  false_positive: {
    label: "False Positive",
    icon: XCircle,
    color: "slate",
    category: "closed",
    requiresApproval: true,
  },
  accepted: {
    label: "Risk Accepted",
    icon: AlertTriangle,
    color: "amber",
    category: "closed",
    requiresApproval: true,
    showExpiration: true,
  },
  duplicate: {
    label: "Duplicate",
    icon: Copy,
    color: "gray",
    category: "closed",
  },
}
```

### 5.2 Status Change Dialog

```tsx
// ui/src/features/findings/components/status-change-dialog.tsx

interface StatusChangeDialogProps {
  finding: Finding
  onStatusChange: (input: StatusChangeInput) => Promise<void>
}

export function StatusChangeDialog({ finding, onStatusChange }: StatusChangeDialogProps) {
  const availableTransitions = getValidTransitions(finding.status)
  const [selectedStatus, setSelectedStatus] = useState<FindingStatus | null>(null)
  const [justification, setJustification] = useState("")
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  const requiresApproval = selectedStatus &&
    ['false_positive', 'accepted'].includes(selectedStatus)

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Finding Status</DialogTitle>
          <DialogDescription>
            Current status: <StatusBadge status={finding.status} />
          </DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {availableTransitions.slice(0, 3).map(status => (
            <Button
              key={status}
              variant={selectedStatus === status ? "default" : "outline"}
              onClick={() => setSelectedStatus(status)}
            >
              <StatusIcon status={status} className="mr-2" />
              {STATUS_CONFIG[status].label}
            </Button>
          ))}
        </div>

        {/* All Options Dropdown */}
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Select status..." />
          </SelectTrigger>
          <SelectContent>
            {availableTransitions.map(status => (
              <SelectItem key={status} value={status}>
                <div className="flex items-center gap-2">
                  <StatusIcon status={status} />
                  <span>{STATUS_CONFIG[status].label}</span>
                  {STATUS_CONFIG[status].requiresApproval && (
                    <Badge variant="outline" className="ml-2">
                      Requires Approval
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Justification (for approval-required statuses) */}
        {requiresApproval && (
          <div className="space-y-2">
            <Label>Justification (required)</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this status change is appropriate..."
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">
              This will be reviewed by the security team before approval.
            </p>
          </div>
        )}

        {/* Expiration (for accepted status) */}
        {selectedStatus === 'accepted' && (
          <div className="space-y-2">
            <Label>Expiration Date (required)</Label>
            <DatePicker
              value={expiresAt}
              onChange={setExpiresAt}
              minDate={new Date()}
              maxDate={addYears(new Date(), 1)}
            />
            <p className="text-xs text-muted-foreground">
              Risk acceptance expires automatically. Maximum 1 year.
            </p>
          </div>
        )}

        {/* Resolution notes (for resolved/verified) */}
        {selectedStatus && ['resolved', 'verified'].includes(selectedStatus) && (
          <div className="space-y-2">
            <Label>Resolution Notes</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Describe what was done to fix the issue..."
            />
          </div>
        )}

        {/* Duplicate link (for duplicate status) */}
        {selectedStatus === 'duplicate' && (
          <div className="space-y-2">
            <Label>Original Finding</Label>
            <FindingSearch
              onSelect={(finding) => setDuplicateOf(finding.id)}
              exclude={[finding.id]}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {requiresApproval ? "Request Approval" : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.3 Activity Timeline (Enhanced)

```tsx
// ui/src/features/findings/components/activity-timeline.tsx

export function ActivityTimeline({ findingId }: { findingId: string }) {
  const { data: activities } = useFindingActivities(findingId)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Activity</h3>

      <div className="relative pl-6 border-l-2 border-muted space-y-6">
        {activities?.map((activity) => (
          <div key={activity.id} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-background border-2 border-primary" />

            {/* Content */}
            <div className="space-y-1">
              {/* Header: Actor + Time */}
              <div className="flex items-center gap-2 text-sm">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={activity.actor?.avatar_url} />
                  <AvatarFallback>
                    {activity.actor_type === 'system' ? '🤖' :
                     activity.actor?.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {activity.actor?.name ||
                   (activity.actor_type === 'system' ? 'System' :
                    activity.actor_type === 'scanner' ? activity.source :
                    'Unknown User')}
                </span>
                <span className="text-muted-foreground">
                  {formatRelativeTime(activity.created_at)}
                </span>
              </div>

              {/* Activity description */}
              <div className="text-sm">
                <ActivityDescription activity={activity} />
              </div>

              {/* Changes detail */}
              {activity.changes && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <ActivityChanges changes={activity.changes} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityDescription({ activity }: { activity: FindingActivity }) {
  switch (activity.activity_type) {
    case 'status_changed':
      return (
        <span>
          Changed status from{' '}
          <StatusBadge status={activity.changes.old_status} size="sm" /> to{' '}
          <StatusBadge status={activity.changes.new_status} size="sm" />
          {activity.changes.reason && (
            <p className="mt-1 text-muted-foreground italic">
              "{activity.changes.reason}"
            </p>
          )}
        </span>
      )
    case 'assigned':
      return (
        <span>
          Assigned to <strong>{activity.changes.assignee_name}</strong>
        </span>
      )
    case 'comment_added':
      return (
        <span>
          Added a comment
          {activity.changes.preview && (
            <p className="mt-1 text-muted-foreground">
              "{activity.changes.preview}..."
            </p>
          )}
        </span>
      )
    case 'created':
      return <span>Finding discovered by {activity.source}</span>
    default:
      return <span>{activity.activity_type}</span>
  }
}
```

### 5.4 Approval Queue (for Security Team)

```tsx
// ui/src/features/approvals/components/approval-queue.tsx

export function ApprovalQueue() {
  const { data: approvals } = usePendingApprovals()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Pending Approvals</h2>
        <Badge variant="secondary">{approvals?.length || 0} pending</Badge>
      </div>

      <div className="space-y-4">
        {approvals?.map((approval) => (
          <Card key={approval.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">
                    {approval.finding.title}
                  </CardTitle>
                  <CardDescription>
                    Requested by {approval.requested_by.name} •{' '}
                    {formatRelativeTime(approval.requested_at)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={approval.finding.severity} />
                  <StatusBadge status={approval.requested_status} />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {/* Justification */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Justification
                  </Label>
                  <p className="text-sm">{approval.justification}</p>
                </div>

                {/* Expiration (for accepted) */}
                {approval.requested_status === 'accepted' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Expires
                    </Label>
                    <p className="text-sm">
                      {format(approval.expires_at, 'PPP')}
                    </p>
                  </div>
                )}

                {/* Finding details link */}
                <Button variant="link" className="p-0 h-auto" asChild>
                  <Link to={`/findings/${approval.finding.id}`}>
                    View Finding Details →
                  </Link>
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex gap-2">
              <Button
                variant="default"
                onClick={() => handleApprove(approval.id)}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectingId(approval.id)}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </CardFooter>
          </Card>
        ))}

        {approvals?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No pending approvals</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## 6. Implementation Plan

### Phase 1: Fix Actor Tracking (DONE)
- [x] Add `ActorID` to `UpdateFindingStatusInput`
- [x] Get `actorID` from middleware in handler
- [x] Pass to activity recording

### Phase 2: Unify Status Model (DONE)
- [x] Update `value_objects.go` with 10 statuses + categories + transitions
- [x] Update transition rules in `finding.go` (use value_objects.go)
- [x] Add migration `000119_unified_finding_status.up.sql` for new columns
- [x] Update frontend types in `finding.types.ts` to match
- [x] Update API types in `finding-api.types.ts`
- [x] Update status mapping in findings page
- [x] Add requiresApproval() helper function

### Phase 3: Approval Workflow
- [ ] Create `finding_status_approvals` table
- [ ] Add approval domain entity
- [ ] Implement approval service
- [ ] Add API endpoints
- [ ] Add approval queue UI
- [ ] Add approval notification

### Phase 4: UI Enhancements
- [ ] Update status badge with new statuses
- [ ] Implement status change dialog
- [ ] Enhance activity timeline
- [ ] Add bulk status change with approval

### Phase 5: Expiration & Automation
- [ ] Background job for expired acceptances
- [ ] Auto-reopen expired findings
- [ ] Notification before expiration
- [ ] Dashboard for expiring items

---

## 7. Migration Strategy

### 7.1 Status Mapping (Old → New)

```go
var StatusMigration = map[string]string{
    "open":           "new",        // or "triaged" based on has_triage
    "confirmed":      "confirmed",  // no change
    "in_progress":    "in_progress", // no change
    "resolved":       "resolved",   // or "closed" if verified
    "false_positive": "false_positive", // no change
    "ignored":        "accepted",   // migrate to risk accepted
    "accepted":       "accepted",   // no change
    "wont_fix":       "accepted",   // migrate to risk accepted
}
```

### 7.2 Migration Script

```sql
-- Migrate status values
UPDATE findings SET status = 'new' WHERE status = 'open' AND triaged_at IS NULL;
UPDATE findings SET status = 'triaged' WHERE status = 'open' AND triaged_at IS NOT NULL;
UPDATE findings SET status = 'accepted' WHERE status IN ('ignored', 'wont_fix');

-- Set default expiration for existing accepted findings (90 days from now)
UPDATE findings
SET acceptance_expires_at = NOW() + INTERVAL '90 days'
WHERE status = 'accepted' AND acceptance_expires_at IS NULL;
```

---

## 8. Open Questions

1. **Should `verified` be mandatory before `closed`?**
   - Option A: Yes, enforce verification step
   - Option B: No, allow direct close (current behavior)
   - **Recommendation:** Make it configurable per tenant

2. **Who can approve false_positive?**
   - Option A: Security team only
   - Option B: Any team lead
   - **Recommendation:** Role-based, configurable

3. **Maximum acceptance duration?**
   - Option A: 90 days (strict)
   - Option B: 1 year (flexible)
   - **Recommendation:** 1 year max, 90 days default

4. **Auto-reopen behavior?**
   - Option A: Reopen to `confirmed`
   - Option B: Reopen to `new` (re-triage)
   - **Recommendation:** Reopen to `confirmed`

---

## 9. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unknown user in activity | ~30% | 0% |
| Unapproved false positives | 100% | 0% |
| Expired acceptances tracked | 0% | 100% |
| Avg time to triage | Unknown | < 24h |
| Status change audit coverage | Partial | 100% |

---

## 10. References

- Finding domain: `api/internal/domain/vulnerability/finding.go`
- Activity service: `api/internal/app/finding_activity_service.go`
- Status handler: `api/internal/infra/http/handler/vulnerability_handler.go`
- Frontend types: `ui/src/features/findings/types/finding.types.ts`
- Status badge: `ui/src/features/findings/components/finding-status-badge.tsx`
