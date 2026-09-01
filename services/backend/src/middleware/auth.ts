import { Request, Response, NextFunction } from 'express';

export interface AuthContext {
  customerId?: string;
  merchantId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Minimal authentication middleware.
 * In a production deployment this would verify a JWT or session token.
 * For this prototype, it uses safe DEV identities configured via environment variables.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // SSE (EventSource) cannot send custom headers — fall back to query params for stream endpoints
  const headerMerchant = req.headers['x-merchant-id'] as string || req.query['x-merchant-id'] as string;
  const headerCustomer  = req.headers['x-customer-id']  as string || req.query['x-customer-id']  as string;

  // DEV_MERCHANT_ID defaults to 'merchant_1' to match seeded data
  // DEV_CUSTOMER_ID defaults to 'cust_demo' to match seeded data
  const defaultCustomer = process.env.NODE_ENV === 'test' ? undefined : (process.env.DEV_CUSTOMER_ID || 'cust_demo');
  const defaultMerchant = process.env.NODE_ENV === 'test' ? undefined : (process.env.DEV_MERCHANT_ID || 'merchant_1');

  req.auth = {
    customerId: headerCustomer || defaultCustomer,
    merchantId: headerMerchant || defaultMerchant
  };

  if (!req.auth.merchantId) {
    return res.status(401).json({ error: 'Unauthorized', request_id: req.headers['x-request-id'] });
  }

  next();
};

/**
 * Minimal authorization helper.
 * Ensures the authenticated user has access to the requested merchant data.
 */
export const requireMerchantAccess = (targetMerchantId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.merchantId !== targetMerchantId) {
      return res.status(403).json({ error: 'Forbidden', request_id: req.headers['x-request-id'] });
    }
    next();
  };
};
