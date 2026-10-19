// 2026-10-19 (pedido do Cleber): o Setup só oferece o que o LLM Brain opera de verdade.
// Espelho de `MT5_ASSET_BASKET` em llm-active-brain/src/assetBasket.ts (pacote separado,
// sem import cruzado). Ativo fora desta lista era aceito no Setup e ignorado em silêncio
// pelo motor (aviso só no log do neuralBridge). Ao cadastrar um ativo novo no motor,
// adicionar aqui também.
export const LLM_BRAIN_TRADABLE_SYMBOLS: ReadonlySet<string> = new Set([
  'BTCUSD', 'XETUSD', 'BTCXBN',
  'DOGUSD', 'DOTUSD', 'XRPUSD', 'SOLUSD', 'ADAUSD', 'LNKUSD', 'UNIUSD',
  'TRXUSD', 'ATMUSD', 'XLMUSD', 'FILUSD', 'BNBUSD', 'AVAUSD',
  'EURUSD', 'XAUUSD', 'XAGUSD', 'UKOUSD',
  'GER40', 'SPX500', 'NAS100', 'UK100', 'FRA40', 'US2000',
  'AUS200', 'JPN225', 'HKG33', 'CHINA50',
  'USDJPY', 'AUDUSD', 'NZDUSD', 'AUDJPY', 'NZDJPY', 'EURJPY', 'GBPJPY',
  'USDCNH', 'USDSGD', 'USDTWD', 'XAUJPY', 'AUDNZD',
]);
