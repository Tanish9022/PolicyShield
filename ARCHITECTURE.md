<div align="center">
  <h1>🛡️ PolicyShield Architecture</h1>
  <p>PolicyShield strictly separates AI inference from authoritative state. The core philosophy is that AI should be allowed to reason and adapt, but the financial boundaries must remain completely deterministic and verifiable.</p>
  <blockquote>
    <strong>The LLM proposes. The deterministic system decides. The event log proves what happened.</strong>
  </blockquote>
</div>

<hr/>

## The Trust Hierarchy

```mermaid
graph TD
    A[POLICY<br><i>Authority</i>] --> B[CURRENT COMMERCE CONTEXT<br><i>Current Truth</i>]
    B --> C[BUYER MEMORY<br><i>Context/History</i>]
    C --> D[LLM INFERENCE<br><i>Proposal/Plan</i>]

    classDef authority fill:#fca5a5,stroke:#b91c1c,color:#000
    classDef truth fill:#fde68a,stroke:#d97706,color:#000
    classDef memory fill:#bfdbfe,stroke:#1d4ed8,color:#000
    classDef ai fill:#c4b5fd,stroke:#6d28d9,color:#000

    class A authority
    class B truth
    class C memory
    class D ai
```

1. **MEMORY**: Contains explicit preferences and historical interactions. Memory is inherently stale and is *never* authoritative for price, inventory, promotions, policy, authorization, or payment state.
2. **COMMERCE CONTEXT**: The current truth. Prices and inventory fetched Just-In-Time (JIT) from the database before checkout validation.
3. **POLICY**: The merchant's hard business rules (e.g. `MAX_DISCOUNT`). It dictates what is permitted.
4. **RAZORPAY WEBHOOK**: The external payment truth. `payment.captured` is the only acceptable proof of payment success. `payment.failed` is the authoritative failure signal.

---

## The Agentic Flow

<details>
<summary><b>Click to View Agentic Flow Diagram</b></summary>

```mermaid
sequenceDiagram
    participant U as User
    participant A as Agent Runtime
    participant G as Gemini LLM
    participant P as Policy Gate
    participant W as Webhook

    U->>A: POST /api/intent
    A-->>U: 202 Accepted (run_id)
    Note over A: agent_runs.state = NEW

    A->>A: DISCOVER candidates
    A->>A: COMPARE & select
    
    loop Adaptation Loop (Max 3)
        A->>G: PROPOSE
        G-->>A: Proposal
        A->>P: Validate against Policy
        alt REJECT
            P-->>A: REJECT
            Note over A: Adapt & Re-propose
        else APPROVE
            P-->>A: APPROVE
            Note over A: agent_runs.state = READY_FOR_CHECKOUT
        end
    end

    U->>A: POST /api/intent/:id/checkout
    A->>A: JIT Price & Policy re-validation
    A->>A: Idempotency check
    A->>W: Razorpay createOrder
    
    alt Payment Captured
        W-->>A: payment.captured
        Note over A: agent_runs.state = COMPLETED
    else Payment Failed
        W-->>A: payment.failed
        Note over A: agent_runs.state = FAILED
    else Timeout
        Note over A: agent_runs.state = EXECUTION_UNKNOWN
    end
```

</details>

---

## Event-Driven State Machine

```mermaid
stateDiagram-v2
    NEW --> DISCOVERING
    DISCOVERING --> COMPARING
    COMPARING --> NEGOTIATING
    NEGOTIATING --> WAITING_POLICY
    
    WAITING_POLICY --> POLICY_REJECTED: REJECT loop
    POLICY_REJECTED --> WAITING_POLICY: ADAPT
    
    WAITING_POLICY --> READY_FOR_CHECKOUT: final approve
    
    READY_FOR_CHECKOUT --> EXECUTING
    EXECUTING --> COMPLETED
    EXECUTING --> EXECUTION_UNKNOWN
    EXECUTION_UNKNOWN --> COMPLETED: webhook success
    EXECUTION_UNKNOWN --> FAILED: webhook fail
    
    WAITING_POLICY --> BLOCKED: max retries / hard block
    WAITING_POLICY --> ESCALATED: requires human
```

`agent_events` is the **immutable, append-only, sequence-numbered** record of every transition. The frontend polls it and renders it — it never infers state.

---

## Webhook State Machine

| Event | Action | agent_runs update |
|---|---|---|
| `payment.captured` | `actions.state → VERIFIED_SUCCESS` | `state → COMPLETED` + `VERIFIED_SUCCESS` agent_event |
| `payment.failed` | `actions.state → VERIFIED_FAILURE` | `state → FAILED` + `PAYMENT_FAILED` agent_event |
| `order.paid` | Recovery path for `EXECUTION_UNKNOWN` | Same as `payment.captured` |

All webhook processing is **idempotent** — duplicate events are silently ignored via `webhook_events.event_id` PRIMARY KEY.

---

## Frontend Architecture (3-Zone Console)

<div align="center">
  <img width="800" src="https://via.placeholder.com/800x250.png?text=3-Zone+Console+Architecture" alt="3-Zone Console" style="display:none;" />
</div>

| Buyer Interface <br>*(Chat / intent)* | Immutable Event Log <br>*(append-only stream)* | Agent State <br>*(DB snapshot)* |
|:---|:---|:---|
| `POST /api/intent` <br> `202 → run_id` | `GET /events?after=N` <br> SSE stream | `GET /runs/:id` <br> SSE stream |
| `POST /checkout` <br> *(explicit confirm)* | expandable payload <br> sequence numbers <br> per-event type color | candidates <br> proposal <br> violations |

**The frontend is a renderer, not an agent.** It never infers state, never calculates business logic, and never holds authoritative data. `agent_runs.state` is the source of truth.

---

## System Resilience

- **Idempotency**: All operations bound to a strict `intent_id`. Duplicate POSTs return the existing action.
- **JIT Validation**: Prices and policy are re-validated at checkout time, not at proposal time.
- **Adaptation Loop**: LLM proposes → Policy rejects → LLM adapts (max 3 attempts). Model errors are contained deterministically.
- **Recovery**: `EXECUTION_UNKNOWN` states are resolved via `order.paid` / `payment.captured` webhooks on restart.
- **Memory Resilience**: If buyer memory is unavailable, the AI proceeds safely using only Commerce Context.

---

## Deployment Topology

```mermaid
graph LR
    subgraph Vercel
        F[Frontend CDN<br>React + Vite]
    end
    
    subgraph Render
        B[Web Service<br>Node.js + Express]
        D[(Persistent Disk<br>SQLite WAL)]
    end
    
    subgraph Razorpay
        W[Webhooks]
    end

    F -- "VITE_API_URL" --> B
    B -- "DB_PATH=/var/data/policyshield.db" --> D
    W -- "payment.captured / failed" --> B
```

### Razorpay Webhook Setup

1. Render Dashboard → copy your public URL (e.g. `https://policyshield-api.onrender.com`)
2. Razorpay Dashboard → **Settings → Webhooks → Add Webhook**
3. URL: `https://policyshield-api.onrender.com/api/webhooks/razorpay`
4. Enable events: `payment.captured` ✓ `payment.failed` ✓ `order.paid` ✓
5. Copy the Webhook Secret → set `RAZORPAY_WEBHOOK_SECRET` in Render env vars
