import { Router } from 'express';
import { processIntent } from '../gateway/orchestrator';
import { BuyerIntentInputSchema, IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireMerchantAccess } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();

// Apply auth and rate limiting to all intent routes
router.use(requireAuth);
router.use(rateLimit);

router.post('/', async (req, res, next) => {
  try {
    const input = BuyerIntentInputSchema.parse(req.body);
    
    // Explicitly enforce that the requested merchant matches the authenticated context
    if (input.merchant_id !== req.auth!.merchantId) {
      return res.status(403).json({ error: 'Forbidden cross-merchant access', request_id: req.headers['x-request-id'] });
    }
    
    const intent: IntentRequest = {
      request_id: req.headers['x-request-id'] as any,
      intent_id: uuidv4() as any,
      merchant_id: req.auth!.merchantId as any, // Derive from auth context, not body
      buyer_input: input.buyer_input,
      customer_id: req.auth!.customerId, // Derive from auth context
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
