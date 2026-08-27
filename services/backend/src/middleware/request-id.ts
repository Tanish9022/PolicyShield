import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Assigns a unique request ID to every incoming request.
 * Available as req.headers['x-request-id'].
 */
export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }
  next();
}
