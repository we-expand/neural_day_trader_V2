import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseActive } from '@/lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { isEmergencyOfflineMode } from '@/app/services/EmergencyOfflineMode';

interface AssetPrice {
  asset_symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  change_24h?: number;
  change_percent_24h?: number;
  volume?: number;
  timestamp: string;
}

interface LiquidityEvent {
  id: string;
  asset_symbol: string;
  event_type: string;
  amount?: number;
  price?: number;
  value_usd?: number;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  created_at: string;
}

interface AISignal {
  id: string;
  asset_symbol: string;
  signal_type: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  entry_price?: number;
  take_profit?: number;
  stop_loss?: number;
  timeframe?: string;
  reasoning?: string;
  created_at: string;
}

export const useSupabaseRealtime = (assets: string[] = []) => {
  const [prices, setPrices] = useState<Record<string, AssetPrice>>({});
  const [liquidityEvents, setLiquidityEvents] = useState<LiquidityEvent[]>([]);
  const [aiSignals, setAISignals] = useState<AISignal[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  // 🔥 BROADCAST CHANNELS (dedicated, subscribed once)
  const broadcastChannelsRef = useRef<{
    prices: RealtimeChannel | null;
    whales: RealtimeChannel | null;
    signals: RealtimeChannel | null;
  }>({ prices: null, whales: null, signals: null });

  // 🔥 BROADCAST: Enviar preço atualizado para TODOS os clientes
  const broadcastPrice = useCallback(async (assetPrice: AssetPrice) => {
    if (!isSupabaseActive || !supabase) return;
    
    // Use dedicated channel that's already subscribed
    const channel = broadcastChannelsRef.current.prices;
    if (!channel) {
      console.warn('[SUPABASE] ⚠️ Broadcast channel not ready yet');
      return;
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'price-update',
        payload: assetPrice
      });
      
      console.log(`[SUPABASE] 📡 Broadcast price: ${assetPrice.asset_symbol} = $${assetPrice.price}`);
    } catch (error) {
      console.error('[SUPABASE] ❌ Broadcast failed:', error);
    }
  }, []);

  // 🐋 BROADCAST: Enviar alerta de baleia
  const broadcastWhaleAlert = useCallback(async (event: Omit<LiquidityEvent, 'id' | 'created_at'>) => {
    if (!isSupabaseActive || !supabase) return;
    
    // Use dedicated channel that's already subscribed
    const channel = broadcastChannelsRef.current.whales;
    if (!channel) {
      console.warn('[SUPABASE] ⚠️ Whale broadcast channel not ready yet');
      return;
    }

    try {
      // 1. Salvar no banco
      const { data, error } = await supabase
        .from('liquidity_events')
        .insert(event)
        .select()
        .single();

      if (error) throw error;

      // 2. Broadcast para todos os clientes
      await channel.send({
        type: 'broadcast',
        event: 'whale-detected',
        payload: data
      });

      console.log(`[SUPABASE] 🐋 Whale alert broadcasted: ${event.event_type} ${event.asset_symbol}`);
      
      return data;
    } catch (error) {
      console.error('[SUPABASE] ❌ Whale alert failed:', error);
      return null;
    }
  }, []);

  // 🤖 BROADCAST: Enviar sinal de IA
  const broadcastAISignal = useCallback(async (signal: Omit<AISignal, 'id' | 'created_at'>) => {
    if (!isSupabaseActive || !supabase) return;
    
    // Use dedicated channel that's already subscribed
    const channel = broadcastChannelsRef.current.signals;
    if (!channel) {
      console.warn('[SUPABASE] ⚠️ AI signals broadcast channel not ready yet');
      return;
    }

    try {
      // 1. Salvar no banco
      const { data, error } = await supabase
        .from('ai_signals')
        .insert(signal)
        .select()
        .single();

      if (error) throw error;

      // 2. Broadcast para todos
      await channel.send({
        type: 'broadcast',
        event: 'ai-signal',
        payload: data
      });

      console.log(`[SUPABASE] 🤖 AI signal broadcasted: ${signal.signal_type} ${signal.asset_symbol}`);
      
      return data;
    } catch (error) {
      console.error('[SUPABASE] ❌ AI signal failed:', error);
      return null;
    }
  }, []);

  // 💾 SALVAR PREÇO NO BANCO (histórico)
  const savePrice = useCallback(async (assetPrice: AssetPrice) => {
    if (!isSupabaseActive || !supabase) return;

    try {
      const { error } = await supabase
        .from('asset_prices')
        .insert({
          ...assetPrice,
          source: 'binance', // ou 'mt5', 'infinox'
          timestamp: new Date().toISOString()
        });

      if (error && !error.message.includes('duplicate')) {
        console.error('[SUPABASE] ❌ Save price failed:', error);
      }
    } catch (error) {
      console.error('[SUPABASE] ❌ Save price error:', error);
    }
  }, []);

  // 🎧 SUBSCRIBE TO REALTIME UPDATES
  useEffect(() => {
    if (!isSupabaseActive || !supabase || isEmergencyOfflineMode()) {
      console.log('[SUPABASE] ⚠️ Supabase not active or offline mode enabled');
      return;
    }

    console.log('[SUPABASE] 🔌 Connecting to realtime...');
    
    // 🔥 Create dedicated broadcast channels (subscribed once, reused)
    const pricesChannel = supabase.channel('broadcast-prices');
    const whalesChannel = supabase.channel('broadcast-whales');
    const signalsChannel = supabase.channel('broadcast-signals');
    
    // Subscribe broadcast channels
    Promise.all([
      pricesChannel.subscribe(),
      whalesChannel.subscribe(),
      signalsChannel.subscribe()
    ]).then(() => {
      console.log('[SUPABASE] 🔥 Broadcast channels ready');
      broadcastChannelsRef.current = {
        prices: pricesChannel,
        whales: whalesChannel,
        signals: signalsChannel
      };
    });

    // Create main channel
    const mainChannel = supabase.channel('main-trading-channel');

    // 📡 Subscribe to price updates
    mainChannel.on('broadcast', { event: 'price-update' }, (payload) => {
      const priceData = payload.payload as AssetPrice;
      setPrices(prev => ({
        ...prev,
        [priceData.asset_symbol]: priceData
      }));
      console.log(`[SUPABASE] 📊 Price received: ${priceData.asset_symbol} = $${priceData.price}`);
    });

    // 🐋 Subscribe to whale alerts
    mainChannel.on('broadcast', { event: 'whale-detected' }, (payload) => {
      const event = payload.payload as LiquidityEvent;
      setLiquidityEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50
      console.log(`[SUPABASE] 🐋 Whale alert: ${event.event_type} ${event.asset_symbol}`);
    });

    // 🤖 Subscribe to AI signals
    mainChannel.on('broadcast', { event: 'ai-signal' }, (payload) => {
      const signal = payload.payload as AISignal;
      setAISignals(prev => [signal, ...prev].slice(0, 20)); // Keep last 20
      console.log(`[SUPABASE] 🤖 AI Signal: ${signal.signal_type} ${signal.asset_symbol}`);
    });

    // 🔄 Subscribe to database changes (INSERT events)
    mainChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'liquidity_events'
      }, (payload) => {
        const event = payload.new as LiquidityEvent;
        setLiquidityEvents(prev => [event, ...prev].slice(0, 50));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_signals'
      }, (payload) => {
        const signal = payload.new as AISignal;
        setAISignals(prev => [signal, ...prev].slice(0, 20));
      });

    // Subscribe to channel
    mainChannel.subscribe((status) => {
      console.log(`[SUPABASE] 🔌 Connection status: ${status}`);
      setIsConnected(status === 'SUBSCRIBED');
    });

    setChannel(mainChannel);

    // Cleanup
    return () => {
      console.log('[SUPABASE] 🔌 Disconnecting from realtime...');
      mainChannel.unsubscribe();
      pricesChannel.unsubscribe();
      whalesChannel.unsubscribe();
      signalsChannel.unsubscribe();
      broadcastChannelsRef.current = { prices: null, whales: null, signals: null };
    };
  }, []);

  // 📊 FETCH INITIAL DATA
  useEffect(() => {
    if (!isSupabaseActive || !supabase || assets.length === 0 || isEmergencyOfflineMode()) return;

    const fetchInitialData = async () => {
      try {
        // Fetch latest prices for assets
        const { data: pricesData } = await supabase
          .from('asset_prices')
          .select('*')
          .in('asset_symbol', assets)
          .order('timestamp', { ascending: false })
          .limit(assets.length);

        if (pricesData) {
          const pricesMap: Record<string, AssetPrice> = {};
          pricesData.forEach(price => {
            if (!pricesMap[price.asset_symbol]) {
              pricesMap[price.asset_symbol] = price;
            }
          });
          setPrices(pricesMap);
        }

        // Fetch recent liquidity events
        const { data: eventsData } = await supabase
          .from('liquidity_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (eventsData) {
          setLiquidityEvents(eventsData);
        }

        // Fetch active AI signals
        const { data: signalsData } = await supabase
          .from('ai_signals')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (signalsData) {
          setAISignals(signalsData);
        }

        console.log('[SUPABASE] ✅ Initial data loaded');
      } catch (error) {
        console.error('[SUPABASE] ❌ Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
  }, [assets]);

  return {
    prices,
    liquidityEvents,
    aiSignals,
    isConnected,
    channel,
    
    // Actions
    broadcastPrice,
    broadcastWhaleAlert,
    broadcastAISignal,
    savePrice,
  };
};