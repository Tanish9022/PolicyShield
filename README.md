PolicyShield

<div align="center">

<h1>🛡️ PolicyShield</h1>

<h3>AI Policy Compiler + Runtime Guard for Agentic Commerce</h3>

<p>
  <strong>AI can reason.</strong>
  &nbsp;•&nbsp;
  <strong>Merchants define the rules.</strong>
  &nbsp;•&nbsp;
  <strong>Deterministic systems enforce them.</strong>
</p>

<p>
  <a href="#-the-problem">Problem</a> ·
  <a href="#-how-policyshield-works">Architecture</a> ·
  <a href="#-live-demo">Demo</a> ·
  <a href="#-evaluation">Evaluation</a> ·
  <a href="#-security-model">Security</a> ·
  <a href="#-razorpay-integration">Razorpay</a>
</p>

</div>

🎯 One-line thesis

PolicyShield makes autonomous commerce controllable.

An AI buyer can reason about products, prices, offers and checkout.
PolicyShield prevents that reasoning layer from silently violating merchant economics or operational constraints.

The design principle is simple:

The model can recommend an action. It cannot authorize a financial mutation.

🔥 The Problem

AI-native commerce is moving from:

Human → Website → Checkout

toward:

Human → AI Agent → Merchant → Payment

That changes the risk boundary.

A normal LLM can misunderstand:

discount rules

inventory constraints

customer eligibility

shipping requirements

approval thresholds

stale data

conflicting policies

Example

A buyer asks:

“Find me the best laptop under ₹70,000, give me the maximum discount, and deliver it tomorrow.”

The merchant has these rules:

Policy

Rule

Premium products

Max discount = 5%

VIP customers

Max discount = 10%

Inventory

Keep 3 units as reserve

Express shipping

Only from an eligible warehouse

High-value orders

> ₹50,000 requires human approval

A generic AI agent may produce a perfectly reasonable-looking answer while violating one of those rules.

The real problem

How do we let AI reason autonomously while keeping the merchant's business constraints deterministic, enforceable and auditable?

💡 The Core Insight

<div align="center">

AI should reason about ambiguity.

Deterministic systems should enforce money and policy.

</div>

That gives PolicyShield a strict separation:

┌──────────────────────────────────────────────┐
│          PROBABILISTIC / AI LAYER            │
│                                              │
│  Intent • Context • Interpretation • Reason  │
│  Recommendation • Explanation • Escalation  │
└──────────────────────┬───────────────────────┘
                       │ recommendation
                       ▼
┌──────────────────────────────────────────────┐
│         TRUSTED EXECUTION BOUNDARY            │
│                                              │
│ Policy Gate • Permissions • Math • Idempotency│
│ Action Executor • Verification • Audit       │
└──────────────────────────────────────────────┘

The LLM is never part of the trusted financial execution boundary.

🧠 How PolicyShield Works

flowchart LR
    A["🤖 AI Buyer"] --> B["Commerce Gateway"]
    B --> C["Context Engine"]

    M["Merchant Natural-Language Policies"] --> D["Policy Compiler"]
    D --> E["Versioned Policy Graph"]

    C --> F["AI Reasoning Agent"]
    E --> F

    F --> G{"Deterministic\nPolicy Gate"}

    G -->|APPROVE| H["Action Executor"]
    G -->|MODIFY| I["Modified Action"]
    G -->|REJECT| J["Blocked"]
    G -->|ESCALATE| K["Human Approval"]

    I --> G
    K --> G

    H --> L["Razorpay Test APIs"]
    L --> N["Verification Layer"]

    N --> O["Audit Ledger"]
    N --> P["Observability"]

    Q["⚡ Chaos / Fault Injector"] -.-> L
    Q -.-> C
    Q -.-> N

    E --> R["Policy Versioning"]
    F --> S["AI Evaluation"]
    S --> P

Request lifecycle

OBSERVE
   ↓
FETCH AUTHORITATIVE CONTEXT
   ↓
RESOLVE POLICY
   ↓
AI REASONING
   ↓
STRUCTURED RECOMMENDATION
   ↓
DETERMINISTIC VALIDATION
   ↓
┌──────────┬──────────┬──────────┬────────────┐
│ APPROVE  │  MODIFY  │  REJECT  │  ESCALATE  │
└────┬─────┴────┬─────┴────┬─────┴──────┬─────┘
     │           │          │             │
     └───────────┴──────────┴─────────────┘
                     ↓
                  EXECUTE
                     ↓
                  VERIFY
                     ↓
                 AUDIT

🏗️ Architecture

System architecture

flowchart TB
    subgraph AI["Untrusted / Probabilistic"]
        A["AI Buyer"]
        B["Commerce Gateway"]
        C["Context Engine"]
        D["Policy Compiler"]
        E["Policy Graph"]
        F["AI Reasoning Agent"]
    end

    subgraph TRUST["Trusted Financial Execution Boundary"]
        G["Deterministic Policy Gate"]
        H["Action Executor"]
        I["Razorpay Integration"]
        J["Verification Layer"]
        K["Audit Ledger"]
    end

    L["Human Approval"]
    M["Chaos / Fault Injector"]
    N["Evaluation Harness"]
    O["Metrics / Observability"]

    A --> B
    B --> C
    D --> E
    C --> F
    E --> F
    F --> G

    G -->|approve| H
    G -->|modify| G
    G -->|escalate| L
    G -->|reject| O

    L --> G
    H --> I
    I --> J
    J --> K
    J --> O

    M -.-> I
    M -.-> C
    M -.-> J

    N --> F
    N --> O

Component map

Component

Role

Trust

AI Buyer

Simulated autonomous buyer intent

Untrusted

Commerce Gateway

Normalize requests and assign IDs

Untrusted

Context Engine

Fetch authoritative commerce context

Controlled

Policy Compiler

Convert merchant language to typed policy candidates

Probabilistic + validated

Policy Graph

Versioned policy representation

Trusted data

AI Reasoning Agent

Contextual reasoning and recommendation

Probabilistic

Deterministic Policy Gate

Hard constraint enforcement

Trusted

Action Executor

Allowlisted mutations + idempotency

Trusted

Razorpay Integration

Test-mode payment operations

Trusted boundary

Verification Layer

Confirm actual external state

Trusted

Audit Ledger

Immutable decision/action history

Trusted

Human Approval

Handles high-risk or ambiguous cases

Trusted

Evaluation Harness

Benchmark and fault testing

Controlled

🤖 AI vs Deterministic Responsibilities

Decision

AI

Deterministic

Understand buyer intent

✅



Interpret natural-language policy

✅



Detect ambiguity

✅



Explain a policy conflict

✅



Select useful read tools

✅



Recommend approve/modify/reject/escalate

✅

✅ validates

Calculate totals



✅

Calculate taxes



✅

Enforce discount ceiling



✅

Verify inventory



✅

Verify payment state



✅

Check permissions



✅

Generate idempotency key



✅

Execute financial mutation



✅

Audit mutation



✅

The rule

AI proposes. Deterministic code disposes.

💳 Razorpay Integration

PolicyShield uses Razorpay Test Mode only.

Real Razorpay integration

Test-mode credentials

Orders API

Payment-state retrieval where required

Test Checkout where appropriate

Webhooks

Server-side verification

Simulated merchant environment

Product catalogue

Inventory

Customer segment

Shipping

Promotions

Merchant policy set

Margin information

End-to-end path

AI Buyer Request
      ↓
PolicyShield
      ↓
Policy Gate
      ↓
APPROVED
      ↓
Action Executor
      ↓
Razorpay Test API
      ↓
Test Order / Payment
      ↓
Webhook / Verification
      ↓
Audit Ledger

No real money is used in the MVP.

🎬 Live Demo

The five-minute demo is designed around one realistic transaction + one deliberate failure.

Scene 1 — Merchant defines the rules

The merchant enters:

Premium products:
maximum discount = 5%

VIP:
maximum discount = 10%

Keep 3 units in reserve.

Express shipping only from an eligible warehouse.

Orders above ₹50,000 need approval.

PolicyShield compiles these into a versioned policy graph.

Scene 2 — AI buyer asks for the "best deal"

“Buy the best laptop under ₹70,000, fastest delivery, maximum discount.”

The agent retrieves:

price

inventory

active promotions

customer context

shipping options

applicable policies

Candidate #1

Price:        ₹69,999
Promotion:    15%
Inventory:    2
Shipping:     Express

Policy result

❌ 15% discount > 5% permitted
❌ 2 units < 3-unit reserve
✅ Express shipping eligible

🚨 BLOCKED / MODIFY

The AI finds a compliant alternative.

Candidate #2

Price:        ₹68,500
Promotion:    5%
Inventory:    7
Shipping:     Express

✅ APPROVED

Scene 3 — Real Razorpay Test Mode action

PolicyShield creates a real Razorpay Test Mode order.

The UI shows:

Decision:       APPROVED
Amount:         ₹68,500
Policy Version: v12
Action ID:      action_1042
Razorpay Order: order_XXXXXXXX

Scene 4 — Break the system

Inject fault #1

Inventory changes:

7 units → 0 units

after validation but before execution.

PolicyShield re-fetches the authoritative inventory.

⚠️ STATE CHANGED

The action is stopped.

No unsafe purchase proceeds.

Scene 5 — Break the payment integration

Inject:

Razorpay API timeout

Naive implementation:

timeout → retry

PolicyShield:

timeout
   ↓
EXECUTION_UNKNOWN
   ↓
verify authoritative state
   ↓
already exists? → reuse
not found?      → safe retry
still unknown?  → escalate

This is the failure-recovery moment.

📊 Evaluation

We benchmark the system on 1,000 synthetic scenarios.

Suggested distribution

Category

Cases

Normal

600

Ambiguous policies

100

Policy conflicts

100

State changes

75

Tool failures

50

Adversarial / prompt injection

50

High-value approvals

25

Total

1,000

Baselines

Naive LLM

Rules-only

PolicyShield

Primary metrics

Policy adherence
Decision accuracy
Unsafe autonomous action rate
False-block rate
Escalation precision
Failure-recovery success
Median / p95 latency
Tool-call count

Safety metric

UNSAFE_AUTONOMOUS_ACTION_RATE

Target: 0

Measured results will be added only after the benchmark has actually been run.

🛡️ Security Model

PolicyShield is designed around least privilege + fail closed.

Threats considered

prompt injection

malicious buyer instructions

policy poisoning

stale context

tool abuse

duplicate requests

webhook replay/spoofing

secret leakage

compromised model output

policy conflicts

privilege escalation

Hard rules

The system will never automatically:

override a merchant policy

invent payment state

invent inventory

retry an uncertain financial action blindly

grant itself permissions

modify a policy to make its proposal succeed

expose credentials

delete audit history

Trust boundary

                     ┌─────────────────────────┐
                     │      AI / MODEL         │
                     │                         │
                     │  Can reason             │
                     │  Can recommend         │
                     │  Can explain           │
                     └────────────┬────────────┘
                                  │
                                  │ NO DIRECT MONEY AUTHORITY
                                  ▼
                     ┌─────────────────────────┐
                     │ DETERMINISTIC CONTROL   │
                     │                         │
                     │ Policy                  │
                     │ Permissions             │
                     │ Idempotency             │
                     │ State verification      │
                     │ Financial execution     │
                     └─────────────────────────┘

⚡ Failure Recovery

Explicit transaction states

stateDiagram-v2
    [*] --> PROPOSED
    PROPOSED --> VALIDATED
    PROPOSED --> ESCALATED

    VALIDATED --> BLOCKED
    VALIDATED --> EXECUTING
    VALIDATED --> ESCALATED

    EXECUTING --> EXECUTION_UNKNOWN
    EXECUTING --> VERIFIED_SUCCESS
    EXECUTING --> VERIFIED_FAILURE

    EXECUTION_UNKNOWN --> VERIFYING

    VERIFYING --> VERIFIED_SUCCESS
    VERIFYING --> VERIFIED_FAILURE
    VERIFYING --> ESCALATED

    VERIFIED_SUCCESS --> [*]
    VERIFIED_FAILURE --> [*]
    BLOCKED --> [*]
    ESCALATED --> [*]

Key principle

A timeout is a transport result — not proof that the business action failed.

Therefore:

EXECUTING
    ↓
EXECUTION_UNKNOWN
    ↓
VERIFY
    ├── action exists → reuse
    ├── action absent → bounded retry
    └── state unclear → human escalation

🔁 Idempotency

Every mutating intent receives:

intent_id
action_id
idempotency_key

Duplicate requests do not create duplicate financial actions.

The system checks existing action state before retry.

📜 Auditability

Every important decision records:

{
  "intent_id": "intent_42",
  "action_id": "action_12",
  "policy_version": "v12",
  "decision": "MODIFY",
  "policy_ids": ["P-001", "P-003"],
  "evidence_refs": ["ctx_01", "ctx_02"],
  "action_type": "APPLY_DISCOUNT",
  "verification": "SUCCESS",
  "timestamp": "..."
}

No secrets or unnecessary sensitive information are stored.

📁 Repository

policyshield/
│
├── README.md
├── ARCHITECTURE.md
├── AI_AGENT_SPEC.md
├── SECURITY_AND_GUARDRAILS.md
├── EVALUATION.md
├── FAILURE_RECOVERY.md
│
├── apps/
│   ├── merchant-dashboard/
│   └── buyer-simulator/
│
├── services/
│   ├── commerce-gateway/
│   ├── context-engine/
│   ├── policy-compiler/
│   ├── policy-gate/
│   ├── agent/
│   ├── executor/
│   ├── verification/
│   └── audit/
│
├── integrations/
│   └── razorpay/
│
├── policies/
│
└── evaluation/

🚀 Quick Start

Prerequisites

Node.js / Python according to the implementation

Git

Razorpay Test Mode credentials

Optional Docker

Setup

git clone <repository-url>
cd policyshield

cp .env.example .env

# Add Razorpay TEST credentials to .env
# Install dependencies
# Start backend
# Start frontend

Environment variables

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

Never commit .env.

📈 What We Actually Prove

PolicyShield is not evaluated by how impressive the UI looks.

We want evidence that:

AI reasoning
      +
deterministic enforcement
      +
real Razorpay Test Mode integration
      +
failure recovery
      +
measurable evaluation

produces safer and more reliable agentic commerce than a naive LLM.

Benchmark results shown in this repository must come from the actual evaluation run.

🧭 Engineering Thesis

<div align="center">

We don't trust the model with the money.

We trust the architecture.

</div>