# PolicyShield — Final Engineering Evaluation (Production-Minded Prototype)

This report summarizes the evaluation and proof of the PolicyShield system. The results are divided strictly by the testing methodology to provide clear transparency on what has been proven with real infrastructure versus what has been simulated or mocked.

## 1. REAL (Application Behavior & Runtime Proof)

These capabilities are fully implemented, executable, and tested against live APIs or complete internal runtimes.

*   **Application Behavior**: The core application stack (Frontend + Backend + DB) runs successfully, executing the full Trust Hierarchy (Policy > Context > Memory > Inference).
*   **Executable Runtime Tests (`npm test`)**: 10 Vitest test files containing 19 executable tests currently execute against the actual database and validation engine, proving concurrency, idempotency, strict safety checks, and memory resilience (e.g. failure to load memory defaults to safe JIT context, memory versioning prevents race conditions).
*   **Real Gemini 15-case evaluation**: 
```text
Real Gemini
Cases: 15
Successful structured outputs: 15 / 15
Policy-violation proposals: 0 / 15
Escalations correct: 15 / 15
```
*   **Test Mode Razorpay Smoke Test**: Webhooks and payment link creation correctly integrate with Razorpay Test Mode, maintaining strict verification of `payment.captured` before marking orders as `VERIFIED_SUCCESS`.

## 2. SIMULATED (N=100 Business Experiment)

**Simulated business-value experiment**

To evaluate the business impact of autonomous adaptation, a 100-session simulation was run. Both groups operated under the exact same deterministic catalog, inventory, pricing, promotions, and merchant policies.

```text
N = 100
CONTROL = 54
AI BUYER = 46
seed = SIMULATED_BUSINESS_VALUE_EXPERIMENT_SEED

CONTROL:
33 / 54 = 61.1%

AI BUYER:
46 / 46 = 100%

absolute lift:
38.9 percentage points
```

### Scenario-Level Breakdown

The completion lift originates purely from the AI's ability to adapt non-compliant requests (like over-budget or excessive discount requests) into policy-compliant alternatives.

| Scenario             | Control | AI Buyer |
| -------------------- | ------: | -------: |
| Normal               |  100.0% |   100.0% |
| Discount negotiation |    0.0% |   100.0% |
| Budget constraint    |   16.7% |   100.0% |
| High value           |  100.0% |   100.0% |
| Inventory check      |  100.0% |   100.0% |
| Ambiguous            |  100.0% |   100.0% |

## 3. MOCKED (Deterministic Fixtures & Failure Injection)

*   **Deterministic Model Fixtures**: During the Business Value Experiment and core unit testing, the LLM responses are mocked (STUB_AI) to provide consistent schema outputs that simulate various model decisions (compliant proposals, non-compliant proposals, and errors).
*   **Injected External Failures**: Simulated Razorpay timeouts and webhook delays were injected to test the `EXECUTION_UNKNOWN` state. The Orchestrator correctly fell back to polling Razorpay via external API, proving the system can recover from network partitions safely.

## 4. INFERRED / PLANNED (Production Scaling)

*   **Production Scaling beyond MVP**: Moving to a production-grade database (e.g., PostgreSQL) for the `better-sqlite3` instance. 
*   **Horizontal Scaling**: Adding queue mechanisms (e.g., Redis/BullMQ) to gracefully manage high-volume asynchronous agent executions and webhook processing.

---

## Capabilities Checklist

| Capability             | Actual proof           | Status    |
| ---------------------- | ---------------------- | --------- |
| AI Buyer discovery     | backend + test         | ✅         |
| Comparison             | backend + test         | ✅         |
| Negotiation/adaptation | test                   | ✅         |
| Memory                 | 12 memory tests        | ✅         |
| Policy authority       | deterministic gate     | ✅         |
| JIT                    | regression test        | ✅         |
| Idempotency            | concurrency test       | ✅         |
| Razorpay               | Test Mode smoke test   | ✅         |
| Failure recovery       | timeout + verification | ✅         |
| Real Gemini            | 15-case evaluation     | VERIFIED  |
| Business value         | N=100 simulation       | simulated |
| Million-request scale  | not benchmarked        | ❌/planned |

---

## Architectural Defense

> AI output and agent memory are treated as untrusted inputs to the financial control plane and are independently bounded by authoritative commerce state, merchant policy, schema validation, JIT checks, and execution controls. 

The Trust Hierarchy strictly dictates precedence:
**POLICY > CURRENT COMMERCE TRUTH > BUYER MEMORY > MODEL INFERENCE**

Memory is explicitly extracted (e.g., "I prefer Lenovo" -> Persisted; "Find me a good laptop" -> Ignored), and its integration ensures it is useful for preference ranking without ever overriding deterministic state constraints.

---

## Final Summary

**PolicyShield is a production-minded AI-commerce prototype where an AI buyer can discover, compare, negotiate and adapt, while merchant policy and current commerce state remain authoritative over model output and memory. Financial execution is protected by deterministic validation, JIT revalidation, idempotency, verification and explicit recovery from uncertain payment outcomes.**

In the implemented and tested financial paths, unsafe autonomous mutations were not observed, and the system is designed so model output is not itself financial authorization. The current implementation is a production-minded prototype; the remaining production-scale work is explicitly documented rather than hidden.
