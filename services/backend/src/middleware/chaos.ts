import { Request, Response, NextFunction } from 'express';

// The simplest chaos injector. 
// Pass 'x-chaos-drop' header with a probability (0-1) to drop the response.

export function chaosMiddleware(req: Request, res: Response, next: NextFunction): void {
  const dropProb = parseFloat(req.headers['x-chaos-drop'] as string);
  
  if (!isNaN(dropProb) && Math.random() < dropProb) {
    console.warn(`[CHAOS] Dropping request to ${req.path}`);
    // Simulate a network partition or hard crash by destroying the socket
    req.socket.destroy();
    return;
  }
  
  next();
}
