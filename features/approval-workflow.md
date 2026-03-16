---
layout: default
title: Approval Workflow
parent: Features
nav_order: 16
---

# Approval Workflow

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03-04

## Overview

The Approval Workflow enforces governed status transitions for security findings. When a user wants to mark a finding as `false_positive` or `accepted` (risk accepted), the change does not take effect immediately. Instead, an approval request is created and must be reviewed by a different team member before the status is applied.

This ensures accountability, prevents unilateral risk decisions, and maintains a complete audit trail for compliance.

## Problem Statement

Without an approval workflow:

1. **Unilateral risk decisions** -- Any user can mark findings as false positive or accepted without oversight
2. **No accountability** -- Status changes happen silently, with no record of who approved them or why
3. **Compliance gaps** -- Auditors cannot verify that risk acceptance decisions were properly reviewed
4. **Stale risk acceptance** -- Accepted risks linger indefinitely without re-evaluation
5. **Concurrent conflicts** -- Two users may simultaneously modify the same finding, causing data loss

## Solution Architecture

```
                         +-----------+
                         |   User    |
                         | Requests  |
                         | Status    |
                         | Change    |
                         +-----+-----+
                               |
                    Is status protected?
                   (false_positive / accepted)
                               |
                  +------------+-------------+
                  |  YES                     |  NO
                  v                          v
         +----------------+         +----------------+
         | Create Approval|         | Apply Status   |
         | Request        |         | Immediately    |
         | (status=       |         +----------------+
         |  pending)      |
         +-------+--------+
                 |
    +------------+------------+------------+
    |            |            |            |
    v            v            v            v
+--------+ +--------+ +----------+ +----------+
|Approve | |Reject  | | Cancel   | | Expire   |
|(by     | |(by     | | (by      | | (auto,   |
| other  | | other  | | requester| | deadline)|
| user)  | | user)  | |          | |          |
+---+----+ +---+----+ +----+-----+ +----+-----+
    |          |            |            |
    v          v            v            v
 Status     Finding      Request     Request
 Applied    Stays As     Marked      Marked
 to         Current      Cancelled   Expired
 Finding    Status
```

## Key Concepts

### Protected Statuses

Only two finding statuses require approval before they can be applied:

| Status | Description | Why Protected |
|--------|-------------|---------------|
| `false_positive` | Finding is not a real security issue | Prevents premature dismissal of valid findings |
| `accepted` | Risk is acknowledged and accepted | Ensures risk acceptance is a deliberate, reviewed decision |

All other status transitions (new, confirmed, in_progress, resolved, duplicate) are applied immediately without approval.

### Self-Approval Prevention

A user cannot approve their own request. The approver must be a different user than the requester. This is enforced at the API level -- attempting to approve your own request returns a `403 Forbidden` error.

### Approval Expiry

When requesting the `accepted` (risk accepted) status, the requester can optionally set an `expires_at` date. This creates a time-bound risk acceptance that must be re-evaluated when it expires. This is critical for:

- Regulatory compliance (risk acceptance reviews)
- Preventing indefinite risk accumulation
- Forcing periodic re-assessment of accepted vulnerabilities

### Optimistic Locking

The approval system uses optimistic locking to prevent concurrent modification conflicts. When approving a request, the system verifies:

1. The approval is still in `pending` status
2. The finding has not been modified by another user since the request was created
3. The finding still exists and belongs to the same tenant

If any of these checks fail, the operation is rejected with an appropriate error message.

### Audit Trail

Every approval action creates an activity record on the finding:

| Action | Activity Type | Details |
|--------|---------------|---------|
| Request created | `approval_requested` | Requested status, justification, expiry |
| Approved | `approval_approved` | Who approved, when |
| Rejected | `approval_rejected` | Who rejected, reason |
| Canceled | `approval_canceled` | Who canceled |

These activities are immutable and provide a complete audit trail for compliance reviews.

## How It Works

1. **User initiates status change** -- In the UI, the user selects a protected status (false_positive or accepted) from the status dropdown.

2. **Approval dialog opens** -- Instead of changing the status directly, a dialog prompts the user for:
   - A justification explaining why the status change is needed (required, max 2000 chars)
   - An optional expiry date (only for risk accepted status)

3. **Approval request is created** -- The API creates a new approval record with `status=pending`. The finding status remains unchanged.

4. **Notification is sent** -- Team members with approval permissions are notified of the pending request.

5. **Reviewer acts on the request** -- A different team member can:
   - **Approve**: The finding status is updated to the requested status. An activity record is created.
   - **Reject**: The request is marked as rejected with a reason. The finding status remains unchanged.
   - **Cancel** (requester only): The requester can withdraw their own request before it is acted upon.

6. **Finding status is updated** -- Only upon approval does the finding status actually change. The approval record is updated with the approver's ID and timestamp.

## API Reference

### Request Approval

Create a new approval request for a finding status change.

```bash
curl -X POST /api/v1/findings/{finding_id}/approvals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requested_status": "false_positive",
    "justification": "Code path is unreachable in production. Verified with team lead.",
    "expires_at": "2026-06-01T00:00:00Z"
  }'
```

**Response** (201 Created):
```json
{
  "id": "apr-abc123",
  "tenant_id": "tnt-xyz789",
  "finding_id": "fnd-def456",
  "requested_status": "false_positive",
  "requested_by": "usr-001",
  "justification": "Code path is unreachable in production. Verified with team lead.",
  "status": "pending",
  "expires_at": "2026-06-01T00:00:00Z",
  "created_at": "2026-03-04T10:00:00Z"
}
```

### List Finding Approvals

Get all approval requests for a specific finding.

```bash
curl -X GET /api/v1/findings/{finding_id}/approvals \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
[
  {
    "id": "apr-abc123",
    "finding_id": "fnd-def456",
    "requested_status": "false_positive",
    "requested_by": "usr-001",
    "justification": "Code path is unreachable in production.",
    "status": "approved",
    "approved_by": "usr-002",
    "approved_at": "2026-03-04T11:00:00Z",
    "created_at": "2026-03-04T10:00:00Z"
  }
]
```

### List All Pending Approvals

Get paginated list of all approval requests for the current tenant.

```bash
curl -X GET "/api/v1/approvals?page=1&per_page=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

### Approve Request

Approve a pending approval request. Must be a different user than the requester.

```bash
curl -X POST /api/v1/approvals/{approval_id}/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response** (200 OK):
```json
{
  "id": "apr-abc123",
  "status": "approved",
  "approved_by": "usr-002",
  "approved_at": "2026-03-04T11:00:00Z"
}
```

### Reject Request

Reject a pending approval request with a reason.

```bash
curl -X POST /api/v1/approvals/{approval_id}/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Insufficient evidence. Please provide production traffic logs."
  }'
```

**Response** (200 OK):
```json
{
  "id": "apr-abc123",
  "status": "rejected",
  "rejected_by": "usr-002",
  "rejected_at": "2026-03-04T11:00:00Z",
  "rejection_reason": "Insufficient evidence. Please provide production traffic logs."
}
```

### Cancel Request

Cancel your own pending approval request.

```bash
curl -X POST /api/v1/approvals/{approval_id}/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response** (200 OK):
```json
{
  "id": "apr-abc123",
  "status": "canceled"
}
```

## Security Controls

| Control | Description |
|---------|-------------|
| **Tenant isolation** | All approval queries are scoped to the current tenant via JWT token |
| **Dedicated permission** | Approve/reject requires `findings:approve` permission (Owner/Admin only). Members can request but not approve |
| **Self-approval prevention** | API rejects attempts to approve your own request (403) |
| **Status validation** | Only `pending` approvals can be approved, rejected, or canceled |
| **Requester-only cancel** | Only the original requester can cancel their own request |
| **Immutable audit trail** | Activity records cannot be modified or deleted |
| **Input validation** | Justification max 2000 chars, reason required for rejection |
| **Optimistic locking** | Concurrent modification detection prevents data conflicts |
| **Frontend permission gates** | Approve/Reject buttons hidden for users without `findings:approve` permission |

## Frontend Integration

### Approval Request Dialog

When a user selects a protected status (false_positive or accepted) in the finding detail view or findings list, an `ApprovalDialog` component opens instead of changing the status directly. The dialog collects:

- Justification text (required)
- Expiry date (optional, for risk accepted only)
- Two-step flow: input then confirm

### Approvals Queue Page

Located at `/findings/approvals`, this page provides a centralized view of all approval requests with:

- Table of all approvals with status, finding link, requested status, justification, dates
- Actions dropdown for pending approvals (approve, reject, cancel)
- Approve confirmation dialog
- Reject dialog with reason textarea
- Cancel confirmation dialog
- Pagination for large volumes
- Auto-refresh every 30 seconds

### Approval History in Finding Detail

The finding detail drawer shows a collapsible approval history section when:

- The finding has existing approval records
- The finding is in a status that requires approval (false_positive, accepted)

Each entry shows the approval status badge, requested status, justification, and date.

## Notifications

The following notification events are triggered by approval actions:

| Event | When | Recipients |
|-------|------|------------|
| `approval.requested` | New approval request created | Team members with approval permissions |
| `approval.approved` | Request is approved | Original requester |
| `approval.rejected` | Request is rejected | Original requester |

These events integrate with the existing notification system (Slack, Teams, Email, etc.) via workflow automation.

## Risk Acceptance Expiration

When an `accepted` finding's approval has an `expires_at` date, the system automatically reopens the finding after the acceptance period ends.

### How It Works

The `ApprovalExpirationController` runs every hour as a background reconciliation loop:

1. **Query**: Finds all approvals with `status='approved'`, `expires_at IS NOT NULL`, and `expires_at < NOW()`
2. **Mark expired**: Sets the approval status to `expired` (with optimistic locking to handle concurrency)
3. **Reopen finding**: Transitions the finding from `accepted` back to `confirmed` via `UpdateStatusBatch`
4. **Log**: Records the auto-reopen action for audit trail

### Approval Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting review |
| `approved` | Status change applied |
| `rejected` | Request denied with reason |
| `canceled` | Withdrawn by requester |
| `expired` | Approved acceptance period has ended, finding auto-reopened |

### Configuration

The controller is registered in the background worker manager with:
- **Interval**: 1 hour (configurable)
- **Batch size**: 100 per cycle (prevents long-running transactions)
- **Idempotent**: Safe to run multiple times; optimistic locking prevents double-processing

## Related Documentation

- [Finding Lifecycle](finding-lifecycle.md) -- Branch-aware auto-resolve and status transitions
- [Finding Types & Fingerprinting](finding-types.md) -- How findings are deduplicated and typed
- [Workflow Automation](workflows.md) -- Event-driven automation for notifications
