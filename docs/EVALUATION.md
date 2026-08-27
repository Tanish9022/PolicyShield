# Evaluation

## Objective

PolicyShield is evaluated against two baselines:
1. **Naive LLM agent** — model receives commerce context and can recommend actions without the full deterministic architecture.
2. **Rules-only baseline** — deterministic policies without contextual AI reasoning.
3. **PolicyShield** — AI reasoning plus typed policy graph, deterministic gate, verification and audit.

The goal is not to prove that an LLM is "better" in every case. The goal is to show that the combined architecture makes agentic commerce safer and more useful.

---

## Evaluation harness pipeline

```mermaid
flowchart LR
    subgraph Data["Test Data"]
        S["Synthetic Intents"]
        M["Mocked Context (Prices/Inventory)"]
        P["Test Policies"]
    end

    subgraph Pipeline["Evaluation Pipeline"]
        G["Generator"] --> A["Agent execution"]
        A --> V["Verification & Audit"]
        V --> C["Comparator (vs Ground Truth)"]
    end

    subgraph Output["Results"]
        R["Metrics & Logs"]
    end

    Data --> Pipeline
    Pipeline --> Output
```

---

## Benchmark design

Target benchmark: **1,000 synthetic scenarios**

### Suggested distribution

| Category | Cases |
| :--- | :--- |
| **Normal** | 600 |
| **Ambiguous policies** | 100 |
| **Policy conflicts** | 100 |
| **State changes** | 75 |
| **Tool failures** | 50 |
| **Adversarial / prompt injection** | 50 |
| **High-value approvals** | 25 |
| **Total** | **1,000** |

> [!NOTE]
> If implementation changes the distribution, the final report must use the actual distribution.

### Scenario schema

A benchmark record should contain:

```json
{
  "scenario_id": "case_0001",
  "intent": {},
  "customer": {},
  "cart": {},
  "products": [],
  "inventory": {},
  "promotions": [],
  "shipping": {},
  "policies": [],
  "faults": [],
  "ground_truth": {}
}
```

### Ground truth

Ground truth should come from deterministic policy evaluation and human review of ambiguous cases.

Each scenario should define:
- expected decision
- applicable policies
- permitted action(s)
- prohibited action(s)
- whether escalation is required
- expected recovery behavior for injected failures

> [!WARNING]
> The model **never** defines its own ground truth.

---

## Primary metrics

| Metric | Definition | Target |
| :--- | :--- | :--- |
| **1. Policy adherence** | Percentage of evaluated decisions that respect all applicable hard policies. | Maximize |
| **2. Decision accuracy** | Correct `APPROVE`, `MODIFY`, `REJECT`, `ESCALATE` against ground truth. | Maximize |
| **3. Unsafe autonomous action rate** | Unsafe financial mutations / total autonomous mutations. | **0** |
| **4. False-block rate** | Percentage of valid transactions incorrectly rejected or escalated. | Minimize |
| **5. Escalation precision** | Percentage of escalated cases that genuinely require human judgement. | Maximize |
| **6. Recovery success** | Percentage of injected failures resolved without unsafe duplicate or invalid execution. | Maximize |
| **7. Latency** | Median and p95 decision latency. | Monitor |
| **8. Tool-call count** | Measure unnecessary reads and repeated calls. | Monitor |

> [!NOTE]
> **Measured Result (1,000-case Benchmark): 0 / 1000 unsafe autonomous actions.**
> The deterministic policy gate successfully blocked 100% of unsafe actions recommended by the AI.

---

## Baselines

### A. Naive LLM agent
- **Purpose**: demonstrate common LLM weaknesses, expose policy bypass, hallucination and retry mistakes.

### B. Rules-only
- **Purpose**: demonstrate deterministic correctness, expose inability to resolve contextual ambiguity.

### C. PolicyShield
- **Purpose**: combine AI reasoning with deterministic enforcement.

### Expected comparison

| Capability | Naive LLM | Rules-only | PolicyShield |
| :--- | :--- | :--- | :--- |
| **Contextual reasoning** | Strong | Weak | **Strong** |
| **Hard policy enforcement** | Weak | Strong | **Strong** |
| **Ambiguity detection** | Variable | Weak | **Strong** |
| **Prompt-injection resistance** | Weak | Strong | **Strong** |
| **Flexible recommendation** | Strong | Weak | **Strong** |
| **Financial mutation safety** | Weak | Strong | **Strong** |
| **Failure recovery** | Weak | Limited | **Strong** |
| **Explainable structured decision** | Variable | Strong | **Strong** |

> [!IMPORTANT]
> Measured values must be generated from the actual implementation.

---

## Ablation tests

Run PolicyShield with one component removed at a time:

| Test | Question |
| :--- | :--- |
| **Without Policy Graph** | Does policy interpretation become less consistent? |
| **Without Deterministic Gate** | How many policy violations become possible? |
| **Without Verification Layer** | How often do uncertain external actions cause unsafe retries? |
| **Without Context Engine** | How much decision quality is lost when context is incomplete? |

These tests demonstrate whether each architectural component has a real purpose.

---

## Failure tests

Inject:
- Razorpay request timeout
- inventory mutation after validation
- stale price
- duplicate request
- delayed webhook
- duplicate webhook
- policy change during an active session
- unavailable authoritative data
- conflicting policies
- malicious buyer instruction

For each scenario, assert:
- correct state transition
- correct stop/retry behavior
- no unsafe autonomous mutation
- correct audit record

---

## Statistical reporting

Where appropriate, report:
- sample size
- percentage
- confidence interval
- baseline comparison
- scenario-category breakdown

> [!WARNING]
> Avoid presenting tiny demo samples as statistically meaningful.

---

## Reproducibility

The repository should provide commands similar to:

```bash
# Evaluate Real Gemini Reasoning (50 scenarios)
npm run eval:gemini

# Run Deterministic Benchmark (1000 simulated scenarios)
npm run eval:benchmark

# Run Adversarial/Red-Team suite
npm run eval:redteam

# Assert CI Safety Invariants
npm run eval:ci

# Generate Final Report
npm run eval:report
```

---

## What counts as a successful result?

A successful submission should demonstrate:
- hard policies are not bypassed
- valid transactions are not unnecessarily blocked
- ambiguous situations are escalated
- uncertain external actions are verified before retry
- duplicate actions are prevented
- failure recovery works on a batch, not only in the cinematic demo

---

## Known limitations

The benchmark is synthetic. It does **not** prove:
- production-scale throughput
- real-world merchant distribution
- long-term customer behavior
- legal/compliance correctness
- generalization to arbitrary merchant policy languages

Those limitations should appear in the final submission rather than being hidden.