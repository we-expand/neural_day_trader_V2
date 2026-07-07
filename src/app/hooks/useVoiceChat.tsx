import { useState, useRef, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { useTradingContext } from '@/app/contexts/TradingContext';
import { useMarketContext } from '@/app/contexts/MarketContext';
import { BreakoutDetector } from '@/app/services/BreakoutDetector';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  emotion?: 'neutral' | 'excited' | 'worried' | 'supportive' | 'celebratory';
  timestamp: Date;
}

interface VoiceChatOptions {
  voiceGender?: 'male' | 'female';
  autoSpeak?: boolean;
}

export function useVoiceChat(options: VoiceChatOptions = {}) {
  const { voiceGender = 'female', autoSpeak = true } = options;
  
  // 🔥 INTEGRAÇÃO COM CONTEXTOS DA PLATAFORMA
  const tradingContext = useTradingContext();
  const marketContext = useMarketContext();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🧠 CONSTRUIR CONTEXTO INTELIGENTE DA PLATAFORMA
  const buildPlatformContext = useCallback(() => {
    try {
      // Pegar posições abertas
      const positions = tradingContext?.activeOrders?.map(order => ({
        symbol: order.symbol,
        type: order.type,
        size: order.size,
        entryPrice: order.entryPrice,
        currentPrice: order.currentPrice,
        unrealizedPnL: order.unrealizedPnL,
        openTime: order.timestamp
      })) || [];

      // Pegar dados de mercado
      const marketData = {
        selectedAsset: tradingContext?.selectedAsset || 'EURUSD',
        prices: marketContext?.marketState?.prices || {},
        vix: marketContext?.marketState?.vix || null,
        marketStatus: marketContext?.marketState?.status || 'unknown'
      };

      // Pegar performance do usuário
      const performance = {
        totalPnL: tradingContext?.portfolio?.unrealizedPnL || 0,
        balance: tradingContext?.portfolio?.balance || 0,
        equity: tradingContext?.portfolio?.equity || 0,
        winRate: tradingContext?.houseStats?.winRate || 0,
        tradesCount: (tradingContext?.tradeHistory?.length || 0) + (tradingContext?.activeOrders?.length || 0)
      };

      // Pegar alertas recentes (últimos 5 logs)
      const recentAlerts = tradingContext?.recentLogs?.slice(-5) || [];

      // 🚀 NOVO: Pegar sinais de breakout ativos
      const breakoutSignals = BreakoutDetector.getRecentSignals('BTCUSDT');

      const context = {
        positions,
        marketData,
        performance,
        recentAlerts,
        currentAsset: tradingContext?.selectedAsset,
        userProfile: {
          riskProfile: tradingContext?.riskProfile || 'moderado'
        },
        breakoutSignals // Adicionar breakouts ao contexto
      };

      console.log('[VOICE CHAT] 🧠 Contexto da plataforma:', context);
      return context;
    } catch (error) {
      console.error('[VOICE CHAT] ❌ Erro ao construir contexto:', error);
      return {};
    }
  }, [tradingContext, marketContext]);

  // 🎤 INICIAR GRAVAÇÃO DE VOZ
  const startListening = useCallback(async () => {
    try {
      console.log('[VOICE CHAT] 🎤 Iniciando gravação...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VOICE CHAT] 🎤 Gravação finalizada, processando...');
        await processRecording();
        
        // Parar tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);

    } catch (error) {
      console.error('[VOICE CHAT] ❌ Erro ao acessar microfone:', error);
      alert('Erro ao acessar microfone. Verifique as permissões do navegador.');
    }
  }, []);

  // 🛑 PARAR GRAVAÇÃO
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      console.log('[VOICE CHAT] 🛑 Parando gravação...');
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsListening(false);
    }
  }, [isListening]);

  // 🔄 PROCESSAR GRAVAÇÃO
  const processRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('[VOICE CHAT] ⚠️ Nenhum áudio gravado');
      return;
    }

    setIsProcessing(true);

    try {
      // Criar blob do áudio
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      console.log('[VOICE CHAT] 📦 Áudio gravado:', audioBlob.size, 'bytes');

      // Converter para base64
      const audioBase64 = await blobToBase64(audioBlob);

      // 1️⃣ TRANSCREVER ÁUDIO (STT)
      console.log('[VOICE CHAT] 📝 Transcrevendo...');
      const transcriptResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/stt/transcribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ audioBase64 })
        }
      );

      if (!transcriptResponse.ok) {
        throw new Error('Erro ao transcrever áudio');
      }

      const transcriptData = await transcriptResponse.json();
      
      if (!transcriptData.success || !transcriptData.transcript) {
        console.log('[VOICE CHAT] ⚠️ Nenhuma fala detectada');
        setIsProcessing(false);
        return;
      }

      const userMessage = transcriptData.transcript;
      console.log('[VOICE CHAT] ✅ Transcrição:', userMessage);

      // Adicionar mensagem do usuário
      const userMsgId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: userMsgId,
        type: 'user',
        text: userMessage,
        timestamp: new Date()
      }]);

      // 2️⃣ PROCESSAR PERGUNTA (Chat)
      console.log('[VOICE CHAT] 🤖 Processando pergunta...');
      const chatResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/assistant/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            question: userMessage,
            context: buildPlatformContext() // TODO: Adicionar contexto da plataforma
          })
        }
      );

      if (!chatResponse.ok) {
        throw new Error('Erro ao processar pergunta');
      }

      const chatData = await chatResponse.json();
      const assistantMessage = chatData.response;
      const emotion = chatData.emotion || 'neutral';
      
      console.log('[VOICE CHAT] ✅ Resposta:', assistantMessage);

      // Adicionar mensagem da assistente
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        type: 'assistant',
        text: assistantMessage,
        emotion: emotion,
        timestamp: new Date()
      }]);

      // 3️⃣ SINTETIZAR VOZ (TTS) - se autoSpeak ativado
      if (autoSpeak) {
        await speakResponse(assistantMessage);
      }

    } catch (error) {
      console.error('[VOICE CHAT] ❌ Erro ao processar:', error);
      
      // Adicionar mensagem de erro
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        text: 'Desculpa, tive um problema ao processar sua fala. Pode tentar de novo?',
        emotion: 'worried',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [autoSpeak, buildPlatformContext]);

  // 🔊 FALAR RESPOSTA
  const speakResponse = useCallback(async (text: string) => {
    // 🔧 NOVO: Parar qualquer áudio anterior ANTES de começar novo
    if (audioRef.current) {
      console.log('[VOICE CHAT] 🛑 Parando áudio anterior antes de iniciar novo');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsSpeaking(true);

    try {
      console.log('[VOICE CHAT] 🔊 Sintetizando voz...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/tts/synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            text: text,
            voiceGender: voiceGender
          })
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao sintetizar voz');
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error('Resposta sem audioContent');
      }

      // Reproduzir áudio
      const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        console.log('[VOICE CHAT] 🎵 Reprodução finalizada');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('[VOICE CHAT] ❌ Erro ao reproduzir:', error);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      await audio.play();
      console.log('[VOICE CHAT] 🔊 Reproduzindo...');

    } catch (error) {
      console.error('[VOICE CHAT] ❌ Erro ao falar:', error);
      setIsSpeaking(false);
    }
  }, [voiceGender]);

  // 📝 ENVIAR MENSAGEM DE TEXTO (sem voz)
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Adicionar mensagem do usuário
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: userMsgId,
      type: 'user',
      text: text,
      timestamp: new Date()
    }]);

    setIsProcessing(true);

    try {
      // Processar pergunta
      const chatResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/assistant/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            question: text,
            context: buildPlatformContext()
          })
        }
      );

      if (!chatResponse.ok) {
        throw new Error('Erro ao processar pergunta');
      }

      const chatData = await chatResponse.json();
      
      // Adicionar mensagem da assistente
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        type: 'assistant',
        text: chatData.response,
        emotion: chatData.emotion || 'neutral',
        timestamp: new Date()
      }]);

      // Falar resposta se autoSpeak
      if (autoSpeak) {
        await speakResponse(chatData.response);
      }

    } catch (error) {
      console.error('[VOICE CHAT] ❌ Erro ao enviar mensagem:', error);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        text: 'Ops, tive um problema. Pode tentar de novo?',
        emotion: 'worried',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [autoSpeak, speakResponse, buildPlatformContext]);

  // 🗑️ LIMPAR CONVERSA
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // 🛑 PARAR FALA
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    startListening,
    stopListening,
    sendTextMessage,
    speakResponse,
    stopSpeaking,
    clearMessages
  };
}

// 🎯 HELPERS

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}