/**
 * 🚀 Vercel Function - Health Check
 * Substitui: /make-server-1dbacac6/health
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    service: 'Neural Trader API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
