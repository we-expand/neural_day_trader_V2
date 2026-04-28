import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export interface UserProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string; // 🎨 NOVO: URL do avatar do usuário
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  dateOfBirth: string;
  nationality: string;
  occupation: string;
  company: string;
  tradingExperience: string;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  investmentGoals: string[];
  socialProfiles: {
    linkedin?: string;
    twitter?: string;
    telegram?: string;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user?.id) return;

    // 🚨 MODO OFFLINE: Não tentar buscar perfil do servidor
    // Usar apenas dados locais do user
    console.log('[useUserProfile] 🔄 Modo offline - usando dados locais');
    setLoading(false);
    return;

    /* DESATIVADO - Quota excedida
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/user-profile?userId=${user.id}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data && data.profile) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
    */
  };

  const getFullName = () => {
    // 1. Tentar do perfil completo (KV Store)
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    if (profile?.firstName) {
      return profile.firstName;
    }
    
    // 2. Tentar do Supabase user metadata
    if (user?.user_metadata?.firstName && user?.user_metadata?.lastName) {
      return `${user.user_metadata.firstName} ${user.user_metadata.lastName}`;
    }
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    
    // 3. Fallback para email
    return user?.email?.split('@')[0] || 'Usuário';
  };

  const getFirstName = () => {
    return profile?.firstName || user?.user_metadata?.firstName || user?.email?.split('@')[0] || 'Usuário';
  };

  const getAvatarUrl = () => {
    // 1. Foto do perfil (se existir)
    if (profile?.avatarUrl) {
      return profile.avatarUrl;
    }
    
    // 2. Foto do Supabase metadata
    if (user?.user_metadata?.avatar_url) {
      return user.user_metadata.avatar_url;
    }
    
    // 3. Avatar gerado automaticamente (DiceBear)
    const seed = user?.email || user?.id || 'default';
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=1f2937&radius=50`;
  };

  return {
    profile,
    loading,
    fullName: getFullName(),
    firstName: getFirstName(),
    avatarUrl: getAvatarUrl(),
    reload: loadProfile
  };
}
