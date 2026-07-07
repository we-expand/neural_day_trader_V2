import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, MapPin, Building, Briefcase, DollarSign, 
  Target, Shield, CheckCircle, ArrowRight, ArrowLeft, AlertCircle,
  FileText, Lock, Calendar, Hash, Home, Map
} from 'lucide-react';
import { toast } from 'sonner';

interface UserData {
  // Dados Pessoais
  fullName: string;
  dateOfBirth: string;
  documentNumber: string; // CPF/Passport
  documentType: 'CPF' | 'PASSPORT' | 'OTHER';
  
  // Contato
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  
  // Endereço
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  
  // Informações Profissionais
  occupation: string;
  monthlyIncome: string;
  tradingExperience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';
  
  // Objetivos e Perfil
  investmentGoal: 'INCOME' | 'GROWTH' | 'PRESERVATION' | 'SPECULATION';
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  tradingHoursPerWeek: string;
  
  // Conformidade e Consentimentos
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  dataProcessingConsent: boolean;
}

interface ExpandedOnboardingProps {
  onComplete: (data: UserData) => void;
  onSkip?: () => void;
}

export function ExpandedOnboarding({ onComplete, onSkip }: ExpandedOnboardingProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UserData>({
    fullName: '',
    dateOfBirth: '',
    documentNumber: '',
    documentType: 'CPF',
    email: '',
    phoneNumber: '',
    whatsappNumber: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
    occupation: '',
    monthlyIncome: '',
    tradingExperience: 'BEGINNER',
    investmentGoal: 'GROWTH',
    riskTolerance: 'MEDIUM',
    tradingHoursPerWeek: '',
    termsAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
    dataProcessingConsent: false,
  });

  const totalSteps = 5;

  const updateField = (field: keyof UserData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (currentStep: number): boolean => {
    switch(currentStep) {
      case 1: // Dados Pessoais
        if (!formData.fullName || !formData.dateOfBirth || !formData.documentNumber) {
          toast.error('Preencha todos os campos obrigatórios');
          return false;
        }
        return true;
      case 2: // Contato
        if (!formData.email || !formData.phoneNumber) {
          toast.error('Email e telefone são obrigatórios');
          return false;
        }
        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          toast.error('Email inválido');
          return false;
        }
        return true;
      case 3: // Endereço
        if (!formData.zipCode || !formData.street || !formData.city || !formData.state) {
          toast.error('Preencha os campos obrigatórios do endereço');
          return false;
        }
        return true;
      case 4: // Profissional
        if (!formData.occupation || !formData.monthlyIncome) {
          toast.error('Preencha as informações profissionais');
          return false;
        }
        return true;
      case 5: // Conformidade
        if (!formData.termsAccepted || !formData.privacyAccepted || !formData.dataProcessingConsent) {
          toast.error('Você deve aceitar os termos obrigatórios para continuar');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      // Send to backend
      const response = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/server/user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userData: formData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        toast.success('Cadastro Completo!', {
          description: 'Seus dados foram salvos com sucesso.',
        });
        onComplete(formData);
      } else {
        const error = await response.text();
        console.error('Erro ao salvar:', error);
        toast.error('Erro ao salvar os dados. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro de conexão. Verifique sua internet.');
    }
  };

  const fetchAddressByCEP = async (cep: string) => {
    if (cep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        updateField('street', data.logradouro);
        updateField('neighborhood', data.bairro);
        updateField('city', data.localidade);
        updateField('state', data.uf);
        toast.success('Endereço encontrado!');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">CADASTRO COMPLETO</h2>
              <p className="text-sm text-slate-400 mt-1">
                Complete seu perfil para acessar todos os recursos da plataforma
              </p>
            </div>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-sm text-slate-500 hover:text-white transition-colors"
              >
                Pular por enquanto
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all ${
                  s <= step ? 'bg-emerald-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-slate-500">Etapa {step} de {totalSteps}</span>
            <span className="text-xs text-emerald-400">{Math.round((step / totalSteps) * 100)}% completo</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[500px]">
          <AnimatePresence mode="wait">
            {/* STEP 1: DADOS PESSOAIS */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">DADOS PESSOAIS</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Data de Nascimento *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => updateField('dateOfBirth', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Tipo de Documento *
                      </label>
                      <select
                        value={formData.documentType}
                        onChange={(e) => updateField('documentType', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="CPF">CPF</option>
                        <option value="PASSPORT">Passaporte</option>
                        <option value="OTHER">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {formData.documentType === 'CPF' ? 'CPF' : 'Número do Documento'} *
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={formData.documentNumber}
                        onChange={(e) => updateField('documentNumber', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder={formData.documentType === 'CPF' ? '000.000.000-00' : 'Número do documento'}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CONTATO */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Phone className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">INFORMAÇÕES DE CONTATO</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Telefone *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => updateField('phoneNumber', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                          placeholder="+55 (11) 99999-9999"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="tel"
                          value={formData.whatsappNumber}
                          onChange={(e) => updateField('whatsappNumber', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                          placeholder="+55 (11) 99999-9999"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">Proteção de Dados</p>
                      <p className="text-xs text-blue-400">
                        Seus dados de contato são criptografados e nunca serão compartilhados com terceiros sem sua autorização.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: ENDEREÇO */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">ENDEREÇO RESIDENCIAL</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      CEP *
                    </label>
                    <div className="relative">
                      <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => {
                          updateField('zipCode', e.target.value);
                          if (e.target.value.replace(/\D/g, '').length === 8) {
                            fetchAddressByCEP(e.target.value.replace(/\D/g, ''));
                          }
                        }}
                        className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Digite o CEP para preencher automaticamente</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Rua/Avenida *
                      </label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => updateField('street', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Nome da rua"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Número
                      </label>
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => updateField('number', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={formData.complement}
                        onChange={(e) => updateField('complement', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Apto, Bloco, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => updateField('neighborhood', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Nome do bairro"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="São Paulo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Estado *
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        País
                      </label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => updateField('country', e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Brasil"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: PROFISSIONAL */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Briefcase className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">PERFIL PROFISSIONAL E INVESTIDOR</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Profissão/Ocupação *
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={formData.occupation}
                          onChange={(e) => updateField('occupation', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                          placeholder="Ex: Engenheiro, Empresário"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Renda Mensal Estimada *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <select
                          value={formData.monthlyIncome}
                          onChange={(e) => updateField('monthlyIncome', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Selecione</option>
                          <option value="0-3000">Até R$ 3.000</option>
                          <option value="3000-7000">R$ 3.000 - R$ 7.000</option>
                          <option value="7000-15000">R$ 7.000 - R$ 15.000</option>
                          <option value="15000-30000">R$ 15.000 - R$ 30.000</option>
                          <option value="30000+">Acima de R$ 30.000</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Experiência com Trading *
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'BEGINNER', label: 'Iniciante', desc: '0-1 ano' },
                        { value: 'INTERMEDIATE', label: 'Intermediário', desc: '1-3 anos' },
                        { value: 'ADVANCED', label: 'Avançado', desc: '3-5 anos' },
                        { value: 'PROFESSIONAL', label: 'Profissional', desc: '5+ anos' },
                      ].map((exp) => (
                        <button
                          key={exp.value}
                          onClick={() => updateField('tradingExperience', exp.value)}
                          className={`p-3 rounded-lg border transition-all ${
                            formData.tradingExperience === exp.value
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'
                          }`}
                        >
                          <div className="text-sm font-bold">{exp.label}</div>
                          <div className="text-xs opacity-70">{exp.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Objetivo de Investimento
                      </label>
                      <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <select
                          value={formData.investmentGoal}
                          onChange={(e) => updateField('investmentGoal', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="INCOME">Renda Passiva</option>
                          <option value="GROWTH">Crescimento Patrimonial</option>
                          <option value="PRESERVATION">Preservação de Capital</option>
                          <option value="SPECULATION">Especulação</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Tolerância a Risco
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <select
                          value={formData.riskTolerance}
                          onChange={(e) => updateField('riskTolerance', e.target.value)}
                          className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="LOW">Baixa (Conservador)</option>
                          <option value="MEDIUM">Média (Moderado)</option>
                          <option value="HIGH">Alta (Arrojado)</option>
                          <option value="VERY_HIGH">Muito Alta (Agressivo)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Horas Dedicadas ao Trading por Semana
                    </label>
                    <input
                      type="number"
                      value={formData.tradingHoursPerWeek}
                      onChange={(e) => updateField('tradingHoursPerWeek', e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      placeholder="Ex: 10"
                      min="0"
                      max="168"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: CONFORMIDADE */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">TERMOS E CONFORMIDADE</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.termsAccepted}
                        onChange={(e) => updateField('termsAccepted', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/20 bg-black checked:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                          Aceito os Termos de Uso e Condições *
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Li e concordo com os{' '}
                          <a href="#" className="text-emerald-400 hover:underline">
                            Termos de Uso
                          </a>{' '}
                          da plataforma.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.privacyAccepted}
                        onChange={(e) => updateField('privacyAccepted', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/20 bg-black checked:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                          Aceito a Política de Privacidade *
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Concordo com a{' '}
                          <a href="#" className="text-emerald-400 hover:underline">
                            Política de Privacidade
                          </a>{' '}
                          e tratamento dos meus dados pessoais.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.dataProcessingConsent}
                        onChange={(e) => updateField('dataProcessingConsent', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/20 bg-black checked:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                          Autorizo o Processamento dos Meus Dados (LGPD) *
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Autorizo o armazenamento e processamento dos meus dados pessoais conforme a LGPD.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.marketingConsent}
                        onChange={(e) => updateField('marketingConsent', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/20 bg-black checked:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                          Aceito Receber Comunicações de Marketing (Opcional)
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Desejo receber novidades, promoções e atualizações por email e WhatsApp.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                    <Lock className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-emerald-300">
                      <p className="font-medium mb-1">Seus Dados Estão Seguros</p>
                      <p className="text-xs text-emerald-400">
                        Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança
                        para proteger suas informações pessoais. Seus dados nunca serão vendidos ou compartilhados
                        sem sua autorização expressa.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              step === 1
                ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            VOLTAR
          </button>

          <button
            onClick={nextStep}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg hover:shadow-emerald-500/50"
          >
            {step === totalSteps ? (
              <>
                <CheckCircle className="w-4 h-4" />
                FINALIZAR CADASTRO
              </>
            ) : (
              <>
                PRÓXIMO
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
