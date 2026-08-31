import { Request, Response, NextFunction } from 'express';

// Minimal in-memory rate limiter for the prototype.
// Production multi-instance deployment requires Redis (or similar) shared rate limiting.

const windowMs = 60 * 1000; // 1 minute
const maxRequests = 30; // 30 requests per minute per IP

const requestCounts = new Map<string, { count: number, resetTime: number }>();

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let record = requestCounts.get(ip);
  if (!record || record.resetTime < now) {
    record = { count: 0, resetTime: now + windowMs };
  }

  record.count += 1;
  requestCounts.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({ 
      error: 'Too Many Requests', 
      request_id: req.headers['x-request-id'] 
    });
  }

  next();
};
