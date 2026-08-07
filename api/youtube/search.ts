import app from '../../server.js';
import type { Request, Response } from 'express';

// An explicit file-system route guarantees that Vercel publishes the endpoint
// used by the client, instead of relying on the catch-all API route.
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
