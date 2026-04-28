/**
 * 🔐 LOCAL AUTH SERVICE
 * Sistema de autenticação local que funciona sem backend
 * Usado como fallback quando Supabase não está disponível
 */

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  country?: string;
  createdAt: number;
}

interface LocalUserCredentials {
  email: string;
  passwordHash: string;
  user: LocalUser;
}

const STORAGE_KEY = 'neural_local_users';
const SESSION_KEY = 'neural_local_session';

/**
 * Hash simples para senha (não usar em produção real!)
 * Em produção, usar bcrypt ou similar
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Carrega usuários do localStorage
 */
function loadUsers(): Map<string, LocalUserCredentials> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[LocalAuth] localStorage não disponível');
      return new Map();
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return new Map();

    const parsed = JSON.parse(data);
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.warn('[LocalAuth] Erro ao carregar usuários:', error);
    return new Map();
  }
}

/**
 * Salva usuários no localStorage
 */
function saveUsers(users: Map<string, LocalUserCredentials>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[LocalAuth] localStorage não disponível para salvar');
      return;
    }

    const obj = Object.fromEntries(users);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('[LocalAuth] Erro ao salvar usuários:', error);
  }
}

/**
 * Registra novo usuário localmente
 */
export async function signUpLocal(email: string, password: string, name?: string): Promise<{ user: LocalUser; error?: string }> {
  console.log('[LocalAuth] 📝 Tentando criar usuário:', email);

  try {
    const users = loadUsers();

    // Verificar se usuário já existe
    if (users.has(email)) {
      console.log('[LocalAuth] ⚠️ Usuário já existe:', email);
      return { user: users.get(email)!.user, error: 'Usuário já existe' };
    }

    // Criar novo usuário
    const user: LocalUser = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name: name || email.split('@')[0] || 'Trader',
      role: email.includes('admin') ? 'admin' : 'user',
      createdAt: Date.now()
    };

    // Salvar credenciais
    users.set(email, {
      email,
      passwordHash: simpleHash(password),
      user
    });

    saveUsers(users);

    console.log('[LocalAuth] ✅ Usuário criado com sucesso:', email);

    return { user };
  } catch (error: any) {
    console.error('[LocalAuth] ❌ Erro ao registrar:', error);
    return { user: { id: '', email: '', name: '', role: 'user', createdAt: Date.now() }, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Faz login localmente
 */
export async function signInLocal(email: string, password: string): Promise<{ user: LocalUser | null; error?: string }> {
  console.log('[LocalAuth] 🔐 Tentando login:', email);

  try {
    const users = loadUsers();
    console.log('[LocalAuth] 📊 Usuários carregados:', users.size);

    const credentials = users.get(email);

    if (!credentials) {
      console.log('[LocalAuth] ❌ Usuário não encontrado:', email);
      return { user: null, error: 'Usuário não encontrado' };
    }

    // Verificar senha
    const passwordHash = simpleHash(password);
    console.log('[LocalAuth] 🔑 Verificando senha...');

    if (credentials.passwordHash !== passwordHash) {
      console.log('[LocalAuth] ❌ Senha incorreta');
      return { user: null, error: 'Senha incorreta' };
    }

    // Salvar sessão
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(credentials.user));
    }

    console.log('[LocalAuth] ✅ Login realizado com sucesso:', email);

    return { user: credentials.user };
  } catch (error: any) {
    console.error('[LocalAuth] ❌ Erro ao fazer login:', error);
    return { user: null, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Verifica se há sessão ativa
 */
export function getLocalSession(): LocalUser | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;

    return JSON.parse(data);
  } catch (error) {
    console.warn('[LocalAuth] Erro ao carregar sessão:', error);
    return null;
  }
}

/**
 * Faz logout
 */
export function signOutLocal(): void {
  localStorage.removeItem(SESSION_KEY);
  console.log('[LocalAuth] ✅ Logout realizado');
}

/**
 * Deleta usuário localmente
 */
export async function deleteUserLocal(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const users = loadUsers();

    if (!users.has(email)) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    users.delete(email);
    saveUsers(users);

    // Limpar sessão se for o usuário atual
    const session = getLocalSession();
    if (session?.email === email) {
      signOutLocal();
    }

    console.log('[LocalAuth] ✅ Usuário deletado:', email);

    return { success: true };
  } catch (error: any) {
    console.error('[LocalAuth] Erro ao deletar usuário:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lista todos os usuários (apenas emails)
 */
export function listLocalUsers(): string[] {
  const users = loadUsers();
  return Array.from(users.keys());
}
