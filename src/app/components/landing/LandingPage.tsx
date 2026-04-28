import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Brain, Zap, Lock, ChevronDown } from 'lucide-react';
import { PricingSection } from './Pricing';
import { translations, Language } from './translations';
import { NeuralLogo } from '../BrandLogo';
// import { downloadProposalAsDoc } from '../../utils/generateProposal'; // ❌ REMOVIDO - Causando erro

const rotatingText = [
  "Sinais Quantitativos.",
  "Trading Algorítmico.", // ✅ MUDADO: Arbitragem HF → Trading Algorítmico (preciso!)
  "Inteligência de Mercado.",
  "Execução Quântica.", // ✅ ATUALIZADO: Auto-Execução Rápida → Execução Quântica (sofisticado!)
  "Poder Institucional."
];

const MagneticCycleTitle = () => {
  const [phrases] = useState(() => {
    // Shuffle phrases on mount to ensure randomness without repetition in session
    const p = [...rotatingText];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  });
  
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Inicia a transição de saída
      setIsTransitioning(true);
      
      // Após 400ms (tempo do fade out), troca o texto
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % phrases.length);
        setIsTransitioning(false);
      }, 400);
    }, 4500);
    return () => clearInterval(interval);
  }, [phrases]);

  const currentPhrase = phrases[index];

  return (
    <div className="h-40 flex items-center justify-center relative z-20 overflow-visible mb-8">
      <div 
        className={`text-6xl md:text-8xl font-bold tracking-tighter text-center transition-all duration-700 ease-in-out ${
          isTransitioning 
            ? 'opacity-0 scale-95 blur-sm' 
            : 'opacity-100 scale-100 blur-0'
        }`}
      >
        <span className="bg-gradient-to-r from-emerald-400 via-blue-500 to-emerald-400 text-transparent bg-clip-text">
          {currentPhrase}
        </span>
      </div>
    </div>
  );
};

export const LandingPage = ({ onLoginClick, lang, setLang }: { onLoginClick: () => void; lang: Language; setLang: (l: Language) => void }) => {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, 100]);
  const t = translations[lang];

  // Intro Blackout State
  const [showIntro, setShowIntro] = useState(true);

  return (
    <div className="relative w-full min-h-screen text-white overflow-x-hidden bg-black">
      {/* Intro Blackout Overlay */}
      <motion.div
        className="fixed inset-0 z-[100] bg-black pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
        onAnimationComplete={() => setShowIntro(false)}
      />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex-1 flex justify-center md:justify-start">
            <NeuralLogo size="md" variant="icon-only" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#infrastructure" className="hover:text-white transition-colors">{t.nav.protocol}</a>
            <a href="#neural" className="hover:text-white transition-colors">{t.nav.intelligence}</a>
            <a href="#institutional" className="hover:text-white transition-colors">{t.nav.syndicate}</a>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* TEMPORARIAMENTE DESABILITADO - Causando erro
            <button 
              onClick={downloadProposalAsDoc}
              className="hidden md:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full font-medium transition-colors text-sm tracking-wide"
            >
              <Download className="w-4 h-4" />
              Proposta (.doc)
            </button>
            */}
            <button 
              onClick={onLoginClick}
              className="bg-white text-black px-6 py-2 rounded-full font-medium hover:bg-cyan-50 transition-colors text-sm tracking-wide"
            >
              {t.nav.login}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center px-6">
        <motion.div 
          style={{ opacity: heroOpacity, y: heroY }}
          className="text-center max-w-4xl mx-auto z-10"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-slate-500 text-[10px] tracking-widest uppercase"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
            </span>
            {t.hero.systemStatus}
          </motion.div>
          
          <MagneticCycleTitle />
          
          <p className="text-base md:text-lg text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            <button 
              onClick={onLoginClick}
              className="group relative px-8 py-4 bg-white text-black rounded-full font-semibold tracking-wide overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                {t.hero.ctaStart} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            </button>
            {/* TEMPORARIAMENTE DESABILITADO - Causando erro
            <button 
              onClick={downloadProposalAsDoc}
              className="md:hidden flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full font-medium transition-colors text-sm tracking-wide"
            >
              <Download className="w-4 h-4" />
              Baixar Proposta (.doc)
            </button>
            */}
            <button className="text-slate-400 hover:text-white transition-colors font-medium flex items-center gap-2">
              {t.hero.ctaDemo} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Stats/Social Proof */}
      <div className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm z-20 relative overflow-hidden">
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center relative z-10">
          {[
            { label: t.stats.nodes, value: '24,000+' },
            { label: t.stats.volume, value: '$1.2B' },
            { label: t.stats.leverage, value: '1:1000' },
            { label: t.stats.uptime, value: '99.99%' },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <section id="neural" className="py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: <Brain className="w-8 h-8 text-cyan-400" />,
                title: t.features.neural.title,
                desc: t.features.neural.desc
              },
              {
                icon: <Zap className="w-8 h-8 text-purple-400" />,
                title: t.features.flash.title,
                desc: t.features.flash.desc
              },
              {
                icon: <Lock className="w-8 h-8 text-emerald-400" />,
                title: t.features.security.title,
                desc: t.features.security.desc
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                transition={{ delay: i * 0.2 }}
                className="p-8 rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md hover:bg-white/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="mb-6 p-4 rounded-full bg-white/5 w-fit relative z-10 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-4 relative z-10">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed relative z-10">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 🔥 SOCIAL INTELLIGENCE - NOVA SEÇÃO */}
      <section className="py-32 bg-transparent relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-blue-900/10 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-purple-500/20 blur-3xl pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Social Intelligence</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 text-transparent bg-clip-text">
                Sentimento de Mercado
              </span>
              <br />
              <span className="text-white">em Tempo Real</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Monitoramos <strong className="text-white">Twitter, Reddit e Telegram</strong> 24/7 para detectar movimentos antes que aconteçam.
              <br />
              <span className="text-purple-400">Sua IA aprende com milhões de traders globalmente.</span>
            </p>
          </motion.div>

          {/* Grid de Fontes */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* TWITTER */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-50 group-hover:opacity-100"></div>
              
              <div className="relative bg-black/60 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-8 hover:border-blue-400/50 transition-all duration-500">
                {/* Icon */}
                <div className="mb-6 flex items-center justify-between">
                  <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-400 uppercase">Live</span>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-black text-white mb-3">Twitter/X</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Scraping inteligente de <strong className="text-blue-400">hashtags, influencers e trending topics</strong>. 
                  Detectamos pump & dump antes da multidão.
                </p>

                {/* Métricas */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Tweets/Dia</span>
                    <span className="text-lg font-mono font-bold text-white">~250k</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Influencers</span>
                    <span className="text-lg font-mono font-bold text-white">500+</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Acurácia</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">87%</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-500/10 rounded text-[10px] font-mono text-blue-400 border border-blue-500/20">#Bitcoin</span>
                  <span className="px-2 py-1 bg-blue-500/10 rounded text-[10px] font-mono text-blue-400 border border-blue-500/20">#Ethereum</span>
                  <span className="px-2 py-1 bg-blue-500/10 rounded text-[10px] font-mono text-blue-400 border border-blue-500/20">#Crypto</span>
                </div>
              </div>
            </motion.div>

            {/* REDDIT */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-50 group-hover:opacity-100"></div>
              
              <div className="relative bg-black/60 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8 hover:border-orange-400/50 transition-all duration-500">
                {/* Icon */}
                <div className="mb-6 flex items-center justify-between">
                  <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                    <svg className="w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-400 uppercase">Live</span>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-black text-white mb-3">Reddit</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Monitora <strong className="text-orange-400">r/CryptoCurrency, r/WallStreetBets</strong> e 20+ subreddits. 
                  Detecta posts virais e sentimento da comunidade.
                </p>

                {/* Métricas */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Posts/Dia</span>
                    <span className="text-lg font-mono font-bold text-white">~50k</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Subreddits</span>
                    <span className="text-lg font-mono font-bold text-white">20+</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Acurácia</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">82%</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-orange-500/10 rounded text-[10px] font-mono text-orange-400 border border-orange-500/20">r/Cryptocurrency</span>
                  <span className="px-2 py-1 bg-orange-500/10 rounded text-[10px] font-mono text-orange-400 border border-orange-500/20">r/WSB</span>
                </div>
              </div>
            </motion.div>

            {/* TELEGRAM */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-50 group-hover:opacity-100"></div>
              
              <div className="relative bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-8 hover:border-cyan-400/50 transition-all duration-500">
                {/* Icon */}
                <div className="mb-6 flex items-center justify-between">
                  <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                    <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-400 uppercase">Live</span>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-black text-white mb-3">Telegram</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Rastreia <strong className="text-cyan-400">canais de whales, grupos VIP</strong> e sinais institucionais. 
                  Acesso a informação privilegiada antes do mercado.
                </p>

                {/* Métricas */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Mensagens/Dia</span>
                    <span className="text-lg font-mono font-bold text-white">~15k</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Canais VIP</span>
                    <span className="text-lg font-mono font-bold text-white">150+</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Acurácia</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">91%</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-cyan-500/10 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/20">Whales</span>
                  <span className="px-2 py-1 bg-cyan-500/10 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/20">VIP Signals</span>
                  <span className="px-2 py-1 bg-cyan-500/10 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/20">Institucional</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-3xl blur-2xl"></div>
            
            <div className="relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">Sentiment Dashboard</h3>
                  <p className="text-sm text-slate-400">Análise agregada de 315.000+ fontes em tempo real</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-400">CONECTADO</span>
                </div>
              </div>

              {/* Métricas Globais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="text-3xl font-black text-white mb-1">87%</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Acurácia Média</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="text-3xl font-black text-emerald-400 mb-1">+32%</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">ROI Este Mês</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="text-3xl font-black text-cyan-400 mb-1">15ms</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Latência Média</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="text-3xl font-black text-purple-400 mb-1">24/7</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Uptime</div>
                </div>
              </div>

              {/* Exemplo de Sinal */}
              <div className="p-6 bg-gradient-to-br from-emerald-900/20 to-emerald-950/20 rounded-2xl border border-emerald-500/30">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <Zap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">SINAL DETECTADO</span>
                      <span className="text-xs text-slate-500">• há 2 minutos</span>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">
                      Bitcoin: Sentimento EXTREMAMENTE BULLISH detectado
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">
                      250+ menções no Twitter, 12 posts virais no Reddit (&gt;5k upvotes), 
                      3 canais VIP do Telegram confirmam movimento institucional. 
                      <strong className="text-emerald-400"> Probabilidade de alta: 89%</strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-blue-500/10 rounded text-xs text-blue-400 border border-blue-500/20">Twitter: 250 mentions</span>
                      <span className="px-2 py-1 bg-orange-500/10 rounded text-xs text-orange-400 border border-orange-500/20">Reddit: 12 viral posts</span>
                      <span className="px-2 py-1 bg-cyan-500/10 rounded text-xs text-cyan-400 border border-cyan-500/20">Telegram: 3 whale alerts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-16"
          >
            <p className="text-slate-400 mb-6">
              <strong className="text-white">Seja mais rápido que 99% dos traders.</strong>
              <br />
              Nossa IA já processou <span className="text-purple-400 font-mono">85 milhões de posts</span> e conta.
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-purple-500/50 hover:scale-105">
              Ativar Social Intelligence
            </button>
          </motion.div>
        </div>
      </section>

      <div id="institutional" className="scroll-mt-20">
          <PricingSection lang={lang} />
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-black/40 backdrop-blur-md relative z-10 text-sm">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 opacity-80">
          
          <div className="md:col-span-1">
            <div className="mb-4">
              <NeuralLogo size="sm" variant="icon-only" />
            </div>
            <p className="text-slate-400 text-sm font-medium italic mb-3 tracking-wide">
              "A sua casa de Trade."
            </p>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              © 2024 NEURO FINANCIAL TECHNOLOGY.<br/>
              {t.footer.rights}
            </p>
            <p className="text-slate-600 text-[10px] leading-relaxed border-t border-white/5 pt-2">
              DISCLAIMER: Esta é uma ferramenta de análise estatística e não aconselhamento financeiro.
            </p>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-white font-semibold mb-3 tracking-wider uppercase text-xs">Headquarters</h4>
            <div className="text-slate-400 text-xs space-y-1">
              <p>Praça Infante Dom Pedro nº 12 - 5º Andar ESQUERDO</p>
              <p>Algés, Oeiras, Lisboa</p>
              <p>Portugal, 1495-149</p>
            </div>
          </div>

          <div className="md:col-span-1">
            <h4 className="text-white font-semibold mb-3 tracking-wider uppercase text-xs">Contact & Legal</h4>
            <div className="text-slate-400 text-xs space-y-2">
               <p className="hover:text-white transition-colors cursor-pointer">Tel: +351 9654 568 95</p>
               <div className="h-px bg-white/10 w-12 my-2" />
               <p className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-2">
                 <Lock className="w-3 h-3" />
                 Privacy Policy (GDPR/LGPD)
               </p>
               <p className="hover:text-cyan-400 transition-colors cursor-pointer">Terms of Service</p>
               <p className="hover:text-cyan-400 transition-colors cursor-pointer">DPO Contact</p>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
};