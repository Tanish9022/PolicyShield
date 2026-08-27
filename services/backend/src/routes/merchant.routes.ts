import { Router } from 'express';
import { PRODUCTS, INVENTORY, PROMOTIONS, SHIPPING, CUSTOMERS } from '../context-engine/data';

const router = Router();

// No DB needed for merchant read-only data, just serve the JSON arrays.

router.get('/products', (_req, res) => res.json(PRODUCTS));
router.get('/inventory', (_req, res) => res.json(INVENTORY));
router.get('/promotions', (_req, res) => res.json(PROMOTIONS));
router.get('/shipping', (_req, res) => res.json(SHIPPING));
router.get('/customers', (_req, res) => res.json(CUSTOMERS));

export default router;
