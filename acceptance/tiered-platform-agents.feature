# Tiered Platform Agents - Acceptance Criteria
# Version: 1.0
# Created: 2026-01-26
# Status: Ready for Testing

# =============================================================================
# Feature: Tier-based Job Routing
# =============================================================================

Feature: Tier-based Job Routing
  As a platform tenant
  I want my jobs routed to appropriate tier agents
  So that I get the service level my plan entitles

  Background:
    Given the platform has agents in all tiers:
      | tier      | count | status  | health |
      | premium   | 3     | active  | online |
      | dedicated | 5     | active  | online |
      | shared    | 10    | active  | online |

  # US-001: Business tenant job routing
  Scenario: Business tenant job goes to dedicated queue
    Given a tenant with "business" plan subscription
    And the tenant has the "platform_agents" module enabled
    When they submit a platform job without specifying a tier
    Then the job should be assigned tier_actual = "dedicated"
    And the job queue_priority should include tier bonus of 50

  Scenario: Business tenant explicitly requests dedicated tier
    Given a tenant with "business" plan subscription
    When they submit a platform job with tier_requested = "dedicated"
    Then the job should be assigned tier_actual = "dedicated"
    And no downgrade audit event should be logged

  # US-002: Tier downgrade protection
  Scenario: Free tenant cannot request premium tier
    Given a tenant with "free" plan subscription
    When they submit a platform job with tier_requested = "premium"
    Then the job should be assigned tier_actual = "shared"
    And a tier downgrade audit event should be logged with:
      | requested_tier | actual_tier | reason           |
      | premium        | shared      | plan_restriction |

  Scenario: Team tenant cannot request dedicated tier
    Given a tenant with "team" plan subscription
    When they submit a platform job with tier_requested = "dedicated"
    Then the job should be assigned tier_actual = "shared"
    And a tier downgrade audit event should be logged

  Scenario: Enterprise tenant can request any tier
    Given a tenant with "enterprise" plan subscription
    When they submit a platform job with tier_requested = "premium"
    Then the job should be assigned tier_actual = "premium"
    And no downgrade audit event should be logged

  # Default tier handling
  Scenario: Tenant with no subscription defaults to shared
    Given a tenant without an active subscription
    When they submit a platform job
    Then the job should be assigned tier_actual = "shared"

  Scenario: Empty tier request defaults based on plan max_tier
    Given a tenant with "business" plan subscription
    When they submit a platform job with tier_requested = ""
    Then the job should be assigned tier_actual = "shared"

# =============================================================================
# Feature: Tier-aware Agent Selection
# =============================================================================

Feature: Tier-aware Agent Selection
  As a platform operator
  I want agents to process jobs matching their tier
  So that resource isolation is maintained

  Background:
    Given the following platform agents:
      | name        | tier      | status | health | current_jobs | max_jobs |
      | premium-1   | premium   | active | online | 2            | 5        |
      | dedicated-1 | dedicated | active | online | 3            | 5        |
      | dedicated-2 | dedicated | active | online | 1            | 5        |
      | shared-1    | shared    | active | online | 4            | 5        |
      | shared-2    | shared    | active | online | 2            | 5        |

  Scenario: Premium job selects premium agent
    Given a pending job with tier_actual = "premium"
    When the job dispatcher runs
    Then the job should be assigned to agent "premium-1"

  Scenario: Dedicated job selects dedicated agent with lowest load
    Given a pending job with tier_actual = "dedicated"
    When the job dispatcher runs
    Then the job should be assigned to agent "dedicated-2"
    # dedicated-2 has load 1/5 vs dedicated-1 has load 3/5

  Scenario: Premium agent can process dedicated job when premium queue empty
    Given no pending premium tier jobs
    And a pending job with tier_actual = "dedicated"
    And all dedicated agents are at capacity
    When agent "premium-1" polls for jobs
    Then the job should be assigned to agent "premium-1"

  Scenario: Dedicated agent cannot process premium jobs
    Given a pending job with tier_actual = "premium"
    And agent "dedicated-1" is available
    When agent "dedicated-1" polls for jobs
    Then the agent should receive no job

  Scenario: Shared agent only processes shared jobs
    Given a pending job with tier_actual = "dedicated"
    And agent "shared-1" is available
    When agent "shared-1" polls for jobs
    Then the agent should receive no job

# =============================================================================
# Feature: Queue Priority Calculation
# =============================================================================

Feature: Queue Priority Calculation
  As a platform operator
  I want jobs prioritized by plan, tier, and age
  So that higher-paying customers get better service

  Scenario Outline: Priority calculation formula
    Given a tenant with "<plan>" plan subscription
    And a job queued <age_minutes> minutes ago
    And the job has tier_actual = "<tier>"
    Then the job queue_priority should be <expected_priority>

    Examples:
      | plan       | tier      | age_minutes | expected_priority |
      | free       | shared    | 0           | 25                |
      | free       | shared    | 30          | 55                |
      | team       | shared    | 0           | 50                |
      | business   | dedicated | 0           | 125               |
      | business   | dedicated | 10          | 135               |
      | enterprise | premium   | 0           | 200               |
      | enterprise | premium   | 50          | 250               |
    # Formula: plan_priority + tier_priority + min(age_minutes, 50)
    # Plan: free=25, team=50, business=75, enterprise=100
    # Tier: shared=0, dedicated=50, premium=100

  Scenario: Higher priority job processed first
    Given two pending jobs in the same tier:
      | job | plan       | queued_minutes_ago | expected_priority |
      | A   | free       | 0                  | 25                |
      | B   | business   | 0                  | 125               |
    When an agent polls for jobs
    Then job "B" should be selected before job "A"

  Scenario: Age bonus helps older jobs
    Given two pending jobs:
      | job | plan | tier   | queued_minutes_ago |
      | A   | team | shared | 60                 |
      | B   | team | shared | 5                  |
    When an agent polls for jobs
    Then job "A" should be selected
    # A: 50 + 0 + 50 = 100 (age capped at 50)
    # B: 50 + 0 + 5 = 55

# =============================================================================
# Feature: Rate Limiting by Tier
# =============================================================================

Feature: Rate Limiting by Tier
  As a platform operator
  I want rate limits enforced per tenant per tier
  So that no single tenant can exhaust resources

  Background:
    Given the following tier rate limits:
      | tier      | requests_per_minute |
      | shared    | 50                  |
      | dedicated | 200                 |
      | premium   | 500                 |

  Scenario: Shared tier tenant within rate limit
    Given a tenant with "free" plan
    And they have made 40 requests in the current minute
    When they make another request
    Then the request should be allowed

  Scenario: Shared tier tenant exceeds rate limit
    Given a tenant with "free" plan
    And they have made 50 requests in the current minute
    When they make another request
    Then the request should be rate limited
    And the response should indicate rate limit exceeded

  Scenario: Business tenant has higher rate limit
    Given a tenant with "business" plan
    And they have made 150 requests in the current minute
    When they make another request
    Then the request should be allowed

  Scenario: Rate limit window resets after 1 minute
    Given a tenant hit their rate limit
    And 1 minute has passed
    When they make a new request
    Then the request should be allowed

# =============================================================================
# Feature: Tier Downgrade Audit
# =============================================================================

Feature: Tier Downgrade Audit
  As a security auditor
  I want all tier downgrades logged
  So that I can detect potential abuse

  Scenario: Downgrade audit record created
    Given a tenant with "team" plan
    When they request a "premium" tier job
    Then a tier_downgrade_audit record should be created with:
      | field          | value            |
      | tenant_id      | <tenant_uuid>    |
      | requested_tier | premium          |
      | actual_tier    | shared           |
      | reason         | plan_restriction |
      | plan_slug      | team             |

  Scenario: Command ID linked to audit record
    Given a tier downgrade occurred for a command
    When the command is processed
    Then the audit record should have command_id set

  Scenario: Security monitoring view shows recent downgrades
    Given a tenant had 15 tier downgrades in the last hour
    When querying tier_security_events view
    Then the recent_downgrade_count should be 15

  Scenario: No audit for allowed tier requests
    Given a tenant with "enterprise" plan
    When they request a "premium" tier job
    Then no tier_downgrade_audit record should be created

# =============================================================================
# Feature: Admin Platform Agent Statistics
# =============================================================================

Feature: Admin Platform Agent Statistics
  As a platform administrator
  I want to view tier-specific statistics
  So that I can monitor SLA compliance and resource allocation

  Scenario: Stats endpoint returns tier breakdown
    Given I am authenticated as an admin user
    When I request GET /api/v1/admin/platform-agents/stats
    Then the response should include tier_stats object
    And tier_stats should contain entries for:
      | tier      |
      | shared    |
      | dedicated |
      | premium   |

  Scenario: Tier stats include queue depth
    Given there are 10 pending jobs in the dedicated tier queue
    When I request GET /api/v1/admin/platform-agents/stats
    Then tier_stats["dedicated"].queued_jobs should be 10

  Scenario: Filter agents by tier
    Given I am authenticated as an admin user
    When I request GET /api/v1/admin/platform-agents?tier=premium
    Then the response should only contain premium tier agents

  Scenario: Invalid tier filter is sanitized
    Given I am authenticated as an admin user
    When I request GET /api/v1/admin/platform-agents?tier=invalid
    Then the tier filter should be treated as "shared"

# =============================================================================
# Feature: SLA Compliance Monitoring
# =============================================================================

Feature: SLA Compliance Monitoring
  As a platform operator
  I want to monitor SLA compliance
  So that I can take action before breaches occur

  Background:
    Given the following SLA thresholds:
      | tier      | max_queue_seconds |
      | shared    | 3600              |
      | dedicated | 1800              |
      | premium   | 600               |

  Scenario: Job within SLA
    Given a premium tier job queued 5 minutes ago
    Then the job should not trigger SLA warning

  Scenario: Job approaching SLA threshold
    Given a premium tier job queued 8 minutes ago
    Then the job should trigger SLA warning alert

  Scenario: Job exceeds SLA threshold
    Given a premium tier job queued 15 minutes ago
    Then the job should trigger SLA breach alert

  Scenario: Age bonus increases priority as SLA approaches
    Given a premium tier job queued 9 minutes ago
    When queue priorities are recalculated
    Then the job priority should have increased by 9 points
    # This helps prioritize jobs approaching SLA

# =============================================================================
# Feature: Backward Compatibility
# =============================================================================

Feature: Backward Compatibility
  As a platform operator
  I want existing jobs to continue working
  So that the tier migration is seamless

  Scenario: Existing jobs without tier default to shared
    Given a command created before tier migration
    And the command has tier_requested = NULL
    And the command has tier_actual = NULL
    When the job is processed
    Then it should be treated as tier_actual = "shared"

  Scenario: Existing agents without tier default to shared
    Given an agent registered before tier migration
    And the agent has tier = NULL
    When the agent is loaded
    Then it should be treated as tier = "shared"

  Scenario: API responses include tier even for old data
    Given an agent created before tier migration
    When I request the agent via API
    Then the response should include tier = "shared"
