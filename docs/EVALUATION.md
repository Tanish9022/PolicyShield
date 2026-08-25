Evaluation

Objective

PolicyShield is evaluated against two baselines:

Naive LLM agent — model receives commerce context and can recommend actions without the full deterministic architecture.

Rules-only baseline — deterministic policies without contextual AI reasoning.

PolicyShield — AI reasoning plus typed policy graph, deterministic gate, verification and audit.

The goal is not to prove that an LLM is "better" in every case. The goal is to show that the combined architecture makes agentic commerce safer and more useful.

Benchmark design

Target benchmark:

1,000 synthetic scenarios

Suggested distribution:

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

If implementation changes the distribution, the final report must use the actual distribution.

Scenario schema

A benchmark record should contain:

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

Ground truth

Ground truth should come from deterministic policy evaluation and human review of ambiguous cases.

Each scenario should define:

expected decision

applicable policies

permitted action(s)

prohibited action(s)

whether escalation is required

expected recovery behavior for injected failures

The model never defines its own ground truth.

Primary metrics

1. Policy adherence

Percentage of evaluated decisions that respect all applicable hard policies.

policy_adherence =
policy-compliant decisions / total decisions

2. Decision accuracy

Correct:

APPROVE

MODIFY

REJECT

ESCALATE

against ground truth.

3. Unsafe autonomous action rate

unsafe_autonomous_action_rate =
unsafe financial/business mutations / autonomous mutations

Target: 0 in the benchmark.

The target is not a measured result until the benchmark is actually executed.

4. False-block rate

Percentage of valid transactions incorrectly rejected or escalated.

This prevents "safety" from being achieved by simply blocking everything.

5. Escalation precision

Percentage of escalated cases that genuinely require human judgement.

6. Recovery success

Percentage of injected failures that are resolved without unsafe duplicate or invalid execution.

7. Latency

Measure:

median decision latency

p95 latency

Do not publish a production latency claim from local benchmark results.

8. Tool-call count

Measure unnecessary reads and repeated calls.

Baselines

A. Naive LLM agent

Purpose:

demonstrate common LLM weaknesses

expose policy bypass, hallucination and retry mistakes

B. Rules-only

Purpose:

demonstrate deterministic correctness

expose inability to resolve contextual ambiguity

C. PolicyShield

Purpose:

combine AI reasoning with deterministic enforcement

Expected comparison

The intended demonstration is:

Capability

Naive LLM

Rules-only

PolicyShield

Contextual reasoning

Strong

Weak

Strong

Hard policy enforcement

Weak

Strong

Strong

Ambiguity detection

Variable

Weak

Strong

Prompt-injection resistance

Weak

Strong

Strong

Flexible recommendation

Strong

Weak

Strong

Financial mutation safety

Weak

Strong

Strong

Failure recovery

Weak

Limited

Strong

Explainable structured decision

Variable

Strong

Strong

Measured values must be generated from the actual implementation.

Ablation tests

Run PolicyShield with one component removed at a time:

Without Policy Graph

Question:
Does policy interpretation become less consistent?

Without Deterministic Gate

Question:
How many policy violations become possible?

Without Verification Layer

Question:
How often do uncertain external actions cause unsafe retries?

Without Context Engine

Question:
How much decision quality is lost when context is incomplete?

These tests demonstrate whether each architectural component has a real purpose.

Failure tests

Inject:

Razorpay request timeout

inventory mutation after validation

stale price

duplicate request

delayed webhook

duplicate webhook

policy change during an active session

unavailable authoritative data

conflicting policies

malicious buyer instruction

For each scenario, assert:

correct state transition

correct stop/retry behavior

no unsafe autonomous mutation

correct audit record

Statistical reporting

Where appropriate, report:

sample size

percentage

confidence interval

baseline comparison

scenario-category breakdown

Avoid presenting tiny demo samples as statistically meaningful.

Reproducibility

The repository should provide commands similar to:

# Generate benchmark scenarios
python evaluation/generate_dataset.py

# Run baselines
python evaluation/run_naive.py
python evaluation/run_rules.py

# Run PolicyShield
python evaluation/run_policyshield.py

# Compare metrics
python evaluation/report.py

Use the actual project commands once implemented.

What counts as a successful result?

A successful submission should demonstrate:

hard policies are not bypassed

valid transactions are not unnecessarily blocked

ambiguous situations are escalated

uncertain external actions are verified before retry

duplicate actions are prevented

failure recovery works on a batch, not only in the cinematic demo

Known limitations

The benchmark is synthetic.

It does not prove:

production-scale throughput

real-world merchant distribution

long-term customer behavior

legal/compliance correctness

generalization to arbitrary merchant policy languages

Those limitations should appear in the final submission rather than being hidden.