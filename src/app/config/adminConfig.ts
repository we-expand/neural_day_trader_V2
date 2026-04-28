/**
 * CONFIGURAÇÃO DE CONTROLE DE ACESSO
 * 
 * Lista de emails autorizados a ver o menu SISTEMA (Admin)
 * 
 * SEGURANÇA CRÍTICA: Apenas adicione emails de desenvolvedores/administradores
 */

export const ADMIN_EMAILS = [
  'seu-email@exemplo.com',  // 👈 SUBSTITUA pelo seu email real
  // Adicione mais emails de admins aqui:
  // 'outro-admin@exemplo.com',
];

/**
 * Verifica se um email tem permissões de administrador
 */
export function isAdminUser(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Verifica se um usuário tem permissões de administrador
 */
export function checkAdminPermissions(user: any): boolean {
  if (!user) return false;
  
  // Verifica email do usuário
  const userEmail = user.email?.toLowerCase();
  if (!userEmail) return false;
  
  return ADMIN_EMAILS.includes(userEmail);
}
