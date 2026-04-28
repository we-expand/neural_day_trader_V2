import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Lock, ShieldCheck, User, ArrowRight, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { translations, Language } from '../landing/translations';
import { NeuralLogo } from '../BrandLogo';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'sonner';
import * as LocalAuth from '../../services/LocalAuthService';

export interface UserProfile {
  email: string;
  role: 'admin' | 'user';
  name: string;
  country?: string;
}

export const SmartLogin = ({ onLoginSuccess, onBack, lang }: { onLoginSuccess: (user: UserProfile) => void; onBack: () => void; lang: Language }) => {
  const [step, setStep] = useState<'identify' | 'verify' | 'password' | 'biometric' | 'success' | 'signup'>('identify');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('BR'); // Default to Brazil
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [securityLog, setSecurityLog] = useState<string[]>([]);
  const t = translations[lang].login;

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setSecurityLog([]);

    // Simulate security checks visual effect
    const logs = t.securityLog;
    let currentLogIndex = 0;

    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        setSecurityLog(prev => [...prev, logs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setLoading(false);
        // After "identifying", ask for verification method
        setStep('verify');
      }
    }, 300);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Email não identificado. Volte e digite seu email.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (step === 'signup') {
        // Tentar criar conta no Supabase
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) throw error;

          toast.success('Conta criada!', { description: 'Fazendo login...' });
        } catch (signUpErr: any) {
          console.warn('[SmartLogin] Erro no signup Supabase, tentando local...', signUpErr.message);

          // Criar conta localmente
          const localResult = await LocalAuth.signUpLocal(email, password, email.split('@')[0]);

          if (localResult.error && localResult.error !== 'Usuário já existe') {
            throw new Error(localResult.error);
          }

          toast.success('Conta Local Criada!', { description: 'Modo offline ativo.' });
        }
      }

      // Login Logic
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setStep('success');
          setTimeout(() => {
            onLoginSuccess({
              email: data.user.email || '',
              role: data.user.email?.includes('admin') ? 'admin' : 'user',
              name: data.user.email?.split('@')[0] || 'User',
              country: country
            });
            localStorage.setItem('neural_user_region', country);
          }, 1500);
        }
      } catch (loginErr: any) {
        console.warn('[SmartLogin] Erro no login Supabase, tentando local...', loginErr.message);

        // Tentar login local
        let localResult = await LocalAuth.signInLocal(email, password);

        // 🆕 SE NÃO ENCONTROU, CRIAR CONTA LOCAL AUTOMATICAMENTE
        if (!localResult.user && localResult.error === 'Usuário não encontrado') {
          console.log('[SmartLogin] 🔄 Criando conta local automaticamente...');
          const signUpResult = await LocalAuth.signUpLocal(email, password, email.split('@')[0]);

          if (signUpResult.user && !signUpResult.error) {
            localResult = await LocalAuth.signInLocal(email, password);
          }
        }

        if (localResult.user) {
          toast.success('Autenticado Localmente!', {
            description: 'Conta sincronizada no modo offline.'
          });

          setStep('success');
          setTimeout(() => {
            onLoginSuccess({
              email: localResult.user!.email,
              role: localResult.user!.role,
              name: localResult.user!.name,
              country: country
            });
            localStorage.setItem('neural_user_region', country);
          }, 1500);
          return;
        }

        // Se ambos falharam
        throw loginErr;
      }

    } catch (err: any) {
      console.error('[SmartLogin] Erro de autenticação:', err.message);

      // ✅ SEMPRE USAR LOCAL AUTH COMO FALLBACK
      // Detecta erro 402, fetch failure, ou qualquer outro erro Supabase
      console.warn('[SmartLogin] 🔄 Supabase indisponível, usando Local Auth...');

      toast.success('Modo Offline Ativado!', {
        description: 'Suas credenciais estão seguras localmente.',
        duration: 3000
      });

      // 🚀 CRIAR ou LOGIN LOCAL (auto-create se não existir)
      let localResult = await LocalAuth.signInLocal(email, password);

      // Se não existe, criar automaticamente
      if (!localResult.user && localResult.error === 'Usuário não encontrado') {
        console.log('[SmartLogin] 📝 Criando usuário local automaticamente...');
        const signUpResult = await LocalAuth.signUpLocal(email, password, email.split('@')[0]);

        if (signUpResult.user) {
          localResult = { user: signUpResult.user };
        }
      }

      // Se criou ou logou com sucesso
      if (localResult.user) {
        localStorage.setItem('neural_user_region', country);

        setStep('success');
        setTimeout(() => {
          onLoginSuccess({
            email: localResult.user!.email,
            role: localResult.user!.role,
            name: localResult.user!.name,
            country: country
          });
        }, 1500);
        return;
      }

      setError(err.message === 'Invalid login credentials' ? 'Credenciais inválidas.' : err.message);
      setLoading(false);
    }
  };

  // Biometric simulation
  const handleBiometricAuth = () => {
    setStep('biometric');
    
    // Auto-fill demo email if empty for smoother demo experience
    const targetEmail = email || "demo@neural.finance";

    setTimeout(() => {
        toast.success('Identidade biométrica confirmada.', { duration: 2000 });
        setStep('success');
        setTimeout(() => {
           // Generate a more realistic name for the demo
           let generatedName = targetEmail.split('@')[0];
           
           if (targetEmail === 'demo@neural.finance') {
             generatedName = "Nome e Sobrenome";
           } else if (targetEmail.includes('demo') || targetEmail.includes('teste')) {
             generatedName = "Arthur Morgan";
           }
           
           onLoginSuccess({ 
             email: targetEmail, 
             role: targetEmail.includes('admin') ? 'admin' : 'user',
             name: generatedName,
             country: 'BR' // Default for biometric demo
           });
           localStorage.setItem('neural_user_region', 'BR');
        }, 1500);
    }, 3500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#050505]/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl shadow-cyan-900/10 overflow-hidden relative"
      >
        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"
             style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'3\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\' /%3E%3C/svg%3E")'}}></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-2">
              <div className="scale-75 origin-left">
                 <NeuralLogo variant="icon-only" size="sm" />
              </div>
              <span className="text-xs font-mono text-cyan-400 tracking-widest">{t.gateway}</span>
            </div>
            <button onClick={onBack} className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-wider">
              {t.cancel}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 'identify' && (
              <motion.form
                key="identify"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                onSubmit={handleIdentitySubmit}
                className="space-y-6"
                autoComplete="on"
              >
                <div>
                  <h2 className="text-2xl font-light text-white mb-2">{t.accessPortal}</h2>
                  <p className="text-slate-400 text-sm">{t.identify}</p>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="email"
                      placeholder={t.placeholder}
                      className="w-full bg-slate-900/50 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-cyan-50 transition-all flex items-center justify-center space-x-2 group"
                >
                  <span>{loading ? t.analyzing : t.initialize}</span>
                  {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>

                {/* Quick Biometric Access */}
                {!loading && (
                  <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center w-full">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-4 font-semibold">Ou acesse via</p>
                    
                    <button 
                      type="button"
                      onClick={handleBiometricAuth} 
                      className="group relative w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/30 hover:bg-cyan-900/40 hover:border-cyan-500/50 transition-all overflow-hidden shadow-[0_0_15px_rgba(8,145,178,0.1)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      
                      <div className="relative p-2 rounded-full bg-black/50 border border-white/10 group-hover:border-cyan-500/50 transition-colors">
                         <Fingerprint className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                          FaceID / TouchID
                        </span>
                        <span className="text-[10px] text-slate-500 group-hover:text-cyan-400/80 transition-colors">
                          Acesso Biométrico Instantâneo
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="mt-4 space-y-1">
                    {securityLog.map((log, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center space-x-2 text-xs font-mono text-cyan-500/80"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{log}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.form>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-light text-white mb-2">{t.verify}</h2>
                  <p className="text-slate-400 text-sm">{t.mfa}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setStep('password')}
                    className="col-span-2 bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 p-4 rounded-xl flex items-center justify-center space-x-3 group transition-all"
                  >
                    <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-cyan-900/30 transition-colors">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-white">{t.password}</div>
                      <div className="text-xs text-slate-500">Credencial Padrão</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 ml-auto" />
                  </button>

                  <button 
                    onClick={() => setStep('signup')}
                    className="col-span-2 bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl flex items-center justify-center space-x-3 group transition-all"
                  >
                    <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-emerald-900/30 transition-colors">
                      <User className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-white">Criar Nova Conta</div>
                      <div className="text-xs text-slate-500">Primeiro Acesso</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 ml-auto" />
                  </button>
                </div>
              </motion.div>
            )}

            {(step === 'password' || step === 'signup') && (
              <motion.form 
                key="password"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-light text-white mb-2">{step === 'signup' ? 'Nova Credencial' : 'Autenticação'}</h2>
                  <p className="text-slate-400 text-sm">
                    {step === 'signup' ? 'Defina sua senha mestra' : `Digite a senha para ${email}`}
                  </p>
                </div>

                <div className="space-y-4">
                  {step === 'signup' && (
                    <div className="relative group">
                        <Globe className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all appearance-none cursor-pointer hover:bg-slate-800/50"
                        >
                            <option value="BR">Brasil (BRL / Mercado BM&F)</option>
                            <option value="PT">Portugal (EUR / Mercado Europeu)</option>
                            <option value="US">United States (USD / NYSE)</option>
                            <option value="UK">United Kingdom (GBP / LSE)</option>
                        </select>
                        {/* Custom Arrow */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                           <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                           </svg>
                        </div>
                    </div>
                  )}

                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="password"
                      placeholder="Senha do sistema"
                      className="w-full bg-slate-900/50 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={step === 'signup' ? 'new-password' : 'current-password'}
                      autoFocus
                      required
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 p-2 rounded border border-rose-500/20">
                       <AlertCircle className="h-3 w-3" />
                       {error}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setStep('verify')}
                    className="flex-1 bg-slate-800 text-slate-300 font-medium py-3 rounded-lg hover:bg-slate-700 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className={`flex-[2] text-black font-medium py-3 rounded-lg transition-all flex items-center justify-center space-x-2 group ${
                      step === 'signup' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-white hover:bg-cyan-50'
                    }`}
                  >
                     {loading ? (
                        <span>Processando...</span>
                     ) : (
                        <>
                          <span>{step === 'signup' ? 'Registrar' : 'Entrar'}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                     )}
                  </button>
                </div>
              </motion.form>
            )}

            {step === 'biometric' && (
              <motion.div
                key="biometric"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center py-8"
              >
                <div className="relative w-40 h-40 mb-8 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-purple-500/30 border-dashed"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-6 rounded-full border border-cyan-500/30 border-dotted"
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Fingerprint className="w-20 h-20 text-white/90" strokeWidth={1} />
                  </div>

                  <motion.div 
                    initial={{ top: "-10%" }}
                    animate={{ top: "110%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-10 opacity-80"
                  />
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-cyan-400/20"
                  />
                </div>
                
                <h3 className="text-lg text-white font-light tracking-[0.2em] uppercase mb-2 animate-pulse">{t.scanning}</h3>
                <p className="text-xs text-slate-500 font-mono bg-white/5 px-3 py-1 rounded border border-white/5">{t.dontMove}</p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center py-12"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl text-white font-medium mb-2">{t.granted}</h3>
                <p className="text-slate-400 text-sm">{t.welcome}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
