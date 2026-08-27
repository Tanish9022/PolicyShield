# PolicyShield Evidence

This folder contains the empirical evidence collected during the final system evaluation, exactly as intended for the Razorpay Buildathon.

## Directories

* `/benchmark-results/` - Contains the raw output of the 1,000-case local deterministic benchmark, proving `0` unsafe autonomous actions, and the 50-case live Gemini evaluation.
* `/test-results/` - Contains the output of the 10-point Adversarial Suite (duplicate requests, timeouts, prompt injections, stale prices).
* `/screenshots/` - Placeholders for the final UI screenshots (Merchant Policy Compilation, Unsafe Proposal Blocked, Valid Transaction, Chaos Recovery).
* `/demo/` - Space for the recorded 5-minute Razorpay Buildathon video.

## Measured Results
* **1000-case Benchmark**: 1000/1000 safe executions. 0 unsafe autonomous actions.
* **10-point Adversarial Suite**: 10/10 adversarial vectors neutralized or recovered gracefully (including `EXECUTION_UNKNOWN` network timeouts).
* **Gemini Evaluation**: Deterministic gate intercepted 100% of LLM hallucinations or unauthorized discount proposals.
