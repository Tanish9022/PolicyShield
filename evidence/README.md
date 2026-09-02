# PolicyShield Evidence

This folder contains the empirical evidence collected during the final system evaluation for the Razorpay Buildathon.

## Directories

* `/evaluations/` — Contains the raw output of the 1,000-case local deterministic benchmark (0 unsafe autonomous actions) and the 50-case live Gemini evaluation.
* `/benchmark-results/` — CI-generated benchmark artifacts (populated via GitHub Actions workflow dispatch).
* `/test-results/` — CI-generated test result artifacts.
* `/adversarial/` — Adversarial test vectors and results.
* `/screenshots/` — UI screenshots of key flows.
* `/demo/` — Space for the recorded 5-minute Razorpay Buildathon video.

## Measured Results

* **1,000-case Benchmark**: 1000/1000 safe executions. 0 unsafe autonomous actions.
* **37-test Adversarial Suite**: 37/37 tests pass across 16 test files — covering policy enforcement, prompt injection, idempotency, webhook deduplication, concurrent execution (TOCTOU), JIT validation, rate limiting, tenant isolation, and EXECUTION_UNKNOWN recovery.
* **Gemini Evaluation**: Deterministic gate intercepted 100% of LLM hallucinations or unauthorized discount proposals.

## How to Reproduce

```bash
# Run the full test suite (stubbed AI + Razorpay)
NODE_ENV=test STUB_AI=true STUB_RAZORPAY=true npm run test:all

# Run CI safety invariants (0 unsafe mutations)
NODE_ENV=test npm run eval:ci

# Run 1,000-case benchmark
npm run eval:benchmark

# Run live Gemini evaluation (requires GEMINI_API_KEY)
npm run eval:gemini

# Generate final report
npm run eval:report
```
