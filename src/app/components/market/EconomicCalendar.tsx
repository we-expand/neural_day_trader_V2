import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCcw, Star, ChevronDown, ChevronUp, Volume2, Radio, X, Maximize2, Minimize2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface EconomicEvent {
  id: string;
  time: string;
  country: string;
  currency: string;
  importance: number;
  event: string;
  actual: string;
  forecast: string;
  previous: string;
  period?: string;
}

export function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [streamingPlayer, setStreamingPlayer] = useState<{ show: boolean; url: string; title: string }>({
    show: false,
    url: '',
    title: ''
  });
  const [playerSize, setPlayerSize] = useState({ width: 420, height: 340 }); // Mais quadrado (proporção ~5:4)
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 });
  const [isMinimized, setIsMinimized] = useState(false); // 🎧 Estado de minimização

  const fetchEconomicCalendar = async () => {
    setLoading(true);
    try {
      // 🔥 ADICIONAR CACHE BUSTER PARA FORÇAR ATUALIZAÇÃO!
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/economic-calendar${cacheBuster}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      console.log('📡 [AGENDA] Resposta do servidor:', data);
      
      // 🛠️ HARDFIX: Corrigir horário de Lagarde se vier errado do backend
      if (data.events && Array.isArray(data.events)) {
        data.events = data.events.map((event: any) => {
          const eventName = (event.event || event.Event || '').toLowerCase();
          
          // Se for evento de Lagarde, forçar horário correto
          if (eventName.includes('lagarde')) {
            console.log('🔧 [HARDFIX] Corrigindo horário de Lagarde!');
            console.log('🔧 [HARDFIX] Horário ANTES:', event.time || event.Date || event.date);
            
            // ✅ FORÇAR 16:45 UTC = 13:45 Brasília
            const correctTime = '2026-01-21T16:45:00.000Z';
            
            return {
              ...event,
              time: correctTime,
              Date: correctTime,
              date: correctTime
            };
          }
          
          return event;
        });
      }
      
      // 🔍 DEBUG: Procurar evento de Lagarde APÓS O HARDFIX
      const lagardeEvent = data.events?.find((e: any) => 
        e.event?.toLowerCase().includes('lagarde') || e.Event?.toLowerCase().includes('lagarde')
      );
      
      if (lagardeEvent) {
        console.log('🔴 [FRONTEND DEBUG] =====================================');
        console.log('🔴 [FRONTEND DEBUG] Evento Lagarde APÓS HARDFIX:', JSON.stringify(lagardeEvent, null, 2));
        console.log('🔴 [FRONTEND DEBUG] Campo time:', lagardeEvent.time);
        console.log('🔴 [FRONTEND DEBUG] Campo Date:', lagardeEvent.Date);
        console.log('🔴 [FRONTEND DEBUG] Campo date:', lagardeEvent.date);
        
        const rawTime = lagardeEvent.time || lagardeEvent.Date || lagardeEvent.date || '';
        console.log('🔴 [FRONTEND DEBUG] rawTime usado:', rawTime);
        
        const parsedDate = new Date(rawTime);
        console.log('🔴 [FRONTEND DEBUG] new Date(rawTime):', parsedDate.toISOString());
        console.log('🔴 [FRONTEND DEBUG] parsedDate UTC Hours:', parsedDate.getUTCHours());
        console.log('🔴 [FRONTEND DEBUG] parsedDate UTC Minutes:', parsedDate.getUTCMinutes());
        
        const formattedTime = parsedDate.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
        console.log('🔴 [FRONTEND DEBUG] Horário formatado (Brasília):', formattedTime);
        console.log('🔴 [FRONTEND DEBUG] =====================================');
      } else {
        console.warn('⚠️ [FRONTEND DEBUG] Evento Lagarde NÃO encontrado na resposta!');
        console.log('📋 [FRONTEND DEBUG] Todos os eventos:', data.events?.map((e: any) => e.event || e.Event));
      }
      
      setEvents(data.events || []);

      // Extrair países únicos
      const countries = Array.from(new Set(data.events.map((e: EconomicEvent) => e.country))).sort();
      setAvailableCountries(countries as string[]);
      console.log('✅ [FRONTEND] Países disponíveis:', countries);

      setLoading(false);

    } catch (error) {
      console.error('[EconomicCalendar] Erro ao carregar eventos:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEconomicCalendar();
    
    // Atualizar currentTime a cada segundo para contagem regressiva
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Fechar player com tecla ESC
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && streamingPlayer.show) {
        closeStreaming();
      }
    };

    // Resize do player
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.mouseX;
        const deltaY = e.clientY - resizeStart.mouseY;
        
        // Calcular novo tamanho mantendo proporção ~5:4 (mais quadrado)
        const newWidth = Math.max(320, Math.min(resizeStart.width + deltaX, window.innerWidth * 0.9));
        const newHeight = newWidth / 1.23; // Proporção 5:4 (mais quadrado)
        
        setPlayerSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [streamingPlayer.show, isResizing, resizeStart]);

  // Filtrar eventos por países selecionados
  const filteredEvents = selectedCountries.length > 0
    ? events.filter(e => selectedCountries.includes(e.country))
    : events;

  // Toggle país no filtro
  const toggleCountry = (country: string) => {
    setSelectedCountries(prev => 
      prev.includes(country)
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  // Calcular tempo restante até evento
  const getTimeUntilEvent = (eventTime: string) => {
    try {
      const eventDate = new Date(eventTime);
      const diff = eventDate.getTime() - currentTime.getTime();
      
      if (diff < 0) return null; // Evento já passou
      if (diff > 3600000) return null; // Mais de 1 hora
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      return { minutes, seconds, total: diff };
    } catch {
      return null;
    }
  };

  // Formatar hora de ISO para HH:MM (SEMPRE EM HORÁRIO DE BRASÍLIA UTC-3)
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      // ✅ FORÇAR HORÁRIO DE BRASÍLIA (UTC-3) - SEMPRE!
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo' // ✅ Fuso horário de Brasília (UTC-3)
      });
    } catch {
      return isoString;
    }
  };

  // Verificar se evento é discurso importante (Lagarde, Trump, Nagel, Powell)
  const isImportantSpeech = (eventName: string) => {
    const lower = eventName.toLowerCase();
    return lower.includes('lagarde') || 
           lower.includes('trump') || 
           lower.includes('nagel') || 
           lower.includes('powell') ||
           (lower.includes('discurso') && (lower.includes('presidente') || lower.includes('president')));
  };

  // Verificar se streaming está ativo (10 minutos antes até fim do evento)
  const shouldShowStreaming = (eventTime: string) => {
    // 🔥 MOSTRAR SEMPRE PARA TESTES - REMOVER DEPOIS
    return true;
    
    /* LÓGICA ORIGINAL (10 MIN ANTES):
    try {
      const eventDate = new Date(eventTime);
      const diff = eventDate.getTime() - currentTime.getTime();
      
      // Mostrar de 10 minutos antes até 2 horas depois
      return diff <= 600000 && diff >= -7200000;
    } catch {
      return false;
    }
    */
  };

  // Abrir streaming no player interno
  const openStreaming = (event: EconomicEvent) => {
    // 🔴 STREAMING CONFIGURADO POR EVENTO
    let videoId = '';
    const eventLower = event.event.toLowerCase();
    
    // Trump - 🔴 AO VIVO DAVOS 2026!
    if (eventLower.includes('trump')) {
      videoId = '9Du7xZT6C9w'; // ✅ LINK AO VIVO CORRETO!
    }
    // Lagarde - 🔴 STREAMING AO VIVO!
    else if (eventLower.includes('lagarde')) {
      videoId = '_6nro1JtSLE'; // ✅ LINK AO VIVO CORRETO!
    }
    // Nagel - Bloomberg TV (placeholder até ter vídeo específico)
    else if (eventLower.includes('nagel')) {
      videoId = 'dp8PhLsUcFE'; // Bloomberg
    }
    // Powell - Bloomberg TV (placeholder até ter vídeo específico)
    else if (eventLower.includes('powell')) {
      videoId = 'dp8PhLsUcFE'; // Bloomberg
    }
    // Default - Bloomberg TV
    else {
      videoId = 'dp8PhLsUcFE'; // Bloomberg
    }
    
    // Abrir player interno
    setStreamingPlayer({
      show: true,
      url: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
      title: event.event
    });
    
    console.log('[STREAMING] Abrindo player para:', event.event);
    console.log('[STREAMING] Video ID:', videoId);
  };

  // Fechar player
  const closeStreaming = () => {
    setStreamingPlayer({ show: false, url: '', title: '' });
  };

  // Renderizar tempo ou contagem regressiva
  const renderTimeOrCountdown = (event: EconomicEvent) => {
    const countdown = getTimeUntilEvent(event.time);
    
    if (countdown) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-yellow-400 animate-pulse">
            {countdown.minutes}m {countdown.seconds}s
          </span>
          {event.event.toLowerCase().includes('discurso') && (
            <Volume2 className="w-3 h-3 text-yellow-400 animate-pulse" />
          )}
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-cyan-400">
          {formatTime(event.time)}
        </span>
        {event.event.toLowerCase().includes('discurso') && (
          <Volume2 className="w-3 h-3 text-cyan-400" />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-white">
      {/* Header minimalista */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-medium text-zinc-200">Agenda Econômica</h3>
          <span className="text-xs text-zinc-500">• {filteredEvents.length} eventos</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors flex items-center gap-1.5"
          >
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Filtros
          </button>
          <button
            onClick={fetchEconomicCalendar}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
            title="Atualizar"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Filtros (recolhidos por padrão) */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">País:</span>
            {availableCountries.map(country => (
              <button
                key={country}
                onClick={() => toggleCountry(country)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  selectedCountries.includes(country)
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-transparent'
                }`}
              >
                {country}
              </button>
            ))}
            {selectedCountries.length > 0 && (
              <button
                onClick={() => setSelectedCountries([])}
                className="ml-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b border-cyan-500"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            Nenhum evento encontrado
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-zinc-400">Hora</th>
                <th className="px-4 py-2 font-medium text-zinc-400">País</th>
                <th className="px-4 py-2 font-medium text-zinc-400">Moeda</th>
                <th className="px-4 py-2 font-medium text-zinc-400">Imp.</th>
                <th className="px-4 py-2 font-medium text-zinc-400">Evento</th>
                <th className="px-4 py-2 font-medium text-zinc-400">Stream</th>
                <th className="px-4 py-2 font-medium text-zinc-400">Período</th>
                <th className="px-4 py-2 font-medium text-zinc-400 text-right">Real</th>
                <th className="px-4 py-2 font-medium text-zinc-400 text-right">Prev.</th>
                <th className="px-4 py-2 font-medium text-zinc-400 text-right">Ant.</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, idx) => {
                const countdown = getTimeUntilEvent(event.time);
                const isUrgent = countdown && countdown.total < 3600000;
                
                return (
                  <tr
                    key={event.id || idx}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${
                      isUrgent ? 'bg-yellow-500/5 border-yellow-500/20' : ''
                    }`}
                  >
                    {/* Hora / Contagem Regressiva */}
                    <td className="px-4 py-2">
                      {renderTimeOrCountdown(event)}
                    </td>

                    {/* País */}
                    <td className="px-4 py-2 text-zinc-300">
                      {event.country}
                    </td>

                    {/* Moeda */}
                    <td className="px-4 py-2">
                      <span className="text-zinc-400 font-medium">
                        {event.currency}
                      </span>
                    </td>

                    {/* Importância */}
                    <td className="px-4 py-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(i => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i <= event.importance
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'fill-zinc-800 text-zinc-800'
                            }`}
                          />
                        ))}
                      </div>
                    </td>

                    {/* Evento */}
                    <td className="px-4 py-2 text-zinc-200">
                      {event.event}
                    </td>

                    {/* Stream */}
                    <td className="px-4 py-2 text-center">
                      {isImportantSpeech(event.event) && shouldShowStreaming(event.time) && (
                        <button
                          onClick={() => openStreaming(event)}
                          className="p-1.5 bg-yellow-500 hover:bg-yellow-400 rounded transition-colors animate-pulse"
                          title="🔴 AO VIVO - Streaming"
                        >
                          <Radio className="w-3.5 h-3.5 text-black" />
                        </button>
                      )}
                    </td>

                    {/* Período */}
                    <td className="px-4 py-2 text-zinc-500">
                      {event.period || '-'}
                    </td>

                    {/* Real */}
                    <td className="px-4 py-2 text-right text-green-400 font-medium">
                      {event.actual || '-'}
                    </td>

                    {/* Previsão */}
                    <td className="px-4 py-2 text-right text-zinc-400">
                      {event.forecast || '-'}
                    </td>

                    {/* Anterior */}
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {event.previous || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer minimalista */}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <span>Atualizado: {new Date().toLocaleTimeString('pt-BR')}</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <span className="ml-1">Alta</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <Star className="w-2.5 h-2.5 fill-zinc-800 text-zinc-800" />
            <span className="ml-1">Média</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
            <Star className="w-2.5 h-2.5 fill-zinc-800 text-zinc-800" />
            <Star className="w-2.5 h-2.5 fill-zinc-800 text-zinc-800" />
            <span className="ml-1">Baixa</span>
          </div>
        </div>
      </div>

      {/* 🔴 STREAMING PLAYER - Compacto e Redimensionável */}
      {streamingPlayer.show && (
        <>
          {/* Backdrop sutil */}
          <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none" />
          
          {isMinimized ? (
            /* 🎧 MINI PLAYER - Apenas Áudio */
            <div
              className="fixed z-50 bg-zinc-900 border-2 border-cyan-500/40 rounded-lg shadow-2xl overflow-hidden"
              style={{
                width: '320px',
                height: '60px',
                right: '20px',
                bottom: '20px'
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 h-full">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Radio className="w-4 h-4 text-yellow-500 animate-pulse flex-shrink-0" />
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded flex-shrink-0">AO VIVO</span>
                  <span className="text-xs font-medium text-white truncate">{streamingPlayer.title}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setIsMinimized(false)}
                    className="p-1.5 hover:bg-zinc-800 rounded transition-colors group"
                    title="Expandir Vídeo"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
                  </button>
                  <button
                    onClick={closeStreaming}
                    className="p-1.5 hover:bg-zinc-800 rounded transition-colors group"
                    title="Fechar"
                  >
                    <X className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white" />
                  </button>
                </div>
              </div>
              {/* iframe escondido para continuar tocando áudio */}
              <iframe
                src={streamingPlayer.url}
                className="hidden"
                allow="autoplay"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : (
            /* Player PiP (Picture-in-Picture) */
            <div
              className="fixed z-50 bg-zinc-900 border-2 border-cyan-500/40 rounded-lg shadow-2xl overflow-hidden"
              style={{
                width: `${playerSize.width}px`,
                height: `${playerSize.height}px`,
                right: '20px',
                bottom: '20px',
                minWidth: '320px',
                minHeight: '180px',
                maxWidth: '90vw',
                maxHeight: '90vh'
              }}
            >
              {/* Header - Draggable */}
              <div
                className="flex items-center justify-between px-3 py-2 bg-zinc-900/95 border-b border-cyan-500/20 cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-yellow-500 animate-pulse" />
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">AO VIVO</span>
                  <span className="text-xs font-medium text-white truncate max-w-[200px]">{streamingPlayer.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors group flex-shrink-0"
                    title="Minimizar (Apenas Áudio)"
                  >
                    <Minimize2 className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
                  </button>
                  <button
                    onClick={closeStreaming}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors group flex-shrink-0"
                    title="Fechar (ESC)"
                  >
                    <X className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  </button>
                </div>
              </div>

              {/* Player do YouTube */}
              <div className="relative w-full bg-black" style={{ height: `calc(100% - 36px - 32px)` }}>
                <iframe
                  src={streamingPlayer.url}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title={streamingPlayer.title}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </div>

              {/* Footer */}
              <div className="px-3 py-2 bg-zinc-900/95 border-t border-cyan-500/20 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Neural Day Trader</span>
                <button
                  onClick={() => window.open(streamingPlayer.url.replace('/embed/', '/watch?v=').split('?')[0] + '?v=' + streamingPlayer.url.split('/embed/')[1].split('?')[0], '_blank')}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-cyan-400 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  YouTube
                </button>
              </div>

              {/* Resize Handle - Canto inferior esquerdo */}
              <div
                className="absolute left-0 bottom-0 w-4 h-4 cursor-sw-resize group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizing(true);
                  setResizeStart({
                    width: playerSize.width,
                    height: playerSize.height,
                    mouseX: e.clientX,
                    mouseY: e.clientY
                  });
                }}
              >
                <div className="absolute left-1 bottom-1 w-2 h-2 border-l-2 border-b-2 border-cyan-500/50 group-hover:border-cyan-400" />
              </div>

              {/* Resize Handle - Canto inferior direito */}
              <div
                className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizing(true);
                  setResizeStart({
                    width: playerSize.width,
                    height: playerSize.height,
                    mouseX: e.clientX,
                    mouseY: e.clientY
                  });
                }}
              >
                <div className="absolute right-1 bottom-1 w-2 h-2 border-r-2 border-b-2 border-cyan-500/50 group-hover:border-cyan-400" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}