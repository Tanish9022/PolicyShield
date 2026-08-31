# PolicyShield Architecture

PolicyShield strictly separates AI inference from authoritative state. The core philosophy is that AI should be allowed to reason and adapt, but the financial boundaries must remain completely deterministic and verifiable.

## The Trust Hierarchy

To maintain this strict boundary, the system operates on the following Trust Hierarchy:

```
POLICY (Authority)
  ↓
CURRENT COMMERCE CONTEXT (Current Truth)
  ↓
BUYER MEMORY (Context/History)
  ↓
LLM INFERENCE (Proposal/Plan)
```

1. **MEMORY**: Contains explicit preferences and historical interactions. Memory is inherently stale and is *never* authoritative for price, inventory, promotions, policy, authorization, or payment state.
2. **COMMERCE CONTEXT**: The current truth. Prices and inventory fetched Just-In-Time (JIT) from the database before checkout validation.
3. **POLICY**: The merchant's hard business rules (e.g. `MAX_DISCOUNT`). It dictates what is permitted.
4. **RAZORPAY**: The external payment truth. Webhooks serve as the only acceptable source for payment capture states.

## The AI Buyer Flow

```
                         AI BUYER
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          BUYER MEMORY           CURRENT CONTEXT
        preferences/history      price/inventory
                 │                     │
                 └──────────┬──────────┘
                            ▼
                         GEMINI
                            │
                     PROPOSAL / PLAN
                            │
                            ▼
                  SCHEMA VALIDATION
                            │
                            ▼
                    POLICY AUTHORITY
                            │
                            ▼
                     JIT VALIDATION
                            │
                            ▼
                      IDEMPOTENCY
                            │
                            ▼
                        RAZORPAY
                            │
                            ▼
                       VERIFICATION
                            │
                            ▼
                          AUDIT
```

## System Resilience
- **Idempotency**: All operations (including JIT pricing and checkout execution) are bound to a strict `intent_id`.
- **Memory Resilience**: If the buyer memory is unavailable, the AI Buyer safely proceeds using only the Current Commerce Context, ensuring the checkout safety is unchanged. Memory conflicts are logged (`MEMORY_CONFLICT_DETECTED`) if an explicit request deviates from saved memory.
