/**
 * 🔥 METAAPI DIRECT CLIENT
 * Cliente direto para MetaAPI sem passar pelo Supabase Functions
 * Solução para erro 403 do Supabase
 * 
 * 🛡️ NOTA: Usa dynamic import para evitar erros de polyfill
 */

// 🛡️ FIX: REMOVIDO check de polyfill no top-level (causava erro antes do React iniciar)
// A verificação é feita dentro de ensureMetaApiLoaded()

// 🔥 DYNAMIC IMPORT - Não importar metaapi.cloud-sdk no topo
// Isso evita que o SDK seja carregado antes dos polyfills
let MetaApi: any = null;
let MetaApiConnection: any = null;

// 🛡️ Função helper para garantir que o SDK está carregado
async function ensureMetaApiLoaded() {
  if (!MetaApi) {
    // 🛡️ VERIFICAÇÃO: Garantir que polyfills existem (mas não lançar erro, apenas avisar)
    if (typeof globalThis.URLSearchParams === 'undefined') {
      console.warn('[MetaAPI Direct] ⚠️ URLSearchParams não disponível, mas continuando...');
    }
    
    try {
      console.log('[MetaAPI Direct] 📦 Carregando SDK dinamicamente...');
      const module = await import('metaapi.cloud-sdk');
      MetaApi = module.default;
      MetaApiConnection = module.MetaApiConnection;
      console.log('[MetaAPI Direct] ✅ SDK carregado dinamicamente');
    } catch (error) {
      console.error('[MetaAPI Direct] ❌ Erro ao carregar SDK:', error);
      throw error;
    }
  }
}

export interface DirectPriceData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  timestamp: number;
}

export interface DirectAccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
}

// 🔥 NOVO: Interfaces para execução de ordens
export interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  message?: string;
  price?: number;
  volume?: number;
}

export interface OrderParams {
  symbol: string;
  volume: number; // Lotes (ex: 0.01, 0.1, 1.0)
  stopLoss?: number; // Preço do Stop Loss
  takeProfit?: number; // Preço do Take Profit
  comment?: string; // Comentário da ordem
  magic?: number; // Magic number para identificação
}

export class MetaAPIDirectClient {
  private token: string;
  private api: any = null;
  private connection: any = null;
  private accountId: string | null = null;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Conecta diretamente à conta MT5
   */
  async connect(accountId: string): Promise<boolean> {
    try {
      // 🛡️ Garantir que o SDK está carregado
      await ensureMetaApiLoaded();

      console.log('[MetaAPI Direct] 🔌 Conectando à conta:', accountId);

      // Inicializar MetaAPI SDK
      this.api = new MetaApi(this.token);
      this.accountId = accountId;

      // Obter conta
      console.log('[MetaAPI Direct] 📡 Obtendo informações da conta...');
      const account = await this.api.metatraderAccountApi.getAccount(accountId);
      console.log('[MetaAPI Direct] ✅ Conta obtida:', account.id);

      // Aguardar implantação
      if (account.state !== 'DEPLOYED') {
        console.log('[MetaAPI Direct] ⏳ Aguardando implantação (state:', account.state, ')...');
        await account.deploy();
        console.log('[MetaAPI Direct] ✅ Conta implantada!');
      }

      // Aguardar conexão (COM TIMEOUT)
      if (account.connectionStatus !== 'CONNECTED') {
        console.log('[MetaAPI Direct] ⏳ Aguardando conexão (status:', account.connectionStatus, ')...');
        console.log('[MetaAPI Direct] ⚡ Timeout: 30 segundos');
        
        await Promise.race([
          account.waitConnected(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Conta não conectou em 30s')), 30000))
        ]);
        
        console.log('[MetaAPI Direct] ✅ Conta conectada!');
      }

      // Estabelecer conexão RPC
      console.log('[MetaAPI Direct] 🔗 Estabelecendo conexão RPC...');
      this.connection = account.getRPCConnection();
      await this.connection.connect();
      console.log('[MetaAPI Direct] ✅ Conexão RPC estabelecida!');
      
      // 🔥 SKIP WAITSYNCHORNIZED - Usar timeout curto
      console.log('[MetaAPI Direct] ⏳ Sincronizando dados (timeout: 10s)...');
      try {
        await Promise.race([
          this.connection.waitSynchronized(),
          new Promise((resolve) => setTimeout(resolve, 10000)) // 10s timeout, não rejeita
        ]);
        console.log('[MetaAPI Direct] ✅ Dados sincronizados!');
      } catch (syncError) {
        console.warn('[MetaAPI Direct] ⚠️ Timeout na sincronização, mas continuando...', syncError);
        // NÃO FALHAR - continuar mesmo sem sincronização completa
      }

      console.log('[MetaAPI Direct] ✅ Conectado com sucesso!');
      return true;

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ Erro ao conectar:', error);
      console.error('[MetaAPI Direct] 🔍 Stack trace:', error.stack);
      console.error('[MetaAPI Direct] 🔍 Detalhes:', {
        message: error.message,
        name: error.name,
        accountId: accountId
      });
      return false;
    }
  }

  /**
   * Obtém preços em tempo real
   */
  async getPrices(symbols: string[]): Promise<DirectPriceData[]> {
    if (!this.connection) {
      throw new Error('Conexão não estabelecida. Chame connect() primeiro.');
    }

    try {
      const prices: DirectPriceData[] = [];

      for (const symbol of symbols) {
        try {
          const price = await this.connection.getSymbolPrice(symbol);
          
          if (price) {
            prices.push({
              symbol,
              bid: price.bid || 0,
              ask: price.ask || 0,
              last: price.bid || 0, // Usar bid como last
              spread: (price.ask || 0) - (price.bid || 0),
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.warn(`[MetaAPI Direct] ⚠️ Erro ao obter preço de ${symbol}:`, error);
        }
      }

      return prices;

    } catch (error) {
      console.error('[MetaAPI Direct] ❌ Erro ao obter preços:', error);
      return [];
    }
  }

  /**
   * Obtém informações da conta
   */
  async getAccountInfo(): Promise<DirectAccountInfo | null> {
    if (!this.connection) {
      throw new Error('Conexão não estabelecida. Chame connect() primeiro.');
    }

    try {
      const accountInfo = await this.connection.getAccountInformation();

      return {
        balance: accountInfo.balance || 0,
        equity: accountInfo.equity || 0,
        margin: accountInfo.margin || 0,
        freeMargin: accountInfo.freeMargin || 0,
        leverage: accountInfo.leverage || 1,
        currency: accountInfo.currency || 'USD'
      };

    } catch (error) {
      console.error('[MetaAPI Direct] ❌ Erro ao obter info da conta:', error);
      return null;
    }
  }

  /**
   * Obtém posições abertas
   */
  async getPositions() {
    if (!this.connection) {
      throw new Error('Conexão não estabelecida. Chame connect() primeiro.');
    }

    try {
      return await this.connection.getPositions();
    } catch (error) {
      console.error('[MetaAPI Direct] ❌ Erro ao obter posições:', error);
      return [];
    }
  }

  /**
   * Desconecta
   */
  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.close();
        console.log('[MetaAPI Direct] 🔌 Desconectado');
      } catch (error) {
        console.error('[MetaAPI Direct] ❌ Erro ao desconectar:', error);
      }
    }
    this.connection = null;
    this.api = null;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔥 MÉTODOS DE EXECUÇÃO DE ORDENS REAIS
  // ═══════════════════════════════════════════════════════════════

  /**
   * 🟢 COMPRA A MERCADO (BUY MARKET ORDER)
   * Abre posição de compra imediatamente ao preço de mercado
   */
  async createMarketBuyOrder(params: OrderParams): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🟢 EXECUTANDO COMPRA A MERCADO:', params);

      const result = await this.connection.createMarketBuyOrder(
        params.symbol,
        params.volume,
        params.stopLoss,
        params.takeProfit,
        {
          comment: params.comment || 'Neural Day Trader',
          magic: params.magic || 123456
        }
      );

      console.log('[MetaAPI Direct] ✅ COMPRA EXECUTADA:', result);

      return {
        success: true,
        orderId: result.orderId,
        positionId: result.positionId,
        price: result.price,
        volume: params.volume,
        message: `Compra executada: ${params.symbol} ${params.volume} lotes`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO EXECUTAR COMPRA:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao executar compra',
        message: `Falha ao executar compra de ${params.symbol}`
      };
    }
  }

  /**
   * 🔴 VENDA A MERCADO (SELL MARKET ORDER)
   * Abre posição de venda imediatamente ao preço de mercado
   */
  async createMarketSellOrder(params: OrderParams): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🔴 EXECUTANDO VENDA A MERCADO:', params);

      const result = await this.connection.createMarketSellOrder(
        params.symbol,
        params.volume,
        params.stopLoss,
        params.takeProfit,
        {
          comment: params.comment || 'Neural Day Trader',
          magic: params.magic || 123456
        }
      );

      console.log('[MetaAPI Direct] ✅ VENDA EXECUTADA:', result);

      return {
        success: true,
        orderId: result.orderId,
        positionId: result.positionId,
        price: result.price,
        volume: params.volume,
        message: `Venda executada: ${params.symbol} ${params.volume} lotes`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO EXECUTAR VENDA:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao executar venda',
        message: `Falha ao executar venda de ${params.symbol}`
      };
    }
  }

  /**
   * 🔒 FECHAR POSIÇÃO POR ID
   * Fecha uma posição aberta pelo ID
   */
  async closePosition(positionId: string): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🔒 FECHANDO POSIÇÃO:', positionId);

      const result = await this.connection.closePosition(positionId);

      console.log('[MetaAPI Direct] ✅ POSIÇÃO FECHADA:', result);

      return {
        success: true,
        positionId: positionId,
        message: `Posição ${positionId} fechada com sucesso`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO FECHAR POSIÇÃO:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao fechar posição',
        message: `Falha ao fechar posição ${positionId}`
      };
    }
  }

  /**
   * 🔒 FECHAR POSIÇÃO PARCIALMENTE
   * Fecha apenas parte de uma posição (ex: fechar 50% da posição)
   */
  async closePositionPartially(positionId: string, volume: number): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🔒 FECHANDO POSIÇÃO PARCIALMENTE:', { positionId, volume });

      const result = await this.connection.closePositionPartially(positionId, volume);

      console.log('[MetaAPI Direct] ✅ POSIÇÃO FECHADA PARCIALMENTE:', result);

      return {
        success: true,
        positionId: positionId,
        volume: volume,
        message: `Fechado ${volume} lotes da posição ${positionId}`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO FECHAR PARCIALMENTE:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao fechar parcialmente',
        message: `Falha ao fechar parcialmente a posição ${positionId}`
      };
    }
  }

  /**
   * ⚙️ MODIFICAR POSIÇÃO (Alterar Stop Loss / Take Profit)
   * Modifica SL/TP de uma posição existente
   */
  async modifyPosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] ⚙️ MODIFICANDO POSIÇÃO:', { positionId, stopLoss, takeProfit });

      const result = await this.connection.modifyPosition(positionId, stopLoss, takeProfit);

      console.log('[MetaAPI Direct] ✅ POSIÇÃO MODIFICADA:', result);

      return {
        success: true,
        positionId: positionId,
        message: `Posição ${positionId} modificada: SL=${stopLoss || 'N/A'}, TP=${takeProfit || 'N/A'}`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO MODIFICAR POSIÇÃO:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao modificar posição',
        message: `Falha ao modificar posição ${positionId}`
      };
    }
  }

  /**
   * 🔒 FECHAR TODAS AS POSIÇÕES DE UM SÍMBOLO
   * Fecha todas as posições abertas de um símbolo específico
   */
  async closeAllPositionsBySymbol(symbol: string): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🔒 FECHANDO TODAS POSIÇÕES DE:', symbol);

      const positions = await this.getPositions();
      const symbolPositions = positions.filter((p: any) => p.symbol === symbol);

      if (symbolPositions.length === 0) {
        return {
          success: true,
          message: `Nenhuma posição aberta para ${symbol}`
        };
      }

      let closedCount = 0;
      let failedCount = 0;

      for (const position of symbolPositions) {
        try {
          await this.connection.closePosition(position.id);
          closedCount++;
          console.log(`[MetaAPI Direct] ✅ Posição ${position.id} fechada`);
        } catch (error) {
          failedCount++;
          console.error(`[MetaAPI Direct] ❌ Erro ao fechar posição ${position.id}:`, error);
        }
      }

      console.log(`[MetaAPI Direct] 📊 Resumo: ${closedCount} fechadas, ${failedCount} falharam`);

      return {
        success: failedCount === 0,
        message: `${closedCount} posições fechadas de ${symbol} (${failedCount} falharam)`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO FECHAR TODAS POSIÇÕES:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao fechar todas posições',
        message: `Falha ao fechar posições de ${symbol}`
      };
    }
  }

  /**
   * 🛑 FECHAR TODAS AS POSIÇÕES (EMERGÊNCIA)
   * Fecha TODAS as posições abertas na conta
   */
  async closeAllPositions(): Promise<TradeResult> {
    if (!this.connection) {
      return {
        success: false,
        error: 'Conexão não estabelecida. Chame connect() primeiro.'
      };
    }

    try {
      console.log('[MetaAPI Direct] 🛑 FECHANDO TODAS AS POSIÇÕES (EMERGÊNCIA)');

      const positions = await this.getPositions();

      if (positions.length === 0) {
        return {
          success: true,
          message: 'Nenhuma posição aberta'
        };
      }

      let closedCount = 0;
      let failedCount = 0;

      for (const position of positions) {
        try {
          await this.connection.closePosition(position.id);
          closedCount++;
          console.log(`[MetaAPI Direct] ✅ Posição ${position.id} fechada`);
        } catch (error) {
          failedCount++;
          console.error(`[MetaAPI Direct] ❌ Erro ao fechar posição ${position.id}:`, error);
        }
      }

      console.log(`[MetaAPI Direct] 📊 Resumo EMERGÊNCIA: ${closedCount} fechadas, ${failedCount} falharam`);

      return {
        success: failedCount === 0,
        message: `${closedCount} posições fechadas (${failedCount} falharam)`
      };

    } catch (error: any) {
      console.error('[MetaAPI Direct] ❌ ERRO AO FECHAR TODAS POSIÇÕES:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao fechar todas posições',
        message: 'Falha ao fechar todas as posições'
      };
    }
  }

  /**
   * 📊 OBTER INFORMAÇÕES DETALHADAS DE UMA POSIÇÃO
   * Retorna detalhes completos de uma posição específica
   */
  async getPositionById(positionId: string) {
    if (!this.connection) {
      throw new Error('Conexão não estabelecida. Chame connect() primeiro.');
    }

    try {
      const positions = await this.getPositions();
      return positions.find((p: any) => p.id === positionId) || null;
    } catch (error) {
      console.error('[MetaAPI Direct] ❌ Erro ao obter posição:', error);
      return null;
    }
  }
}

// Singleton para uso global
let globalClient: MetaAPIDirectClient | null = null;

export function getMetaAPIClient(token?: string): MetaAPIDirectClient {
  if (!globalClient && token) {
    globalClient = new MetaAPIDirectClient(token);
  }
  
  if (!globalClient) {
    throw new Error('MetaAPI client não inicializado. Forneça um token.');
  }
  
  return globalClient;
}

export function resetMetaAPIClient() {
  if (globalClient) {
    globalClient.disconnect();
    globalClient = null;
  }
}