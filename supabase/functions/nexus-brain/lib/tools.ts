/**
 * Ferramentas reais do NEXUS — o que dá ao assistente acesso a "tudo que a
 * plataforma tem", não só ao ativo que o usuário está olhando no momento.
 *
 * Antes desta peça (2026-08-24), o NEXUS só recebia um `contextPackage` fixo
 * de UM símbolo, montado no client antes da pergunta chegar ao LLM — então
 * qualquer pergunta que exigisse varrer a cesta inteira ("qual ativo está
 * subindo mais hoje?") não tinha como ser respondida, e o client caía num
 * fallback de símbolo único que às vezes nem existia mais no catálogo
 * (2026-08-25, ver CLAUDE.md). Pedido explícito e repetido do Cleber: o
 * NEXUS precisa estar conectado a tudo que o produto já sabe.
 *
 * Cada tool aqui só chama endpoint/tabela real já existente no produto —
 * nenhuma é dado novo, é reuso do que já alimenta o Dashboard/AI Trader.
 * Nenhuma tool aqui pode fabricar dado: se a fonte real falhar, retorna erro
 * explícito pro LLM, nunca um número inventado (mesma disciplina do resto do
 * projeto, ver CLAUDE.md "Convenções do projeto").
 */
import { getServiceClient } from './serviceClient.ts';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolContext {
  userId: string;
  supabaseUrl: string;
  anonKey: string;
}

/**
 * Cesta ampla de ranking (39 ativos) — MESMA lista de
 * `src/app/config/defaultBasket.ts` (`DEFAULT_ANALYSIS_BASKET`). Duplicada
 * aqui de propósito: funções Deno neste projeto são deployadas isoladas
 * (não importam de `src/app`), mesma convenção já usada pra
 * `CRYPTO_CFD_SYMBOLS` (ver CLAUDE.md, sessão 2026-08-20) — MANTER
 * SINCRONIZADA MANUALMENTE se um ativo for adicionado/removido de um dos
 * dois lados.
 */
const RANKING_BASKET = [
  'SPX500', 'NAS100', 'US30', 'US2000', 'GER40', 'UK100', 'FRA40', 'JP225',
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD', 'LTCUSD', 'LINKUSD', 'AVAXUSD',
  'XAUUSD', 'XPTUSD', 'XPDUSD',
  'USOUSD', 'UKOUSD', 'XNGUSD',
  'COCUSD', 'COFUSD', 'SUGUSD', 'WHEUSD',
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY',
];

// Cache curto em memória — sobrevive só enquanto a instância da function
// estiver quente (cold start zera), mas evita bater a conta MetaAPI
// compartilhada a cada pergunta idêntica em sequência (risco de rate-limit
// documentado no CLAUDE.md).
let rankingCache: { at: number; prices: RankingPrice[] } | null = null;
const RANKING_CACHE_TTL_MS = 90_000;

interface RankingPrice {
  symbol: string;
  price: number;
  changePercent: number;
  source: string;
}

async function fetchRankingPrices(ctx: ToolContext): Promise<{ prices: RankingPrice[]; isSimulated: boolean }> {
  if (rankingCache && Date.now() - rankingCache.at < RANKING_CACHE_TTL_MS) {
    return { prices: rankingCache.prices, isSimulated: rankingCache.prices.some((p) => p.source === 'SIMULATED') };
  }

  const res = await fetch(`${ctx.supabaseUrl}/functions/v1/server/mt5-prices`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${ctx.anonKey}` },
    body: JSON.stringify({ symbols: RANKING_BASKET }),
  });
  if (!res.ok) {
    throw new Error(`mt5-prices retornou HTTP ${res.status} — sem dado real de ranking agora.`);
  }
  const data = await res.json();
  const prices: RankingPrice[] = (data?.prices ?? []).map((p: any) => ({
    symbol: p.symbol,
    price: p.price,
    changePercent: p.changePercent ?? 0,
    source: p.source ?? 'unknown',
  }));
  rankingCache = { at: Date.now(), prices };
  return { prices, isSimulated: prices.some((p) => p.source === 'SIMULATED') };
}

export function getToolDefinitions(): ToolDef[] {
  return [
    {
      name: 'market_ranking',
      description:
        'Varre a cesta ampla de ativos do produto (39 ativos: índices, cripto, metais, energia, softs, forex) e retorna quem subiu/caiu mais no dia, ordenado por variação percentual real. Use SEMPRE que o usuário perguntar algo como "qual ativo está subindo mais", "o que está caindo hoje", "tem algo se destacando" — sem isso você só vê o ativo atual, não a cesta inteira.',
      input_schema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['gainers', 'losers'], description: 'gainers = maiores altas, losers = maiores quedas' },
          limit: { type: 'number', description: 'Quantos ativos retornar (padrão 5, máximo 15)' },
        },
        required: ['direction'],
      },
    },
    {
      name: 'asset_price',
      description: 'Preço e variação % real de UM ativo específico pelo símbolo (ex: "GER40", "ETHUSD"). Use quando o usuário citar um ativo que não é o ativo atual do gráfico.',
      input_schema: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Símbolo do ativo, ex: EURUSD, BTCUSD, GER40' } },
        required: ['symbol'],
      },
    },
    {
      name: 'open_positions',
      description: 'Lista as posições ABERTAS reais do usuário agora (todas, ou filtradas por símbolo). Use quando o usuário perguntar sobre posições/trades abertos que não sejam necessariamente do ativo atual.',
      input_schema: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Opcional — filtra por símbolo específico' } },
      },
    },
    {
      name: 'economic_calendar',
      description: 'Agenda econômica real (próximos eventos de alto/médio impacto). Use quando o usuário perguntar sobre risco de notícia/calendário em geral, não só do ativo atual.',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'recent_news',
      description: 'Manchetes de notícia real recentes agregadas (RSS). Use quando o usuário perguntar "o que está saindo na notícia" de forma geral.',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'recent_alerts',
      description: 'Alertas proativos reais que o NEXUS já gerou recentemente para este usuário (risco, notícia, calendário, guarda de preço).',
      input_schema: { type: 'object', properties: {} },
    },
  ];
}

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case 'market_ranking': {
      const direction = input.direction === 'losers' ? 'losers' : 'gainers';
      const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 15);
      const { prices, isSimulated } = await fetchRankingPrices(ctx);
      if (prices.length === 0) throw new Error('Nenhum preço real disponível para ranking agora.');
      const sorted = [...prices].sort((a, b) =>
        direction === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
      );
      return {
        direction,
        isSimulated, // se true, dado NÃO é real (token MetaAPI ausente) — o LLM deve avisar, nunca apresentar como real
        ranking: sorted.slice(0, limit).map((p) => ({ symbol: p.symbol, price: p.price, variacaoPercentualHoje: p.changePercent })),
      };
    }
    case 'asset_price': {
      const symbol = String(input.symbol || '').toUpperCase().trim();
      if (!symbol) throw new Error('symbol é obrigatório.');
      const res = await fetch(`${ctx.supabaseUrl}/functions/v1/server/mt5-prices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${ctx.anonKey}` },
        body: JSON.stringify({ symbols: [symbol] }),
      });
      if (!res.ok) throw new Error(`mt5-prices retornou HTTP ${res.status} para ${symbol}.`);
      const data = await res.json();
      const price = (data?.prices ?? [])[0];
      if (!price) throw new Error(`Sem preço real disponível para ${symbol} agora.`);
      return { symbol: price.symbol, price: price.price, variacaoPercentualHoje: price.changePercent, isSimulated: price.source === 'SIMULATED' };
    }
    case 'open_positions': {
      const svc = getServiceClient();
      let query = svc
        .from('ai_trades')
        .select('symbol, side, entry_price, entry_time, stop_loss, take_profit, quantity')
        .eq('user_id', ctx.userId)
        .eq('status', 'OPEN')
        .order('entry_time', { ascending: false });
      const symbol = input.symbol ? String(input.symbol).toUpperCase().trim() : null;
      if (symbol) query = query.eq('symbol', symbol);
      const { data, error } = await query;
      if (error) throw new Error(`Falha ao consultar posições reais: ${error.message}`);
      return { posicoesAbertas: data ?? [] };
    }
    case 'economic_calendar': {
      const res = await fetch(`${ctx.supabaseUrl}/functions/v1/server/economic-calendar`, {
        headers: { Authorization: `Bearer ${ctx.anonKey}` },
      });
      if (!res.ok) throw new Error(`economic-calendar retornou HTTP ${res.status}.`);
      const data = await res.json();
      const events = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
      return { eventos: events.slice(0, 12) };
    }
    case 'recent_news': {
      const res = await fetch(`${ctx.supabaseUrl}/functions/v1/server/news/aggregate`, {
        headers: { Authorization: `Bearer ${ctx.anonKey}` },
      });
      if (!res.ok) throw new Error(`news/aggregate retornou HTTP ${res.status}.`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      return { manchetes: items.slice(0, 10).map((n: any) => ({ titulo: n.title, fonte: n.source, categoria: n.category, quando: n.timestamp ?? null })) };
    }
    case 'recent_alerts': {
      const svc = getServiceClient();
      const { data, error } = await svc
        .from('nexus_alerts')
        .select('symbol, severity, kind, message, created_at')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw new Error(`Falha ao consultar alertas reais: ${error.message}`);
      return { alertas: data ?? [] };
    }
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}
