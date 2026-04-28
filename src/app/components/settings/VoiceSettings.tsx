import React, { useState } from 'react';
import { Volume2, VolumeX, User, Users, AlertCircle, Check, Mic } from 'lucide-react';
import { motion } from 'motion/react';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';

export function VoiceSettings() {
  const { voiceGender, changeVoiceGender, speak, stopSpeaking, voiceEnabled, toggleVoiceEnabled, availableVoices } = useSpeechAlert();
  const [isTesting, setIsTesting] = useState(false);

  const handleToggleVoice = () => {
    const newState = !voiceEnabled;
    toggleVoiceEnabled(newState);
    if (newState) {
      speak('Sistema de voz ativado com sucesso.', 'high');
    }
  };

  const testVoice = async (gender: 'male' | 'female') => {
    if (isTesting) return;
    setIsTesting(true);
    changeVoiceGender(gender);

    const messages = {
      male: 'Olá! Sou o assistente da Neural Day Trader. Bitcoin registrando forte movimento de alta!',
      female: 'Olá! Sou a assistente da Neural Day Trader. Detectamos grande volume institucional entrando no mercado!'
    };

    try {
      await speak(messages[gender], 'high');
    } finally {
      setTimeout(() => setIsTesting(false), 3000);
    }
  };

  const ptVoices = availableVoices.filter(v => v.lang.startsWith('pt'));
  const hasNativeVoices = availableVoices.length > 0;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
        voiceEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900 border-zinc-700'
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full ${voiceEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        <span className="text-sm text-white font-medium">
          Sistema de Voz: {voiceEnabled ? 'Ativo' : 'Desativado'}
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          {ptVoices.length > 0 ? `${ptVoices.length} vozes PT-BR disponíveis` : hasNativeVoices ? `${availableVoices.length} vozes disponíveis` : 'Vozes do navegador'}
        </span>
        <button
          onClick={handleToggleVoice}
          className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            voiceEnabled
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
        >
          {voiceEnabled ? 'Desativar' : 'Ativar'}
        </button>
      </div>

      {/* Info about browser TTS */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Mic className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-300 font-medium mb-1">Síntese de Voz via Navegador</p>
          <p className="text-xs text-blue-400/80 leading-relaxed">
            O sistema utiliza a API de síntese de voz nativa do seu navegador para narrar análises em português brasileiro em tempo real. Funciona 100% offline, sem necessidade de API key.
          </p>
        </div>
      </div>

      {/* Voice gender selector */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Gênero da Voz</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['female', 'male'] as const).map(gender => (
            <motion.button
              key={gender}
              onClick={() => testVoice(gender)}
              disabled={isTesting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-4 rounded-xl border transition-all ${
                voiceGender === gender
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              } ${isTesting ? 'opacity-50 cursor-wait' : ''}`}
            >
              {voiceGender === gender && (
                <div className="absolute top-2 right-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              )}
              <div className="text-2xl mb-2">{gender === 'female' ? '👩' : '👨'}</div>
              <div className="text-sm font-bold">{gender === 'female' ? 'Feminina' : 'Masculina'}</div>
              <div className="text-[10px] mt-0.5 opacity-60">
                {isTesting && voiceGender === gender ? 'Testando...' : 'Clique para testar'}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Available voices list */}
      {ptVoices.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Vozes PT-BR Disponíveis ({ptVoices.length})
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto">
            {ptVoices.map(v => (
              <div key={v.name} className="flex items-center gap-2 p-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
                <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-xs text-zinc-300 truncate">{v.name}</span>
                <span className="ml-auto text-[9px] font-mono text-zinc-600">{v.lang}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={stopSpeaking}
        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
      >
        <VolumeX className="w-4 h-4" />
        Parar Voz Agora
      </button>
    </div>
  );
}