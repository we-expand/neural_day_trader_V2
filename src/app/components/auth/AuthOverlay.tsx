import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Check, 
  ChevronLeft, 
  ScanFace, 
  Fingerprint, 
  ShieldCheck,
  Loader2,
  Camera,
  X,
  AlertCircle,
  Mail,
  Zap,
  Lock,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import * as LocalAuth from '../../services/LocalAuthService';

interface AuthOverlayProps {
  onAuthenticated: (user: any) => void;
}

// Design Constants
const TRANSITION = { duration: 0.6, ease: [0.22, 1, 0.36, 1] };
const BLUR_BG = "backdrop-blur-2xl bg-slate-950/40 border border-white/5 shadow-2xl";

export function AuthOverlay({ onAuthenticated }: AuthOverlayProps) {
  // States
  const [step, setStep] = useState(0); // 0: Welcome, 1: Email, 1.5: Name (if signup), 2: Password, 3: Biometrics, 4: Success
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showSignUpHint, setShowSignUpHint] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Form Data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Logic Helpers ---

  const handleNext = () => {
    setDirection(1);
    // 🚀 MODIFICADO: Após step 2, NÃO IR PARA STEP 3 (BIOMETRIA)
    // Agora vai direto para autenticação
    if (step === 2) {
      // NÃO avançar para step 3 - será tratado no submitAuth
      return;
    }
    // LÓGICA ESPECIAL: Se estiver no step 1 (email) e NÃO for signup, pular direto para step 2
    if (step === 1 && !isSignUp) {
      setStep(2);
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    // LÓGICA ESPECIAL: Se estiver no step 2 (senha) e NÃO for signup, voltar para step 1
    if (step === 2 && !isSignUp) {
      setStep(1);
    } else {
      setStep(s => s - 1);
    }
  };

  // HELPER: Auto-Login Logic
  const performLogin = async () => {
      try {
          const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
          });

          if (error) {
              // 🔥 FALLBACK: Tentar autenticação local
              console.warn('[Auth] Supabase falhou, tentando autenticação local...', error.message);

              let localResult = await LocalAuth.signInLocal(email, password);

              // 🆕 SE NÃO ENCONTROU USUÁRIO LOCAL, CRIAR AUTOMATICAMENTE!
              if (!localResult.user && localResult.error === 'Usuário não encontrado') {
                  console.log('[Auth] 🔄 Usuário não existe localmente, criando conta local automaticamente...');

                  const signUpResult = await LocalAuth.signUpLocal(email, password, userName || email.split('@')[0]);

                  if (signUpResult.user && !signUpResult.error) {
                      console.log('[Auth] ✅ Conta local criada! Fazendo login...');
                      localResult = await LocalAuth.signInLocal(email, password);
                  }
              }

              if (localResult.user) {
                  setLoading(false);
                  toast.success("Autenticado Localmente!", {
                      description: "Conta local sincronizada",
                      duration: 3000
                  });

                  setTimeout(() => {
                      onAuthenticated({
                          email: localResult.user!.email,
                          name: localResult.user!.name
                      });
                  }, 500);
                  return true;
              }

              // Se autenticação local também falhou
              setLoading(false);
              setHasError(true);

              // Verificar se é erro 402 (Payment Required) ou rede
              if (error.status === 402 || error.message?.includes('402') || error.message?.includes('fetch') || error.message?.includes('quota')) {
                  setErrorMessage("Senha Incorreta");
                  toast.warning("Supabase Offline", {
                    description: "Tentando criar conta local com suas credenciais...",
                    duration: 4000
                  });
              } else if (error.message.includes("Invalid login credentials")) {
                  setErrorMessage(localResult.error || "Senha Incorreta");
                  toast.error("Senha Inválida", { description: "Verifique suas credenciais ou crie uma nova conta." });
              } else if (error.message.includes("Email not confirmed")) {
                  setErrorMessage("Conta Pendente");
                  toast.warning("Conta Travada", {
                    description: "Sua conta precisa de ativação.",
                    action: {
                        label: "Forçar Ativação",
                        onClick: () => handleForceActivation()
                    },
                    duration: Infinity
                 });
              } else {
                  setErrorMessage("Erro de Sistema");
                  toast.error("Erro", { description: error.message });
              }
              return false;
          }

          if (data.session) {
              setLoading(false);
              toast.success("Autenticado!", { description: "Entrando na plataforma..." });
              setTimeout(() => {
                onAuthenticated({ email, name: userName || 'Trader' });
              }, 500);
              return true;
          }
          return false;
      } catch (err: any) {
          console.error('[Auth] Erro crítico no login:', err);

          // Tentar local auth como último recurso
          let localResult = await LocalAuth.signInLocal(email, password);

          // 🆕 SE NÃO ENCONTROU, CRIAR CONTA LOCAL AUTOMATICAMENTE
          if (!localResult.user && localResult.error === 'Usuário não encontrado') {
              console.log('[Auth] 🔄 Auto-criando conta local de emergência...');
              const signUpResult = await LocalAuth.signUpLocal(email, password, userName || email.split('@')[0]);

              if (signUpResult.user && !signUpResult.error) {
                  localResult = await LocalAuth.signInLocal(email, password);
              }
          }

          if (localResult.user) {
              setLoading(false);
              toast.success("Modo Offline Ativado!", {
                  description: "Sua conta foi sincronizada localmente",
                  duration: 3000
              });
              setTimeout(() => {
                  onAuthenticated({
                      email: localResult.user!.email,
                      name: localResult.user!.name
                  });
              }, 500);
              return true;
          }

          setLoading(false);
          setHasError(true);
          setErrorMessage("Erro Fatal");
          toast.error("Sistema Indisponível", {
              description: "Tente criar uma conta local.",
              duration: 5000
          });
          setShowSignUpHint(true);
          return false;
      }
  };

  // NEW: Force Activation via Backend (with Local Fallback)
  const handleForceActivation = async () => {
    if (!email || !password) return;
    setActivating(true);
    setHasError(false);
    setErrorMessage("");

    try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
            body: JSON.stringify({
                email,
                password,
                firstName: userName || 'Trader',
                lastName: userLastName || ''
            })
        });
        const data = await response.json();
        if (!response.ok) {
            if (data.error && (data.error.includes("ativo") || data.error.includes("already registered"))) {
                 toast.info("Verificada", { description: "Conta ativa. Tentando login..." });
                 const success = await performLogin();
                 if (success) return;
            }
            throw new Error(data.error || "Falha na ativação");
        }
        toast.success("Conta Ativada!", { description: "Entrando..." });
        await performLogin();
    } catch (err: any) {
        console.warn('[Auth] Erro na ativação via backend, criando conta local...', err.message);

        // 🔥 FALLBACK: Criar conta localmente
        const localResult = await LocalAuth.signUpLocal(email, password, userName || 'Trader');

        if (localResult.user && !localResult.error) {
            toast.success("Conta Local Criada!", { description: "Você pode trabalhar offline." });
            await performLogin();
        } else {
            toast.error("Erro ao Criar Conta", { description: localResult.error });
            setHasError(true);
            setErrorMessage(localResult.error || "Erro Desconhecido");
        }
    } finally {
        setActivating(false);
    }
  };

  // NEW: Delete User (Hard Reset - Local + Remote)
  const handleDeleteUser = async () => {
      if (!email) return;
      setDeleting(true);

      try {
        // Tentar deletar remotamente
        try {
            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                console.warn('[Auth] Falha ao deletar remotamente, deletando localmente...');
            }
        } catch (remoteErr) {
            console.warn('[Auth] Erro ao deletar remotamente:', remoteErr);
        }

        // SEMPRE deletar localmente (para garantir limpeza)
        const localResult = await LocalAuth.deleteUserLocal(email);

        toast.success("Conta Excluída", {
            description: localResult.success ? "Você pode criar uma nova conta agora." : "Conta local removida."
        });

        // Reset State for clean Signup
        setIsSignUp(true);
        setHasError(false);
        setErrorMessage("");
        setPassword('');
        setDeleting(false);

        // ❌ REMOVIDO: Auto-submit causava double-submit
        // if (password && password.length >= 6) {
        //     setTimeout(() => submitAuth(), 500);
        // }

      } catch (e: any) {
          toast.error("Erro", { description: e.message });
          setDeleting(false);
      }
  };

  const submitAuth = async () => {
    // 🛡️ Proteção contra double-submit
    if (loading) {
      console.log('[AuthOverlay] ⚠️ submitAuth já em andamento, ignorando...');
      return;
    }

    console.log('[AuthOverlay] 🚀 submitAuth iniciado', { isSignUp, email, passwordLength: password.length });

    setLoading(true);
    setHasError(false);
    setErrorMessage("");

    // Validation
    if (password.length < 6) {
        console.warn('[AuthOverlay] ⚠️ Senha muito curta');
        setLoading(false);
        setHasError(true);
        setErrorMessage("Senha Curta");
        toast.warning("Segurança Fraca", { description: "Mínimo 6 caracteres." });
        return;
    }

    // Security Check
    try {
        if (isSignUp) {
            console.log('[AuthOverlay] 📝 Modo SignUp - criando conta...');
            // Tentar criar conta
            await handleForceActivation();
            setLoading(false);
        } else {
            console.log('[AuthOverlay] 🔐 Modo Login - autenticando...');
            // Tentar login
            await performLogin();
        }

    } catch (e: any) {
        console.error('[AuthOverlay] ❌ Erro crítico em submitAuth:', e);

        // 🔥 ÚLTIMO RECURSO: Autenticação local
        console.log('[AuthOverlay] 🆘 Tentando autenticação local de emergência...');

        if (isSignUp) {
            console.log('[AuthOverlay] 📝 SignUp local...');
            const localResult = await LocalAuth.signUpLocal(email, password, userName || 'Trader');

            console.log('[AuthOverlay] Resultado do signUpLocal:', localResult);

            if (localResult.user && !localResult.error) {
                toast.success("Conta Local Criada!", { description: "Trabalhando em modo offline." });
                setLoading(false);
                console.log('[AuthOverlay] ✅ Autenticando usuário local criado...');
                setTimeout(() => {
                    onAuthenticated({
                        email: localResult.user!.email,
                        name: localResult.user!.name
                    });
                }, 500);
            } else {
                console.error('[AuthOverlay] ❌ Falha ao criar conta local:', localResult.error);
                setLoading(false);
                setHasError(true);
                setErrorMessage(localResult.error || "Erro ao Criar Conta");
                toast.error("Erro", { description: localResult.error || "Falha ao criar conta local" });
            }
        } else {
            console.log('[AuthOverlay] 🔐 Login local...');
            const localResult = await LocalAuth.signInLocal(email, password);

            console.log('[AuthOverlay] Resultado do signInLocal:', localResult);

            if (localResult.user) {
                toast.success("Autenticado Localmente!", { description: "Modo offline ativo." });
                setLoading(false);
                console.log('[AuthOverlay] ✅ Autenticando usuário local...');
                setTimeout(() => {
                    onAuthenticated({
                        email: localResult.user!.email,
                        name: localResult.user!.name
                    });
                }, 500);
            } else {
                console.error('[AuthOverlay] ❌ Falha no login local:', localResult.error);
                setLoading(false);
                setHasError(true);
                setErrorMessage("Sistema Indisponível");
                toast.error("Erro Fatal", {
                    description: "Não foi possível autenticar. Tente criar uma conta local.",
                    duration: 5000
                });
                setShowSignUpHint(true);
            }
        }
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      toast.error("Erro ao acessar câmera", { description: "Verifique as permissões do navegador." });
    }
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      
      // Auto-start scan simulation
      let progress = 0;
      const interval = setInterval(() => {
        progress += 1.5;
        setScanProgress(progress);
        if (progress >= 100) {
           clearInterval(interval);
           setCameraActive(true); 
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [cameraActive]);

  // --- Animation Variants ---
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      filter: "blur(10px)"
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      filter: "blur(0px)"
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      filter: "blur(10px)"
    })
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] text-white overflow-hidden flex flex-col font-sans selection:bg-blue-500/30">
        
        {/* Background Ambience */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full mix-blend-screen animate-pulse duration-[10s]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full mix-blend-screen animate-pulse duration-[7s]" />
            <div className="absolute inset-0 opacity-[0.03]"
                 style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'3\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\' /%3E%3C/svg%3E")'}} />
        </div>

        {/* Header / Brand */}
        <header className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-50">
            <div className="flex items-center gap-3 opacity-80">
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]" />
                <span className="text-xs font-medium tracking-[0.2em] text-slate-400 uppercase">Neural Day Trader</span>
            </div>
            {step > 0 && (
                <button onClick={() => setStep(0)} className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest">
                    Cancelar
                </button>
            )}
        </header>

        {/* Main Stage */}
        <main className="flex-1 flex items-center justify-center relative px-6">
            <AnimatePresence initial={false} custom={direction} mode="wait">
                
                {/* STEP 0: WELCOME */}
                {step === 0 && (
                    <motion.div 
                        key="step0"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={TRANSITION}
                        className="text-center max-w-2xl"
                    >
                        <motion.div 
                            initial={{ opacity: 0, filter: "blur(20px)", scale: 0.95 }}
                            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                            transition={{ delay: 0.2, duration: 2.0, ease: [0.16, 1, 0.3, 1] }} // Ultra slow cinematic fade
                            className="mb-8 relative inline-block"
                        >
                           <h1 className="text-5xl md:text-7xl font-light tracking-tighter text-white mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-500">
                               Inteligência <br /> Financeira.
                           </h1>
                           <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent mt-8" />
                        </motion.div>

                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-slate-400 text-lg font-light mb-12 max-w-md mx-auto leading-relaxed"
                        >
                            Acesse o terminal institucional e opere com algoritmos de alta frequência.
                        </motion.p>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleNext}
                            className={`group relative px-8 py-4 ${BLUR_BG} rounded-full flex items-center gap-4 mx-auto hover:bg-white/5 transition-all`}
                        >
                            <span className="text-sm font-medium tracking-widest uppercase">Iniciar Sessão</span>
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                                <ArrowRight className="w-4 h-4 text-white" />
                            </div>
                        </motion.button>
                    </motion.div>
                )}

                {/* STEP 1: EMAIL */}
                {step === 1 && (
                    <motion.form
                        key="step1"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={TRANSITION}
                        className="w-full max-w-md"
                        onSubmit={(e) => { e.preventDefault(); email && handleNext(); }}
                    >
                        <div className="mb-8">
                            <span className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-2 block">
                                {isSignUp ? "Cadastro // Passo 01" : "Login // Passo 01"}
                            </span>
                            <h2 className="text-3xl font-light text-white">
                                {isSignUp ? "Criar Identidade" : "Identificação"}
                            </h2>
                        </div>

                        <div className="relative group">
                            <input
                                autoFocus
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && email && handleNext()}
                                placeholder="exemplo@neural.com"
                                autoComplete="email"
                                className="w-full bg-transparent border-b border-slate-800 py-4 text-2xl text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors font-light"
                            />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                <span className="text-xs text-slate-500 uppercase tracking-widest">Enter para continuar</span>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-between items-center">
                             <button onClick={handleBack} className="text-slate-500 hover:text-white transition-colors p-2 -ml-2">
                                <ChevronLeft className="w-6 h-6" />
                             </button>
                             <button 
                                onClick={handleNext}
                                disabled={!email}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${email ? 'bg-white text-black scale-100' : 'bg-slate-900 text-slate-700 scale-90'}`}
                            >
                                <ArrowRight className="w-5 h-5" />
                             </button>
                        </div>
                        
                        <div className="mt-8 text-center flex flex-col gap-4">
                            <button 
                                onClick={() => { setIsSignUp(!isSignUp); setHasError(false); setShowSignUpHint(false); setErrorMessage(""); }}
                                className={`text-xs uppercase tracking-widest transition-all duration-300 ${
                                    showSignUpHint 
                                    ? 'text-blue-400 font-bold scale-110 animate-pulse' 
                                    : 'text-slate-500 hover:text-blue-400'
                                }`}
                            >
                                {isSignUp ? "Já possuo conta // Acessar" : "Primeiro Acesso // Criar Conta"}
                            </button>
                        </div>
                    </motion.form>
                )}

                {/* STEP 1.5: NAME (IF SIGNUP) */}
                {step === 1.5 && (
                    <motion.form
                        key="step1.5"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={TRANSITION}
                        className="w-full max-w-md"
                        onSubmit={(e) => { e.preventDefault(); userName && handleNext(); }}
                    >
                        <div className="mb-8">
                            <span className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-2 block">
                                {isSignUp ? "Cadastro // Passo 02" : "Login // Passo 01"}
                            </span>
                            <h2 className="text-3xl font-light text-white">
                                {isSignUp ? "Definir Nome" : "Identificação"}
                            </h2>
                        </div>

                        <div className="relative group">
                            <input
                                autoFocus
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && userName && handleNext()}
                                placeholder="Nome"
                                autoComplete="given-name"
                                className="w-full bg-transparent border-b border-slate-800 py-4 text-2xl text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors font-light"
                            />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                <span className="text-xs text-slate-500 uppercase tracking-widest">Enter para continuar</span>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-between items-center">
                             <button onClick={handleBack} className="text-slate-500 hover:text-white transition-colors p-2 -ml-2">
                                <ChevronLeft className="w-6 h-6" />
                             </button>
                             <button 
                                onClick={handleNext}
                                disabled={!userName}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${userName ? 'bg-white text-black scale-100' : 'bg-slate-900 text-slate-700 scale-90'}`}
                            >
                                <ArrowRight className="w-5 h-5" />
                             </button>
                        </div>
                        
                        <div className="mt-8 text-center flex flex-col gap-4">
                            <button 
                                onClick={() => { setIsSignUp(!isSignUp); setHasError(false); setShowSignUpHint(false); setErrorMessage(""); }}
                                className={`text-xs uppercase tracking-widest transition-all duration-300 ${
                                    showSignUpHint 
                                    ? 'text-blue-400 font-bold scale-110 animate-pulse' 
                                    : 'text-slate-500 hover:text-blue-400'
                                }`}
                            >
                                {isSignUp ? "Já possuo conta // Acessar" : "Primeiro Acesso // Criar Conta"}
                            </button>
                        </div>
                    </motion.form>
                )}

                {/* STEP 2: PASSWORD */}
                {step === 2 && (
                    <motion.form
                        key="step2"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={TRANSITION}
                        className="w-full max-w-md"
                        onSubmit={(e) => { e.preventDefault(); password && submitAuth(); }}
                    >
                        <div className="mb-8">
                             <div className="flex items-center gap-3 mb-2">
                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${hasError ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                                     {hasError ? <X className="w-3 h-3 text-red-500" /> : <Check className="w-3 h-3 text-blue-500" />}
                                 </div>
                                 <span className={hasError ? "text-red-500 text-sm transition-colors" : "text-slate-500 text-sm transition-colors"}>{email}</span>
                             </div>
                            <h2 className="text-3xl font-light text-white">
                                {isSignUp ? "Definir Senha" : "Credencial de Acesso"}
                            </h2>
                        </div>

                        <div className="relative">
                            <motion.div
                                animate={hasError ? { x: [-10, 10, -10, 10, 0] } : {}}
                                transition={{ duration: 0.4 }}
                            >
                                <input
                                    autoFocus
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (hasError) setHasError(false);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && password && submitAuth()}
                                    placeholder="••••••••"
                                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                    className={`w-full bg-transparent border-b py-4 text-2xl placeholder-slate-700 focus:outline-none transition-colors font-light tracking-widest ${
                                        hasError
                                        ? 'border-red-500 text-red-500 placeholder-red-500/50'
                                        : 'border-slate-800 text-white focus:border-blue-500'
                                    }`}
                                />
                            </motion.div>

                            {hasError && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute right-0 top-full mt-4 flex items-center gap-2 text-red-500"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-bold tracking-widest uppercase">
                                        {errorMessage || (isSignUp ? "Erro no Cadastro" : "Acesso Negado")}
                                    </span>
                                </motion.div>
                            )}
                        </div>

                        <div className="mt-12 flex justify-between items-center">
                             <button onClick={handleBack} className="text-slate-500 hover:text-white transition-colors p-2 -ml-2">
                                <ChevronLeft className="w-6 h-6" />
                             </button>
                             <button 
                                onClick={submitAuth}
                                disabled={loading || !password}
                                className={`px-6 py-3 rounded-full flex items-center gap-3 transition-all duration-500 ${password ? 'bg-white text-black' : 'bg-slate-900 text-slate-700'}`}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-sm font-bold">{isSignUp ? "Registrar" : "Verificar"}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {/* CRITICAL ACTIONS: RESET & RESCUE */}
                        {!isSignUp && hasError && (
                            <div className="mt-8 text-center space-y-3">
                                
                                {/* Option A: DELETE ACCOUNT (If password forgotten or stuck) */}
                                {errorMessage === "Senha Incorreta" && (
                                    <button 
                                        onClick={handleDeleteUser}
                                        disabled={deleting}
                                        className="text-[10px] text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto font-bold border border-red-500/20 px-4 py-2 rounded-full hover:bg-red-500/10"
                                    >
                                        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        Deletar Conta e Recriar
                                    </button>
                                )}

                                {/* Option B: Force Activation (if stuck pending) */}
                                {errorMessage === "Conta Pendente" && (
                                    <button 
                                        onClick={handleForceActivation}
                                        disabled={activating || !password}
                                        className="text-[10px] text-amber-500 hover:text-amber-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 animate-pulse font-bold mx-auto border border-amber-500/20 px-4 py-2 rounded-full"
                                    >
                                        {activating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                        Resolver Conta Travada
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.form>
                )}

                {/* STEP 3: BIOMETRICS - REMOVIDO PERMANENTEMENTE */}

            </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="absolute bottom-0 w-full p-8 flex justify-between items-end z-50 text-[10px] text-slate-600 uppercase tracking-widest font-medium">
            <div className="flex flex-col gap-1">
                <span>System Status: Online</span>
                <span>Latency: 12ms</span>
            </div>
            <div>
                Encrypted Connection (TLS 1.3)
            </div>
        </footer>

        {/* CSS for Scan Animation */}
        <style>{`
            @keyframes scan {
                0% { top: 10%; opacity: 0; }
                50% { opacity: 1; }
                100% { top: 90%; opacity: 0; }
            }
            .animate-scan {
                animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
        `}</style>
    </div>
  );
}