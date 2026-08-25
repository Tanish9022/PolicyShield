Failure Recovery

Philosophy

External failure does not imply business-action failure.

A timeout, dropped connection, missing webhook or stale cache tells us what the system observed—not necessarily what happened in the external business system.

PolicyShield therefore treats uncertain execution as a first-class state.

Failure taxonomy

Failure

Example

Primary response

LLM failure

malformed output

reject output, retry boundedly or escalate

Tool failure

inventory service unavailable

fail closed for inventory-sensitive action

Stale context

price older than freshness limit

re-fetch before execution

Network timeout

request times out

enter EXECUTION_UNKNOWN

Razorpay API timeout

order creation response missing

verify order state before retry

Duplicate request

same intent submitted twice

idempotency lookup

Webhook delay

critical event not received

API verification

Webhook duplication

same event delivered twice

event deduplication

Inventory change

stock changed after validation

revalidate and block/modify

Policy change

merchant updates rule mid-session

policy version mismatch → revalidate

Database failure

audit/action state not durable

do not acknowledge as complete

Failure state machine

stateDiagram-v2
    EXECUTING --> EXECUTION_UNKNOWN: timeout / ambiguous response
    EXECUTION_UNKNOWN --> VERIFYING: query authoritative state

    VERIFYING --> VERIFIED_SUCCESS: action exists and succeeded
    VERIFYING --> VERIFIED_FAILURE: action did not happen
    VERIFYING --> ESCALATED: state cannot be determined safely

    VERIFIED_FAILURE --> RETRY_ELIGIBLE
    RETRY_ELIGIBLE --> EXECUTING: safe + idempotent retry

    VERIFIED_SUCCESS --> AUDITED
    VERIFIED_FAILURE --> AUDITED
    ESCALATED --> AUDITED

Recovery strategy

For every failure:

1. Detect

Capture:

request ID

action ID

idempotency key

failure type

timestamp

2. Stop unsafe continuation

Do not infer success/failure from the exception alone.

3. Verify authoritative state

Query the relevant source of truth.

4. Classify

VERIFIED_SUCCESS
VERIFIED_FAILURE
STATE_STILL_UNKNOWN

5. Decide

VERIFIED_SUCCESS → reuse result

VERIFIED_FAILURE → retry only if safe and authorized

STATE_STILL_UNKNOWN → escalate or continue verification

6. Audit

Record every state transition.

Razorpay timeout scenario

Scenario

PolicyShield passes the deterministic gate and asks the Razorpay Test API to create an order.

The request times out.

Naive implementation

timeout
  ↓
"request failed"
  ↓
retry
  ↓
possible duplicate

PolicyShield

request
  ↓
timeout
  ↓
EXECUTION_UNKNOWN
  ↓
query Razorpay state
  ↓
does the expected order/action already exist?
   ├── YES → reuse / verify
   └── NO  → bounded idempotent retry

The critical distinction is:

A timeout is a transport result, not a business-state result.

Exact incident example

Initial request

request_id = req_91
intent_id = intent_42
action_id = action_12
idempotency_key = merchantA:intent42:create-order:v3

Event

Razorpay API call
→ network timeout

State transition

EXECUTING
→ EXECUTION_UNKNOWN

Verification

PolicyShield queries the authoritative order/payment state.

Branch A — order exists

Do not create a second order.

EXECUTION_UNKNOWN
→ VERIFIED_SUCCESS
→ AUDITED

Branch B — order does not exist

The previous action is verified absent.

If the policy still permits the action:

EXECUTION_UNKNOWN
→ VERIFIED_FAILURE
→ RETRY_ELIGIBLE
→ EXECUTING

using the same logical idempotency identity.

Branch C — state cannot be verified

EXECUTION_UNKNOWN
→ ESCALATED

No blind retry.

Inventory mutation after validation

Timeline:

T0: inventory = 8
T1: Policy Gate approves
T2: inventory changes = 0
T3: execution begins
T4: Context Engine rechecks
T5: transaction invalidated

Result:

BLOCKED
reason_code = INVENTORY_CHANGED_AFTER_VALIDATION

No payment action is executed against stale inventory assumptions.

Stale price

If price data exceeds the configured freshness threshold:

STALE_CONTEXT
→ REFRESH_REQUIRED
→ GET_PRICE
→ REVALIDATE_POLICY
→ continue only if still valid

The AI cannot waive freshness requirements.

Duplicate request

Two identical buyer requests arrive.

Both produce the same logical intent key.

The Action Executor checks:

merchant_id
+
intent_id
+
action_version

Only the first mutation executes.

The second request receives the existing action state.

Webhook delay

A webhook is late.

PolicyShield does not treat absence of a webhook as proof that an action failed.

For critical state, it queries the authoritative API and stores the verification result.

Webhook duplication

If the same webhook arrives twice:

event_id already processed?
    YES → ignore duplicate
    NO  → process and persist

The underlying business action is idempotent even if event delivery is repeated.

Policy change during an active session

Suppose:

Policy v10:
max discount = 10%

Agent validates at T0.

Merchant changes:

Policy v11:
max discount = 5%

At execution time, PolicyShield compares the policy version used for validation with the current version.

Mismatch:

REVALIDATE

The older authorization cannot silently continue.

AI failure

Examples:

malformed JSON

unavailable model

unsupported decision

low confidence

hallucinated tool

Response:

Reject model output
→ no financial mutation
→ bounded retry or escalation

The system remains safe even if AI is completely unavailable.

What we intentionally refuse to do

PolicyShield will never automatically:

treat a timeout as proof of failure

retry an uncertain financial mutation blindly

override merchant policy because the AI is confident

invent inventory or payment state

execute a tool that is not explicitly allowlisted

alter policy to make its own proposal succeed

grant itself permissions

hide failed decisions

delete audit history

Chaos testing

The MVP should have toggles for:

[ ] Razorpay API timeout
[ ] Inventory changes after validation
[ ] Stale price
[ ] Duplicate request
[ ] Delayed webhook
[ ] Duplicate webhook
[ ] Policy conflict
[ ] Policy update during session
[ ] Context service failure

Each fault should produce:

deterministic state transition

visible recovery decision

audit event

measurable test result

Post-incident audit

A recovery event should record:

{
  "event_type": "EXECUTION_RECOVERY",
  "request_id": "req_91",
  "intent_id": "intent_42",
  "action_id": "action_12",
  "previous_state": "EXECUTION_UNKNOWN",
  "verification_source": "razorpay_api",
  "verification_result": "NOT_FOUND",
  "retry_allowed": true,
  "retry_reason": "prior_action_verified_absent",
  "timestamp": "..."
}

Secrets and unnecessary sensitive data are excluded.

Operational rule

When the system cannot prove that a dangerous action is safe:

STOP.

That is a feature, not a failure.