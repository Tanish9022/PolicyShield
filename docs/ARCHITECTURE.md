<div align="center">

# 🛡️ PolicyShield: Technical Architecture

### AI Policy Compiler & Runtime Guard for Agentic Commerce

**Razorpay AI Builder Intern Application &nbsp;•&nbsp; Track: AI Growth & Agentic Commerce**

<p>
  <strong>Probabilistic Reasoning Engine</strong> (Gemini 1.5 Flash)
  &nbsp;•&nbsp;
  <strong>Deterministic Policy Gate</strong> (Synchronous Rules)
  &nbsp;•&nbsp;
  <strong>Razorpay Test-Mode Payment Engine</strong>
</p>

</div>

---

## 🧭 Architectural Philosophy

PolicyShield is engineered around a single invariant:
> **The LLM proposes. The deterministic gate decides. The immutable event stream proves what happened.**

In autonomous agentic commerce, AI models negotiate, find products, and advocate for buyers. However, placing a probabilistic model in direct control of financial mutations introduces fatal commercial risks: price hallucinations, unauthorized discounts, inventory depletion, and duplicate debits. PolicyShield provides a provable, zero-trust boundary separating AI reasoning from financial execution.

---

## 🏗️ End-to-End System Architecture

```mermaid
graph TD
    subgraph Client["🌐 Client & Protocol Layer"]
        UI["🖥️ 3-Zone Web Console (React + Vite)"]
        SSEStream["📡 Server-Sent Events (/api/v1/runs/:id/stream)"]
        BuyerAgent["🤖 Autonomous AI Buyer Agent (HTTP Intent Protocol)"]
    end

    subgraph Reasoning["🧠 Untrusted AI Reasoning Boundary (Google Gemini 1.5 Flash)"]
        Discovery["🔎 Candidate Discovery Engine"]
        Comparison["⚖️ Candidate Comparison Engine"]
        Negotiation["💬 Commercial Proposal Engine"]
        Adaptation["🔄 Multi-Turn Adaptation Loop (Max 3 Attempts)"]
    end

    subgraph PolicyEngine["🛡️ PolicyShield Deterministic Runtime Guard"]
        Compiler["📐 Policy Graph Compiler (Typed Business Rules)"]
        PolicyGate["🚪 Synchronous Policy Gate (Hard Constraint Evaluator)"]
        JITGuard["⏱️ JIT Checkout Validator (Price, Stock & Version Freshness)"]
        Idempotency["🔑 Cryptographic Idempotency Hash (sha256(intent_id))"]
    end

    subgraph Authoritative["💳 Authoritative Financial & Storage Boundary"]
        Razorpay["⚡ Razorpay Test Mode API (Orders & Payments)"]
        Webhooks["🪝 HMAC-SHA256 Webhook Verification"]
        Recovery["🩹 Two-Phase Fault Recovery Engine (EXECUTION_UNKNOWN)"]
        Storage[("📦 Event-Sourced Storage (SQLite WAL / Neon Postgres)")]
    end

    BuyerAgent -->|POST /api/intent| Discovery
    UI -->|POST /api/intent| Discovery
    Discovery --> Comparison
    Comparison --> Negotiation
    Negotiation -->|Structured Proposal| PolicyGate

    PolicyGate -->|POLICY_REJECT + Metadata| Adaptation
    Adaptation -->|Revised Proposal| PolicyGate
    PolicyGate -->|POLICY_APPROVE| Storage

    Storage -.->|Stream Events| SSEStream
    SSEStream -.-> UI

    UI -->|POST /api/checkout| JITGuard
    JITGuard -->|Validated Current State| Idempotency
    Idempotency --> Razorpay
    Razorpay --> Webhooks
    Webhooks --> Storage
    Recovery --> Razorpay
```

---

## 🏛️ The Trust Hierarchy

Authoritative commercial state strictly overrides AI preferences and historical memory:

```mermaid
graph TD
    A["1. Hard Merchant Policy<br/><i>(Absolute Authority: Max Discount, Threshold, Reserve)</i>"]
    B["2. Current Commerce Context<br/><i>(Authoritative Truth: Live Catalog Price & Real-Time Stock)</i>"]
    C["3. Razorpay Webhook Signatures<br/><i>(Payment Authority: HMAC-SHA256 Verified)</i>"]
    D["4. Buyer Historical Memory<br/><i>(Stale Context: Past Preferences, Prior Sizes)</i>"]
    E["5. LLM Inference & Generation<br/><i>(Zero Authority: Structured Proposals Only)</i>"]

    A --> B
    B --> C
    C --> D
    D --> E

    style A fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b
    style B fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#92400e
    style C fill:#dcfce7,stroke:#10b981,stroke-width:2px,color:#166534
    style D fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    style E fill:#f3e8ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8
```

<table width="100%">
  <thead>
    <tr>
      <th width="20%">Tier</th>
      <th width="35%">Component</th>
      <th width="45%">Authority Level &amp; Role</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Tier 1</strong></td>
      <td><strong>Merchant Policy Graph</strong></td>
      <td>Absolute constraint. Defines maximum discount ceilings, required human escalation amounts, and inventory reserve levels.</td>
    </tr>
    <tr>
      <td><strong>Tier 2</strong></td>
      <td><strong>Commerce Context</strong></td>
      <td>Live catalog truth. Real-time prices and inventory levels fetched Just-In-Time from the database.</td>
    </tr>
    <tr>
      <td><strong>Tier 3</strong></td>
      <td><strong>Razorpay Webhooks</strong></td>
      <td>External payment truth. <code>payment.captured</code> is the sole acceptable proof of financial success.</td>
    </tr>
    <tr>
      <td><strong>Tier 4</strong></td>
      <td><strong>Buyer Memory</strong></td>
      <td>Historical preference context. Memory is treated as potentially stale and cannot override live prices or policies.</td>
    </tr>
    <tr>
      <td><strong>Tier 5</strong></td>
      <td><strong>LLM Inference</strong></td>
      <td>Zero financial authority. Proposes commercial intentions; cannot mutate records or authorize payments.</td>
    </tr>
  </tbody>
</table>

---

## 🔄 End-to-End Transactable Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as AI Buyer / User
    participant Gateway as PolicyShield Gateway
    participant Gemini as Gemini 1.5 Flash (Agent)
    participant Gate as Deterministic Policy Gate
    participant DB as Event-Sourced Storage
    participant Razorpay as Razorpay Test Mode API

    Buyer->>Gateway: POST /api/intent ("MacBook Pro with 50% discount")
    Gateway->>DB: Record Intent (state: NEW)
    Gateway-->>Buyer: 202 Accepted (agent_run_id)
    Note over Buyer,Gateway: Frontend establishes SSE stream (/api/v1/runs/:id/stream)

    Gateway->>Gemini: Discover & Select Product Candidates
    Gemini-->>Gateway: Selected Candidate (prod_macbook, ₹1,50,000)
    Gateway->>DB: Append Event (DISCOVER, COMPARE)

    Note over Gateway,Gate: Multi-Turn Adaptive Negotiation (Max 3 Attempts)
    Gateway->>Gemini: Formulate Commercial Proposal
    Gemini-->>Gateway: Proposal (discount: 50%, amount: ₹75,000)
    Gateway->>Gate: Validate against Typed Rules
    Gate-->>Gateway: POLICY_REJECT (Violation: max_discount=15%, allowed: 15%)
    Gateway->>DB: Append Event (POLICY_REJECT, ADAPT)
    Gateway->>Gemini: Feedback Policy Metadata (allowed_discount: 15%)
    Gemini-->>Gateway: Adapted Proposal (discount: 15%, amount: ₹1,27,500)
    Gateway->>Gate: Re-validate Adapted Proposal
    Gate-->>Gateway: POLICY_APPROVE (State: VALIDATED)

    Gateway->>DB: State -> READY_FOR_CHECKOUT
    Buyer->>Gateway: POST /api/checkout (Confirm)

    Note over Gateway,Razorpay: JIT Verification & Financial Mutation
    Gateway->>Gate: JIT Re-Validation (Live Price, Stock Reserve, Policy Version)
    Gate-->>Gateway: JIT Verification Passed
    Gateway->>Razorpay: Create Order (Idempotency Receipt: ps_sha256(intent_id))
    Razorpay-->>Gateway: order_id (e.g. order_O123)
    Razorpay-->>Gateway: Webhook: payment.captured (HMAC Verified)
    Gateway->>DB: State -> VERIFIED_SUCCESS
```

---

## ⚡ State Machine & Two-Phase Recovery

The lifecycle of an autonomous transaction is strictly modeled with zero ambiguous states:

```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> DISCOVERING
    DISCOVERING --> COMPARING
    COMPARING --> NEGOTIATING
    NEGOTIATING --> WAITING_POLICY

    WAITING_POLICY --> POLICY_REJECTED: Constraint Violated
    POLICY_REJECTED --> ADAPTING: Feed Back Policy Metadata
    ADAPTING --> WAITING_POLICY: Re-evaluate Adapted Proposal
    POLICY_REJECTED --> BLOCKED: Exceeded 3 Adaptation Attempts

    WAITING_POLICY --> ESCALATED: Order > Threshold (Requires Human)
    WAITING_POLICY --> READY_FOR_CHECKOUT: Policy Approved

    READY_FOR_CHECKOUT --> JIT_VALIDATING: Checkout Confirmed
    JIT_VALIDATING --> BLOCKED: Stale Price / Stock Drop / Policy Mismatch
    JIT_VALIDATING --> EXECUTING: JIT Passed

    EXECUTING --> VERIFIED_SUCCESS: Webhook: payment.captured
    EXECUTING --> VERIFIED_FAILURE: Webhook: payment.failed
    EXECUTING --> EXECUTION_UNKNOWN: Gateway Timeout / Network Drop

    EXECUTION_UNKNOWN --> RECOVERING: Two-Phase Startup / Webhook Scan
    RECOVERING --> VERIFIED_SUCCESS: Order Found on Razorpay
    RECOVERING --> VERIFIED_FAILURE: Order Absent on Razorpay

    VERIFIED_SUCCESS --> [*]
    VERIFIED_FAILURE --> [*]
    BLOCKED --> [*]
    ESCALATED --> [*]
```

---

## 🛡️ Key Failure Mitigations

<table width="100%">
  <thead>
    <tr>
      <th width="25%">Failure Vector</th>
      <th width="35%">Mechanism</th>
      <th width="40%">Deterministic Guarantee</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Prompt Injection</strong></td>
      <td>Deterministic Policy Gate</td>
      <td>Hostile buyer instructions cannot exceed compiled rule parameters. Violations are rejected and clamped to policy limits.</td>
    </tr>
    <tr>
      <td><strong>TOCTOU Concurrency</strong></td>
      <td>Optimistic Locking &amp; Atomic Transactions</td>
      <td>Parallel executions on the same action ID are serialized; exactly one succeeds and duplicates are blocked.</td>
    </tr>
    <tr>
      <td><strong>Stale Price Surge</strong></td>
      <td>JIT Checkout Validation</td>
      <td>Re-evaluates catalog price at the millisecond of payment; blocks stale quotes from executing.</td>
    </tr>
    <tr>
      <td><strong>Network Timeout</strong></td>
      <td>Two-Phase Recovery Loop</td>
      <td>Reconciles <code>EXECUTION_UNKNOWN</code> via idempotent receipts on Razorpay before retrying.</td>
    </tr>
    <tr>
      <td><strong>Replay Attacks</strong></td>
      <td>Cryptographic Idempotency Keys</td>
      <td>Duplicate intent submissions return the existing action without creating duplicate orders.</td>
    </tr>
  </tbody>
</table>

---

## 📦 Deployment Topology

```mermaid
graph LR
    subgraph VercelCDN["🌐 Vercel Edge Network"]
        FrontendApp["🖥️ React 18 + Vite Frontend<br/>(apps/web)"]
    end

    subgraph RenderPlatform["☁️ Render Cloud Service"]
        BackendAPI["⚡ Node.js 22 LTS API Gateway<br/>(services/backend)"]
        Disk[("💾 Persistent NVMe Disk<br/>(/var/data/policyshield.db)")]
    end

    subgraph RazorpayCloud["💳 Razorpay Infrastructure"]
        RazorpayAPIs["API: /v1/orders, /v1/payments"]
        RazorpayHooks["Webhook: payment.captured, order.paid"]
    end

    FrontendApp -- "VITE_API_URL (HTTPS + SSE)" --> BackendAPI
    BackendAPI -- "SQLite WAL Mode" --> Disk
    BackendAPI -- "REST API (Test Mode Keys)" --> RazorpayAPIs
    RazorpayHooks -- "HMAC-SHA256 Signed" --> BackendAPI
```
