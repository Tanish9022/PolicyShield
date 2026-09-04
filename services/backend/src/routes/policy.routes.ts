import { Router } from 'express';
import { compilePolicies } from '../policy-compiler/compiler';
import { storePolicies, getPolicies } from '../policy-graph/graph';
import { PolicyCompileInputSchema } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/compile', async (req, res, next) => {
  try {
    const input = PolicyCompileInputSchema.parse(req.body);
    const result = await compilePolicies(input.policy_text);
    
    if (result.status === 'SUCCESS' && result.graph) {
      result.graph.merchant_id = input.merchant_id;
      await storePolicies(result.graph);
    }
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:merchantId', async (req, res) => {
  const policies = await getPolicies(req.params.merchantId);
  if (!policies) {
    return res.status(404).json({ error: 'No policies found' });
  }
  res.json(policies);
});

export default router;
