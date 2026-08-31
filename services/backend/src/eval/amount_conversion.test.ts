import { describe, it, expect } from 'vitest';
import { processIntent } from '../gateway/orchestrator';
import { IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Amount Conversion Tests', () => {
  const merchantId = 'merchant_1';

  it('Test AC1: Currency mismatch handling', async () => {
    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: uuidv4() as any,
      merchant_id: merchantId as any,
      buyer_input: 'I want the AirPods but I will pay 300 USD.',
      received_at: new Date().toISOString()
    };
    
    const result = await processIntent(intent);
    expect(result.gate_decision).toBeDefined();
  });
});
