/**
 * 🚀 Vercel Function - Binance Proxy
 * Substitui: /make-server-1dbacac6/real/binance/:symbol
 *
 * Contorna CORS e elimina consumo de quota do Supabase
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid symbol parameter' });
    }

    const normalizedSymbol = symbol.toUpperCase();

    // Busca dados da Binance API
    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${normalizedSymbol}`
    );

    if (!binanceResponse.ok) {
      const errorText = await binanceResponse.text();
      console.error('[Binance API Error]:', errorText);
      return res.status(binanceResponse.status).json({
        error: 'Binance API error',
        details: errorText
      });
    }

    const data = await binanceResponse.json();

    // Retorna dados formatados
    return res.status(200).json({
      symbol: normalizedSymbol,
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChange),
      changePercent: parseFloat(data.priceChangePercent),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      high: parseFloat(data.highPrice),
      low: parseFloat(data.lowPrice),
      open: parseFloat(data.openPrice),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Binance Proxy Error]:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
