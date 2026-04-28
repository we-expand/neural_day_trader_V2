import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseActive } from '../../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  mockLogin: (email: string, name?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('[AUTH] 🚀 AuthProvider montado');
    
    let subscription: any = null;
    let isMounted = true;
    
    // 🛡️ PROTEÇÃO ANTI-IFRAME ERROR: Delay de inicialização AUMENTADO
    // 🔥 SINCRONIZADO com outros providers: 200ms para garantir que iframe esteja pronto
    const initTimer = setTimeout(async () => {
      if (!isMounted) return;
      
      try {
        // Check local mock session first (to survive reloads)
        const storedMock = sessionStorage.getItem('apex_mock_user');
        console.log('[AUTH] 🔍 Verificando sessionStorage:', storedMock ? 'ENCONTRADO' : 'VAZIO');
        
        if (storedMock) {
          try {
            const parsedUser = JSON.parse(storedMock);
            console.log('[AUTH] ✅ Recuperando user do sessionStorage:', parsedUser.email);
            if (isMounted) {
              setUser(parsedUser);
              setLoading(false);
              setIsInitialized(true);
            }
            return; // Skip supabase check if we have a mock user
          } catch(e) { 
            console.error('[AUTH] ❌ Erro ao parsear sessionStorage:', e); 
          }
        }

        if (!isSupabaseActive || !supabase) {
          console.log('[AUTH] ⚠️ Supabase inativo');
          if (isMounted) {
            setLoading(false);
            setIsInitialized(true);
          }
          return;
        }

        console.log('[AUTH] 🔐 Verificando sessão Supabase...');
        
        // Check active sessions and sets the user
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (session) {
          console.log('[AUTH] ✅ Sessão Supabase encontrada');
          setSession(session);
          setUser(session.user);
        } else {
          console.log('[AUTH] ⚠️ Nenhuma sessão Supabase');
        }
        setLoading(false);
        setIsInitialized(true);

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;
          
          console.log('[AUTH] 🔄 onAuthStateChange:', _event, session ? 'sessão ativa' : 'sem sessão');
          
          // If we are in "mock mode" (simulated login), ignore Supabase updates that would log us out
          // This prevents the "screen blink" issue where Supabase overrides the mock user with null
          if (sessionStorage.getItem('apex_mock_user') && !session) {
            console.log('[AUTH] 🛡️ PROTEGIDO: Ignorando limpeza do Supabase (mock user ativo)');
            return;
          }

          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });
        
        subscription = sub;
      } catch (error) {
        console.error('[AUTH] ❌ Erro na inicialização:', error);
        if (isMounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    }, 200); // 200ms delay para evitar conflitos com Figma iframe

    // 🧹 CLEANUP: Executado SEMPRE quando o componente desmonta
    return () => {
      console.log('[AUTH] 🧹 Limpando AuthProvider...');
      isMounted = false;
      clearTimeout(initTimer);
      
      if (subscription) {
        try {
          subscription.unsubscribe();
          console.log('[AUTH] ✅ Subscription limpa com sucesso');
        } catch (error) {
          console.error('[AUTH] ⚠️ Erro ao desinscrever:', error);
        }
      }
    };
  }, []);

  // 🔥 LOG quando user muda
  useEffect(() => {
    console.log('[AUTH] 👤 USER STATE MUDOU:', user ? `${user.email} (ID: ${user.id})` : 'NULL');
  }, [user]);

  const signIn = async () => {
    // For simplicity in this demo, we'll use email/password or magic link.
    // Ideally, you'd have a full login form. For now, let's trigger a Google login or just a placeholder
    // Since we don't have OAuth configured, let's assume the user uses the UI component we will build.
    console.log("Sign in logic should be handled by the Login component");
  };

  const mockLogin = async (email: string, name?: string) => {
    console.log('[AUTH] 🔥 mockLogin INICIADO:', { email, name });
    
    // Create a fake Supabase User object for demo purposes
    // Use name from parameter, or extract from email, or use generic name
    const userName = name || email.split('@')[0] || 'Trader Neural';
    
    const mockUser: User = {
      id: 'mock-user-123',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { name: userName, full_name: userName },
      aud: 'authenticated',
      confirmation_sent_at: new Date().toISOString(),
      recovery_sent_at: new Date().toISOString(),
      email_change_sent_at: new Date().toISOString(),
      new_email: '',
      invited_at: new Date().toISOString(),
      action_link: '',
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      role: 'authenticated',
      updated_at: new Date().toISOString(),
      email: email,
      phone: '',
      is_anonymous: false,
      factors: []
    };
    
    console.log('[AUTH] 💾 Salvando no sessionStorage:', mockUser.email);
    sessionStorage.setItem('apex_mock_user', JSON.stringify(mockUser));
    
    console.log('[AUTH] 📝 Setando user state:', mockUser.email);
    setUser(mockUser);
    
    console.log('[AUTH] ✅ mockLogin COMPLETO');
    // We don't set a session token, but user presence is enough for UI checks
  };

  const signOut = async () => {
    if (isSupabaseActive && supabase) {
        await supabase.auth.signOut();
    }
    sessionStorage.removeItem('apex_mock_user');
    setUser(null); // Force clear for mock users
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Durante hot reload ou desenvolvimento, pode haver uma condição de corrida
    // Retornar valores padrão seguros ao invés de lançar erro
    if (process.env.NODE_ENV === 'development') {
      console.warn('useAuth called outside AuthProvider - returning safe defaults');
      return {
        user: null,
        session: null,
        loading: true,
        signIn: async () => {},
        signOut: async () => {},
        mockLogin: async () => {}
      } as AuthContextType;
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};