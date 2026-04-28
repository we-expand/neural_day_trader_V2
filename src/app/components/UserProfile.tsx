import React, { useState, useEffect } from 'react';
import { User, MapPin, Phone, Mail, Calendar, Globe, Briefcase, Award, Shield, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface UserProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
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

export function UserProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfileData>({
    userId: user?.id || '',
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Brasil'
    },
    dateOfBirth: '',
    nationality: 'Brasileiro',
    occupation: '',
    company: '',
    tradingExperience: 'iniciante',
    riskProfile: 'moderate',
    investmentGoals: [],
    socialProfiles: {},
    verificationStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Load profile data
  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user?.id) return;
    
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
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/user-profile`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            profile: {
              ...profile,
              updatedAt: new Date().toISOString()
            }
          })
        }
      );

      if (response.ok) {
        toast.success('Perfil atualizado com sucesso!');
        setIsEditing(false);
        loadProfileData();
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setProfile(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value
          }
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const getFullName = () => {
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    return user?.email?.split('@')[0] || 'Usuário';
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex-none bg-black/50 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{getFullName()}</h1>
              <p className="text-sm text-slate-400">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Shield className={`w-4 h-4 ${profile.verificationStatus === 'verified' ? 'text-emerald-400' : 'text-yellow-400'}`} />
                <span className={`text-xs ${profile.verificationStatus === 'verified' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {profile.verificationStatus === 'verified' ? 'Verificado' : 'Verificação Pendente'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar Perfil
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="border-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={saveProfile}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Personal Information */}
        <Card className="bg-neutral-950/50 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Dados básicos de identificação</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Nome</label>
              <Input
                value={profile.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Sobrenome</label>
              <Input
                value={profile.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Email</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Telefone</label>
              <Input
                type="tel"
                value={profile.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Data de Nascimento</label>
              <Input
                type="date"
                value={profile.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Nacionalidade</label>
              <Input
                value={profile.nationality}
                onChange={(e) => updateField('nationality', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="bg-neutral-950/50 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Endereço
            </CardTitle>
            <CardDescription>Informações de localização</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Rua</label>
              <Input
                value={profile.address.street}
                onChange={(e) => updateField('address.street', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Cidade</label>
              <Input
                value={profile.address.city}
                onChange={(e) => updateField('address.city', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Estado</label>
              <Input
                value={profile.address.state}
                onChange={(e) => updateField('address.state', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">CEP</label>
              <Input
                value={profile.address.zipCode}
                onChange={(e) => updateField('address.zipCode', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">País</label>
              <Input
                value={profile.address.country}
                onChange={(e) => updateField('address.country', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card className="bg-neutral-950/50 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              Informações Profissionais
            </CardTitle>
            <CardDescription>Ocupação e experiência</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Ocupação</label>
              <Input
                value={profile.occupation}
                onChange={(e) => updateField('occupation', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Empresa</label>
              <Input
                value={profile.company}
                onChange={(e) => updateField('company', e.target.value)}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Experiência em Trading</label>
              <select
                value={profile.tradingExperience}
                onChange={(e) => updateField('tradingExperience', e.target.value)}
                disabled={!isEditing}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500 text-sm text-white"
              >
                <option value="iniciante">Iniciante (0-1 ano)</option>
                <option value="intermediario">Intermediário (1-3 anos)</option>
                <option value="avancado">Avançado (3-5 anos)</option>
                <option value="especialista">Especialista (5+ anos)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Perfil de Risco</label>
              <select
                value={profile.riskProfile}
                onChange={(e) => updateField('riskProfile', e.target.value)}
                disabled={!isEditing}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500 text-sm text-white"
              >
                <option value="conservative">Conservador</option>
                <option value="moderate">Moderado</option>
                <option value="aggressive">Agressivo</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Social Profiles */}
        <Card className="bg-neutral-950/50 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Redes Sociais
            </CardTitle>
            <CardDescription>Perfis profissionais (opcional)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">LinkedIn</label>
              <Input
                value={profile.socialProfiles.linkedin || ''}
                onChange={(e) => updateField('socialProfiles', { ...profile.socialProfiles, linkedin: e.target.value })}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Twitter/X</label>
              <Input
                value={profile.socialProfiles.twitter || ''}
                onChange={(e) => updateField('socialProfiles', { ...profile.socialProfiles, twitter: e.target.value })}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
                placeholder="@username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold">Telegram</label>
              <Input
                value={profile.socialProfiles.telegram || ''}
                onChange={(e) => updateField('socialProfiles', { ...profile.socialProfiles, telegram: e.target.value })}
                disabled={!isEditing}
                className="bg-black/50 border-white/10"
                placeholder="@username"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
