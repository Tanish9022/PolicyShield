PolicyShield

AI Policy Compiler + Runtime Guard for Agentic Commerce

AI can reason.
Merchants define the rules.
Deterministic systems enforce them.

PolicyShield makes autonomous commerce controllable.

The Problem

AI buyers can autonomously discover products, compare offers and initiate checkout. The risk is not only whether an AI can complete a purchase; it is whether the agent can do so without silently violating the merchant's economics or operational constraints.

Example merchant policies:

Premium products: maximum discount = 5%

VIP customers: maximum discount = 10%

Maintain an inventory buffer of 3 units

Express delivery is allowed only from an eligible warehouse

Orders above ₹50,000 require human approval

A generic LLM may understand these rules, but understanding is not enforcement. A model can misinterpret a policy, use stale context, follow a malicious buyer instruction, or retry an uncertain financial action.

Core Insight

AI should reason about ambiguous context. Deterministic systems should enforce financial and merchant constraints.

PolicyShield therefore separates:

Natural-language merchant policies
                ↓
         Policy Compiler
                ↓
          Typed Policy Graph
                ↓
        AI Contextual Reasoning
                ↓
      Deterministic Policy Gate
                ↓
          Action Executor
                ↓
        Razorpay Test APIs
                ↓
          Verification
                ↓
            Audit

The LLM is never part of the trusted financial execution boundary.

Before vs After

Scenario

Naive AI commerce

PolicyShield

15% discount, merchant cap 5%

May approve

Deterministic gate blocks

Inventory falls below reserve

May continue

Revalidates and stops/modifies

Policy is ambiguous

May guess

Escalates

Payment API times out

May blindly retry

Enters EXECUTION_UNKNOWN, verifies state

High-value order

May execute

Human approval gate

User says "ignore merchant rules"

May follow instruction

Merchant policy remains authoritative

Five-minute demo

Merchant loads five policies in natural language.

Policy Compiler creates versioned structured policies.

AI buyer requests a laptop with the "maximum discount" and fastest delivery.

PolicyShield gathers price, inventory, promotion, shipping and customer context.

AI proposes an action.

Deterministic gate rejects the invalid discount and selects a compliant alternative.

A Razorpay Test Mode order is created.

We inject an inventory change after validation and show the transaction being stopped.

We inject a Razorpay integration timeout and show EXECUTION_UNKNOWN → verification → safe resume/stop.

We run the same architecture against a 1,000-case adversarial evaluation suite.

Architecture at a glance

flowchart LR
    A[AI Buyer] --> B[Commerce Gateway]
    B --> C[Context Engine]
    C --> D[Policy Compiler]
    D --> E[Policy Graph]
    E --> F[AI Reasoning Agent]

    F --> G{Deterministic Policy Gate}

    G -->|Approve| H[Action Executor]
    G -->|Modify| I[Modified Action]
    G -->|Reject| J[Blocked]
    G -->|Escalate| K[Human Approval]

    I --> G
    K --> G

    H --> L[Razorpay Test APIs]
    L --> M[Verification Layer]

    M --> N[Audit Ledger]
    M --> O[Observability]

    P[Chaos / Fault Injector] -.-> L
    P -.-> C
    P -.-> M

    E --> Q[Policy Versioning]
    F --> R[AI Evaluation]
    R --> O

Razorpay integration

Real

Razorpay Test Mode authentication

Test Orders

Test payment state retrieval where used

Test webhooks

Server-side state verification

Test Checkout where used

Simulated merchant environment

Product catalogue

Merchant policies

Inventory

Customer segments

Shipping rules

Promotions

Margin data

No real money is used in the MVP. Test credentials remain server-side and are never committed to the repository.

AI vs deterministic responsibilities

Responsibility

AI

Deterministic

Interpret natural-language policy

Yes

Validation

Detect ambiguity

Yes

Escalation rules

Contextual recommendation

Yes

Policy gate

Policy conflict explanation

Yes

Precedence enforcement

Arithmetic / tax / totals

No

Yes

Payment state

No

Yes

Inventory truth

No

Yes

Permission checks

No

Yes

Idempotency

No

Yes

Financial execution

No

Yes

Audit logging

No

Yes

Safety

PolicyShield uses:

deterministic policy gates

least-privilege tools

action allowlists

idempotency keys

state verification

human approval thresholds

explicit EXECUTION_UNKNOWN state

audit records

prompt-injection defenses

fail-closed behavior for dangerous actions

Evaluation

The benchmark contains 1,000 synthetic transaction scenarios covering normal cases, ambiguous policies, policy conflicts, state changes, tool failures, adversarial instructions and high-value approvals.

Primary metrics:

policy adherence

decision accuracy

unsafe autonomous action rate

false-block rate

escalation precision

recovery success

latency

tool-call count

Benchmark values shown here must be generated from the actual evaluation run. No results are fabricated in this repository.

See EVALUATION.md.

Failure recovery

Example:

Razorpay request timeout
        ↓
EXECUTION_UNKNOWN
        ↓
Query authoritative state
        ↓
Existing action found? ── Yes ──> Reuse / verify
        │
        No
        ↓
Safe retry

The key principle is:

External failure does not imply business-action failure.

See FAILURE_RECOVERY.md.

Repository structure

policyshield/
├── README.md
├── ARCHITECTURE.md
├── AI_AGENT_SPEC.md
├── SECURITY_AND_GUARDRAILS.md
├── EVALUATION.md
├── FAILURE_RECOVERY.md
├── apps/
├── services/
├── integrations/
├── policies/
└── evaluation/

Quick start

Prerequisites:

Node.js or Python, depending on the implementation

Docker (optional)

Razorpay Test Mode credentials

Example:

git clone <repository-url>
cd policyshield

cp .env.example .env
# Add Razorpay TEST credentials only to .env

# Install dependencies
# Start local services
# Run the application

Use the exact project commands documented by the implementation once the codebase is wired.

Environment variables

Expected server-side configuration includes:

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

Never commit .env. Commit only .env.example.

Current limitations

The MVP intentionally uses a simulated merchant environment for product, inventory, customer, shipping and promotion data. Razorpay integration is limited to Test Mode.

The benchmark is synthetic. Results should not be presented as production performance.

PolicyShield does not claim to replace a merchant's legal, compliance or operational controls.

Why this is not just a chatbot

The system is an execution pipeline:

observe
  → reason
  → propose
  → deterministic gate
  → execute
  → verify
  → audit / escalate

The model can recommend an action. It cannot authorize a financial mutation.

We don't trust the model with the money. We trust the architecture.