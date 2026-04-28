import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Sparkles, X } from 'lucide-react';
import { useVoiceChat } from '@/app/hooks/useVoiceChat';

interface NeuralAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NeuralAssistant({ isOpen, onClose }: NeuralAssistantProps) {
  const [textInput, setTextInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  
  // ⭐ CORREÇÃO: Garantir que voiceGender seja sempre 'male' ou 'female'
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>(() => {
    const saved = localStorage.getItem('neural_voice_gender');
    // Validação estrita
    if (saved === 'male' || saved === 'female') {
      return saved;
    }
    // Default é female
    return 'female';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    startListening,
    stopListening,
    sendTextMessage,
    stopSpeaking,
    clearMessages
  } = useVoiceChat({ voiceGender, autoSpeak });

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = () => {
    if (textInput.trim()) {
      sendTextMessage(textInput);
      setTextInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleVoiceGender = () => {
    const newGender = voiceGender === 'female' ? 'male' : 'female';
    console.log('[NEURAL] 🔄 Alternando voz:', { de: voiceGender, para: newGender });
    setVoiceGender(newGender);
    localStorage.setItem('neural_voice_gender', newGender);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:h-[700px] bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] border-2 border-purple-500/30 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-6 py-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: 'reverse'
                    }}
                    className="text-4xl"
                  >
                    🌙
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Luna
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </h2>
                    <p className="text-xs text-purple-300">Sua melhor amiga do trade</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle Auto-speak */}
                  <button
                    onClick={() => setAutoSpeak(!autoSpeak)}
                    className={`p-2 rounded-lg transition-colors ${
                      autoSpeak ? 'bg-purple-600/30 text-purple-400' : 'bg-white/5 text-slate-500'
                    }`}
                    title={autoSpeak ? 'Desativar respostas em voz' : 'Ativar respostas em voz'}
                  >
                    {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  {/* Toggle Voice Gender */}
                  <button
                    onClick={toggleVoiceGender}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-bold text-white"
                    title="Alternar voz"
                  >
                    {voiceGender === 'female' ? '♀️' : '♂️'}
                  </button>

                  {/* Clear Chat */}
                  <button
                    onClick={clearMessages}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-400"
                    title="Limpar conversa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Close */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              {(isListening || isSpeaking || isProcessing) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-2 text-xs"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full ${
                      isListening ? 'bg-red-500' : isSpeaking ? 'bg-purple-500' : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-white font-medium">
                    {isListening && 'Ouvindo você...'}
                    {isSpeaking && 'Luna está falando...'}
                    {isProcessing && 'Processando...'}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <motion.div
                    animate={{
                      y: [0, -10, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: 'reverse'
                    }}
                    className="text-6xl mb-6"
                  >
                    🌙
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">Oi! Eu sou a Luna!</h3>
                  <p className="text-slate-400 leading-relaxed mb-6">
                    Sua melhor amiga no mundo do trading. Pode me perguntar qualquer coisa sobre o mercado,
                    suas posições, estratégias ou pedir conselhos. Estou aqui pra te ajudar!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => sendTextMessage('Olá Luna!')}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-colors"
                    >
                      Dizer olá 👋
                    </button>
                    <button
                      onClick={() => sendTextMessage('Como estão minhas posições?')}
                      className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-colors"
                    >
                      Minhas posições 📊
                    </button>
                    <button
                      onClick={() => sendTextMessage('Analise o mercado pra mim')}
                      className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-sm text-green-300 transition-colors"
                    >
                      Analisar mercado 📈
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                          : 'bg-white/5 border border-white/10 text-slate-200'
                      }`}
                    >
                      {message.type === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🌙</span>
                          <span className="text-xs font-bold text-purple-400">Luna</span>
                          {message.emotion && message.emotion !== 'neutral' && (
                            <span className="text-xs">
                              {message.emotion === 'excited' && '😊'}
                              {message.emotion === 'worried' && '😟'}
                              {message.emotion === 'supportive' && '🤗'}
                              {message.emotion === 'celebratory' && '🎉'}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                      <div className="mt-2 text-xs opacity-50">
                        {message.timestamp.toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>

                      {/* 🔥 NOVO: Sugestões Conversacionais */}
                      {message.type === 'assistant' && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                          <p className="text-xs text-purple-300 font-semibold mb-2">💬 Continue a conversa:</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => sendTextMessage('Me fala mais sobre isso')}
                              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-xs text-purple-300 transition-colors"
                            >
                              Me fala mais 🗣️
                            </button>
                            <button
                              onClick={() => sendTextMessage('E como fica meu risco nisso?')}
                              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 transition-colors"
                            >
                              E o risco? 🛡️
                            </button>
                            <button
                              onClick={() => sendTextMessage('O que você recomenda agora?')}
                              className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs text-green-300 transition-colors"
                            >
                              Recomenda algo? 🎯
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-6 py-4 bg-gradient-to-t from-black/50 to-transparent border-t border-white/10">
              <div className="flex items-end gap-3">
                {/* Voice Button */}
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  disabled={isProcessing || isSpeaking}
                  className={`shrink-0 p-4 rounded-2xl transition-all ${
                    isListening
                      ? 'bg-red-600 scale-110 shadow-lg shadow-red-500/50'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Segurar para falar"
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </button>

                {/* Text Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isProcessing || isListening}
                    placeholder="Digite ou segure o microfone para falar..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendText}
                  disabled={!textInput.trim() || isProcessing || isListening}
                  className="shrink-0 p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Enviar mensagem"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="mt-3 text-xs text-center text-slate-500">
                Segure o microfone para falar ou digite sua mensagem
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}