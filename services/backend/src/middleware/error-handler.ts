import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler. Catches unhandled errors and returns
 * a structured JSON response. Never leaks stack traces in production.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // We explicitly log to console in development, but NEVER send stack trace to client
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.headers['x-request-id']}:`, err.message);
  }

  // Consistent, safe error shape
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    request_id: req.headers['x-request-id']
  });
};
