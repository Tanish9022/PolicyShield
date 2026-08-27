import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler. Catches unhandled errors and returns
 * a structured JSON response. Never leaks stack traces in production.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ERROR]', err.message);

  const statusCode = (err as any).statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: {
      message: err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
