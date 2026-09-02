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
* **13-case Live Adversarial Suite**: 13/13 passing tests — covering discount adaptation, prompt injection, idempotency deduping, JIT validation, TOCTOU concurrency, and two-phase Razorpay recovery.
* **37-test Vitest Suite**: 37/37 tests pass across 16 test files.
* **Gemini Evaluation**: Deterministic gate intercepted 100% of LLM hallucinations or unauthorized discount proposals.

## How to Reproduce

```bash
# 1. Run 1,000-case deterministic benchmark
npm run eval:benchmark

# 2. Run 13-case live adversarial test suite
npm run eval:live-adversarial

# 3. Run CI safety invariants (0 unsafe mutations)
npm run eval:ci

# 4. Run full Vitest suite (37 tests across 16 files)
npm run test:all

# 5. Run live Gemini evaluation (requires GEMINI_API_KEY)
npm run eval:gemini
```
