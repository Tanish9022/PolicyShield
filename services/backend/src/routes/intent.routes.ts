import { Router } from 'express';
import { processIntent } from '../gateway/orchestrator';
import { BuyerIntentInputSchema, IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const input = BuyerIntentInputSchema.parse(req.body);
    
    const intent: IntentRequest = {
      request_id: req.headers['x-request-id'] as any,
      intent_id: uuidv4() as any,
      merchant_id: input.merchant_id as any,
      buyer_input: input.buyer_input,
      customer_id: input.customer_id,
      received_at: new Date().toISOString()
    };
    
    // Process intent through the gateway
    const result = await processIntent(intent);
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:intentId/checkout', async (req, res, next) => {
  try {
    const { checkoutAction } = await import('../gateway/orchestrator');
    const result = await checkoutAction(req.params.intentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:intentId/verify', async (req, res, next) => {
  try {
    const { resolveUnknownExecution } = await import('../gateway/orchestrator');
    const result = await resolveUnknownExecution(req.params.intentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
