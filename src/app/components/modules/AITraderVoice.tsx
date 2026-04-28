/**
 * 🎤 AI TRADER VOICE - ASSISTENTE DE VOZ PARA OPERAÇÕES
 * 
 * Sistema que narra análises detalhadas em tempo real
 * para guiar o trader durante operações ao vivo
 */

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, TrendingDown, TrendingUp, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';
import { generateAdvancedAnalysis, generateVoiceNarration, TradePosition } from '@/app/utils/advancedTradeAnalysis';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface AITraderVoiceProps {
  embedded?: boolean; // Se true, remove padding e background (para uso dentro do AI Trader)
}

export const AITraderVoice = ({ embedded = false }: AITraderVoiceProps = {}) => {
  const [isActive, setIsActive] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(68656.09); // ✅ Preço de entrada VENDA
  const [messageIndex, setMessageIndex] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('15m'); // ✅ Timeframe selecionável
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cycleCountRef = useRef(0);
  const isRunningRef = useRef(false); // ✅ Prevenir múltiplas execuções
  const abortControllerRef = useRef<AbortController | null>(null); // ✅ Controle de cancelamento
  const { speak } = useSpeechAlert({ rate: 0.85, volume: 1.0 }); // ✅ Velocidade mais natural

  // ✅ Estados do formulário manual
  const [operationType, setOperationType] = useState<'buy' | 'sell'>('sell');
  const [entryPrice, setEntryPrice] = useState('68656.09');
  const [contractSize, setContractSize] = useState('0.01');
  const [isFormVisible, setIsFormVisible] = useState(true);

  // ✅ Posição do trader - Dinâmica
  const position: TradePosition = {
    type: operationType,
    entryPrice: parseFloat(entryPrice) || 68656.09,
    currentPrice,
    symbol: 'BTC',
    timeframe
  };

  // Simulação de variação de preço realista
  useEffect(() => {
    if (!isActive) return;

    // ✅ VARIAÇÃO DE PREÇO REALISTA - BASEADO NO PREÇO ANTERIOR
    const initialPrice = parseFloat(entryPrice) || 68656.09;
    setCurrentPrice(initialPrice); // Define preço inicial
    
    priceIntervalRef.current = setInterval(() => {
      setCurrentPrice((prevPrice) => {
        // Variação pequena baseada no preço ANTERIOR (não no preço de entrada)
        const volatility = 0.00015; // 0.015% de volatilidade por segundo
        const drift = (Math.random() - 0.5) * prevPrice * volatility;
        const newPrice = prevPrice + drift;
        
        console.log('[AI TRADER VOICE] 📊 Preço atualizado:', {
          anterior: prevPrice.toFixed(2),
          novo: newPrice.toFixed(2),
          variacao: drift.toFixed(2)
        });
        
        return newPrice;
      });
    }, 1000); // ✅ A CADA 1 SEGUNDO

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };
  }, [isActive, entryPrice]); // ✅ ADICIONADO entryPrice nas dependências

  // Sistema de narração contínua
  useEffect(() => {
    if (!isActive) {
      // ✅ PARAR TUDO quando desativar
      isRunningRef.current = false;
      
      // ✅ Cancelar síntese de voz imediatamente
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // ✅ Abortar operações em andamento
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // ✅ Limpar intervalos
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
      
      console.log('[AI Trader Voice] Sistema PARADO completamente');
      return;
    }

    // Evitar múltiplas execuções
    if (isRunningRef.current) {
      console.log('[AI Trader Voice] Já está rodando, ignorando');
      return;
    }

    isRunningRef.current = true;
    abortControllerRef.current = new AbortController();
    console.log('[AI Trader Voice] Iniciando sistema');

    const runAnalysis = async () => {
      try {
        // ✅ Verificar se ainda está ativo ANTES de começar
        if (!isRunningRef.current) {
          console.log('[AI Trader Voice] Cancelado antes de iniciar');
          return;
        }

        console.log('[AI Trader Voice] Iniciando ciclo de análise', cycleCountRef.current + 1);
        
        // ✅ Gerar análise com preço atual e dados do formulário
        const analysis = generateAdvancedAnalysis({ 
          type: operationType,
          entryPrice: parseFloat(entryPrice) || 68656.09,
          currentPrice,
          symbol: 'BTC',
          timeframe
        });
        const newMessages = generateVoiceNarration({ 
          type: operationType,
          entryPrice: parseFloat(entryPrice) || 68656.09,
          currentPrice,
          symbol: 'BTC',
          timeframe
        }, analysis);
        
        setMessages(newMessages);
        setMessageIndex(0);
        cycleCountRef.current++;

        // Narrar mensagens uma por uma
        for (let i = 0; i < newMessages.length; i++) {
          // ✅ Verificar ANTES de cada narração
          if (!isRunningRef.current) {
            console.log('[AI Trader Voice] Cancelado no meio da narração');
            break;
          }
          
          try {
            await speak(newMessages[i], 'high');
            
            // ✅ Verificar DEPOIS da narração também
            if (!isRunningRef.current) break;
            
            setMessageIndex(i);
            
            // Pausa mínima entre mensagens
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error('[AI Trader Voice] Erro na narração:', error);
            if (!isRunningRef.current) break;
          }
        }

        // ✅ Verificar antes de esperar para o próximo ciclo
        if (!isRunningRef.current) {
          console.log('[AI Trader Voice] Cancelado antes de aguardar próximo ciclo');
          return;
        }

        // Aguardar 10 segundos antes do próximo ciclo
        if (cycleCountRef.current < 60) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // ✅ Verificar DEPOIS da espera
          if (isRunningRef.current) {
            runAnalysis(); // Próximo ciclo
          }
        } else {
          toast.info('Sessão de 1 hora concluída!');
          setIsActive(false);
          isRunningRef.current = false;
        }
      } catch (error) {
        console.error('[AI Trader Voice] Erro no ciclo:', error);
        isRunningRef.current = false;
      }
    };

    runAnalysis();

    // Cleanup quando desmontar ou isActive mudar
    return () => {
      console.log('[AI Trader Voice] Cleanup executado');
    };
  }, [isActive]); // ✅ CORRIGIDO: Removido currentPrice das dependências

  const handleToggle = () => {
    if (!isActive) {
      // ✅ ATIVANDO: Resetar estados
      toast.success('AI Trader Voice ativado! Iniciando análise contínua...');
      cycleCountRef.current = 0;
      setMessages([]);
      setMessageIndex(0);
      setIsActive(true);
    } else {
      // ✅ DESATIVANDO: Limpar tudo
      toast.info('AI Trader Voice pausado.');
      isRunningRef.current = false;
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      setIsActive(false);
    }
  };

  // Calcular PnL (funciona para COMPRA e VENDA)
  const pnl = position.type === 'buy' 
    ? currentPrice - position.entryPrice  // COMPRA: lucro quando preço sobe
    : position.entryPrice - currentPrice; // VENDA: lucro quando preço cai
  const pnlPercent = (pnl / position.entryPrice) * 100;
  const isProfit = pnl > 0;

  return (
    <div className={`${embedded ? 'p-0' : 'p-8'} h-full ${embedded ? 'bg-transparent' : 'bg-neutral-950'} text-white overflow-y-auto`}>
      {/* Header - Oculto quando embedded */}
      {!embedded && (
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <Mic className="w-8 h-8 text-purple-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            AI Trader Voice
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Assistente de Voz Inteligente para Operações em Tempo Real
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
            isActive
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
          }`}
        >
          {isActive ? (
            <>
              <MicOff className="w-5 h-5" />
              Pausar
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Ativar Análise
            </>
          )}
        </button>
      </div>
      )}

      {/* Header simplificado quando embedded */}
      {embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Mic className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase">AI Trader Voice</h2>
              <p className="text-xs text-slate-400">Sistema de narração inteligente para operações</p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
              isActive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
            }`}
          >
            {isActive ? (
              <>
                <MicOff className="w-4 h-4" />
                Pausar
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Ativar
              </>
            )}
          </button>
        </div>
      )}

      {/* ✅ FORMULÁRIO DE ENTRADA MANUAL */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border border-cyan-500/30 rounded-2xl p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white uppercase">Configurar Operação Manual</h3>
          </div>
          <button
            onClick={() => setIsFormVisible(!isFormVisible)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider"
          >
            {isFormVisible ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <AnimatePresence>
          {isFormVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo de Operação */}
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                    Tipo de Operação
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => !isActive && setOperationType('buy')}
                      disabled={isActive}
                      className={`py-3 px-4 rounded-lg font-bold text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                        operationType === 'buy'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      } ${isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Compra
                    </button>
                    <button
                      onClick={() => !isActive && setOperationType('sell')}
                      disabled={isActive}
                      className={`py-3 px-4 rounded-lg font-bold text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                        operationType === 'sell'
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      } ${isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Venda
                    </button>
                  </div>
                </div>

                {/* Preço de Entrada */}
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                    Preço de Entrada (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={entryPrice}
                    onChange={(e) => !isActive && setEntryPrice(e.target.value)}
                    disabled={isActive}
                    placeholder="Ex: 68656.09"
                    className={`w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all ${
                      isActive ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                {/* Tamanho do Contrato */}
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                    Tamanho do Contrato (BTC)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={contractSize}
                    onChange={(e) => !isActive && setContractSize(e.target.value)}
                    disabled={isActive}
                    placeholder="Ex: 0.01"
                    className={`w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all ${
                      isActive ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Botão de Confirmação */}
              <div className="mt-4 flex items-center justify-between p-4 bg-black/20 rounded-lg border border-cyan-500/20">
                <div className="text-sm text-neutral-400">
                  <span className="text-white font-bold">
                    {operationType === 'buy' ? '🟢 COMPRA' : '🔴 VENDA'}
                  </span>{' '}
                  em <span className="text-cyan-400 font-mono">${parseFloat(entryPrice || '0').toFixed(2)}</span>{' '}
                  • Contrato: <span className="text-purple-400 font-mono">{parseFloat(contractSize || '0').toFixed(3)} BTC</span>
                </div>
                <button
                  onClick={() => {
                    setCurrentPrice(parseFloat(entryPrice) || 68656.09);
                    toast.success('Operação configurada com sucesso!');
                  }}
                  disabled={isActive}
                  className={`px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm uppercase rounded-lg transition-all shadow-lg shadow-cyan-500/30 ${
                    isActive ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Confirmar
                </button>
              </div>

              {isActive && (
                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Pausar a análise para editar a operação
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Status da Operação */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {position.type === 'buy' ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-neutral-500 uppercase">Tipo</span>
          </div>
          <div className={`text-xl font-bold ${position.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
            {position.type === 'buy' ? 'COMPRA' : 'VENDA'}
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-neutral-500 uppercase">Entrada</span>
          </div>
          <div className="text-xl font-bold text-white">${position.entryPrice.toFixed(2)}</div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-neutral-500 uppercase">Preço Atual</span>
          </div>
          <div className="text-xl font-bold text-white">${currentPrice.toFixed(2)}</div>
        </div>

        <div className={`bg-neutral-900/50 border rounded-xl p-4 ${
          position.type === 'buy' 
            ? (pnl > 0 ? 'border-emerald-500/30' : 'border-red-500/30')
            : (pnl > 0 ? 'border-emerald-500/30' : 'border-red-500/30')
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {isProfit ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-neutral-500 uppercase">P&L</span>
          </div>
          <div className={`text-xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ✅ Seletor de Timeframe */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-neutral-500 uppercase font-bold">Tempo Gráfico</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => !isActive && setTimeframe(tf)}
              disabled={isActive}
              className={`py-2 px-4 rounded-lg font-bold text-sm uppercase transition-all ${
                timeframe === tf
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
              } ${isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tf}
            </button>
          ))}
        </div>
        {isActive && (
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Timeframe travado durante análise
          </p>
        )}
      </div>

      {/* Visualização da Narração */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-bold text-white uppercase">Análise em Tempo Real</h3>
              </div>
              <div className="text-xs text-neutral-500">
                Ciclo {cycleCountRef.current} de 60
              </div>
            </div>

            {/* Mensagem Atual */}
            <div className="bg-black/30 rounded-lg p-4 mb-4 border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Mic className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={messageIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-white text-lg leading-relaxed"
                    >
                      {messages[messageIndex] || 'Preparando análise...'}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Progresso da Análise</span>
                <span>{messageIndex + 1} / {messages.length}</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((messageIndex + 1) / messages.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Todas as Mensagens */}
      {isActive && messages.length > 0 && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            Histórico de Análises
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: idx <= messageIndex ? 1 : 0.3, x: 0 }}
                className={`p-3 rounded-lg border-l-2 transition-all ${
                  idx === messageIndex
                    ? 'border-purple-500 bg-purple-500/10'
                    : idx < messageIndex
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-neutral-700 bg-neutral-800/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-neutral-500 font-mono min-w-[30px]">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <p className="text-sm text-neutral-300 leading-relaxed">{msg}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Instruções quando inativo */}
      {!isActive && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 text-center">
          <div className="inline-block p-4 bg-purple-500/10 rounded-full mb-4">
            <Mic className="w-12 h-12 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            AI Trader Voice Inativo
          </h3>
          <p className="text-neutral-400 mb-6 max-w-2xl mx-auto">
            Clique em <strong className="text-white">"Ativar Análise"</strong> para iniciar o assistente de voz.
            A IA narrará análises detalhadas em tempo real durante 1 hora, incluindo:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto text-left">
            <div className="bg-neutral-800/50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-cyan-400 mb-2">📊 Análise Técnica</h4>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>• RSI, MACD, Bollinger Bands</li>
                <li>• Fibonacci e Suporte/Resistência</li>
                <li>• Rompimentos e Padrões</li>
              </ul>
            </div>

            <div className="bg-neutral-800/50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-purple-400 mb-2">🌊 Fluxo de Ordens</h4>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>• Pressão de compra/venda</li>
                <li>• Distribuição institucional</li>
                <li>• Atividade de baleias</li>
              </ul>
            </div>

            <div className="bg-neutral-800/50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-amber-400 mb-2">⚡ Volatilidade & Risco</h4>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>• Nível de volatilidade atual</li>
                <li>• Gerenciamento de risco</li>
                <li>• Stops e alvos sugeridos</li>
              </ul>
            </div>

            <div className="bg-neutral-800/50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-emerald-400 mb-2">🎯 Sugestões Operacionais</h4>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>• Aumentar/reduzir posição</li>
                <li>• Hedge estratégico</li>
                <li>• Detecção de manipulação</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <h4 className="text-sm font-bold text-amber-400 mb-1">Sua Operação Configurada</h4>
                <p className="text-xs text-neutral-400">
                  <strong className="text-white">{position.type === 'buy' ? 'COMPRA' : 'VENDA'} em BTC</strong> • Entrada: <strong className="text-cyan-400">${position.entryPrice.toFixed(2)}</strong> • Contrato: <strong className="text-purple-400">{parseFloat(contractSize).toFixed(3)}</strong>
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  O sistema analisará esta operação em tempo real e te guiará com coordenadas precisas
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};