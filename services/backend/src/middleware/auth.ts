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
  // If no auth headers exist, use development default if configured (simulate login)
  const defaultCustomer = process.env.NODE_ENV === 'test' ? undefined : (process.env.DEV_CUSTOMER_ID || 'CUST-001');
  const defaultMerchant = process.env.NODE_ENV === 'test' ? undefined : (process.env.DEV_MERCHANT_ID || 'TECH_STARTUP');

  req.auth = {
    customerId: req.headers['x-customer-id'] as string || defaultCustomer,
    merchantId: req.headers['x-merchant-id'] as string || defaultMerchant
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
