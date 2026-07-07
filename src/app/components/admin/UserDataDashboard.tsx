import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Download, Eye, Mail, Phone, MapPin,
  Calendar, Briefcase, Target, TrendingUp, AlertCircle, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface UserDataEntry {
  id: string;
  timestamp: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  dateOfBirth: string;
  documentType: string;
  documentNumber: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  occupation: string;
  monthlyIncome: string;
  tradingExperience: string;
  investmentGoal: string;
  riskTolerance: string;
  tradingHoursPerWeek: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  dataProcessingConsent: boolean;
}

export function UserDataDashboard() {
  const [users, setUsers] = useState<UserDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDataEntry | null>(null);
  const [filterExperience, setFilterExperience] = useState<string>('ALL');
  const [filterGoal, setFilterGoal] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/server/user-data`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        toast.error('Erro ao carregar dados de usuários');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (users.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Nome Completo', 'Email', 'Telefone', 'WhatsApp', 'Data Nascimento',
      'Tipo Doc', 'Número Doc', 'CEP', 'Rua', 'Número', 'Complemento',
      'Bairro', 'Cidade', 'Estado', 'País', 'Profissão', 'Renda Mensal',
      'Experiência Trading', 'Objetivo Investimento', 'Tolerância Risco',
      'Horas/Semana', 'Data Cadastro', 'Marketing Consent'
    ];

    const csvData = users.map(user => [
      user.fullName,
      user.email,
      user.phoneNumber,
      user.whatsappNumber,
      user.dateOfBirth,
      user.documentType,
      user.documentNumber,
      user.zipCode,
      user.street,
      user.number,
      user.complement,
      user.neighborhood,
      user.city,
      user.state,
      user.country,
      user.occupation,
      user.monthlyIncome,
      user.tradingExperience,
      user.investmentGoal,
      user.riskTolerance,
      user.tradingHoursPerWeek,
      new Date(user.timestamp).toLocaleString('pt-BR'),
      user.marketingConsent ? 'SIM' : 'NÃO'
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `user_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Dados exportados com sucesso!');
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phoneNumber.includes(searchTerm);
    
    const matchesExperience = filterExperience === 'ALL' || user.tradingExperience === filterExperience;
    const matchesGoal = filterGoal === 'ALL' || user.investmentGoal === filterGoal;

    return matchesSearch && matchesExperience && matchesGoal;
  });

  const stats = {
    total: users.length,
    withMarketing: users.filter(u => u.marketingConsent).length,
    beginners: users.filter(u => u.tradingExperience === 'BEGINNER').length,
    professionals: users.filter(u => u.tradingExperience === 'PROFESSIONAL').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-500" />
            DADOS DE USUÁRIOS COLETADOS
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gerenciamento completo dos dados de cadastro dos usuários
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-all"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase font-bold">Total de Usuários</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.total}</p>
        </div>

        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase font-bold">Consentimento Marketing</span>
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.withMarketing}</p>
          <p className="text-xs text-slate-500 mt-1">
            {((stats.withMarketing / stats.total) * 100).toFixed(0)}% do total
          </p>
        </div>

        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase font-bold">Iniciantes</span>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.beginners}</p>
        </div>

        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase font-bold">Profissionais</span>
            <Target className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.professionals}</p>
        </div>
      </div>

      {/* Filters (Collapsible) */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-neutral-900 border border-white/10 rounded-xl p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Experiência em Trading
                </label>
                <select
                  value={filterExperience}
                  onChange={(e) => setFilterExperience(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="BEGINNER">Iniciante</option>
                  <option value="INTERMEDIATE">Intermediário</option>
                  <option value="ADVANCED">Avançado</option>
                  <option value="PROFESSIONAL">Profissional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Objetivo de Investimento
                </label>
                <select
                  value={filterGoal}
                  onChange={(e) => setFilterGoal(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="INCOME">Renda Passiva</option>
                  <option value="GROWTH">Crescimento</option>
                  <option value="PRESERVATION">Preservação</option>
                  <option value="SPECULATION">Especulação</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Users Table */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/50 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Cidade/Estado
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Experiência
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Data Cadastro
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400 font-bold text-sm">
                            {user.fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.fullName}</p>
                          <p className="text-xs text-slate-500">{user.documentNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{user.phoneNumber}</p>
                      {user.whatsappNumber && (
                        <p className="text-xs text-emerald-400">WhatsApp: {user.whatsappNumber}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{user.city}/{user.state}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                        user.tradingExperience === 'PROFESSIONAL' ? 'bg-purple-500/20 text-purple-400' :
                        user.tradingExperience === 'ADVANCED' ? 'bg-blue-500/20 text-blue-400' :
                        user.tradingExperience === 'INTERMEDIATE' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {user.tradingExperience}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">
                        {new Date(user.timestamp).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(user.timestamp).toLocaleTimeString('pt-BR')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-xs font-bold transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-900 border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-neutral-900 border-b border-white/10 p-6 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedUser.fullName}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Cadastrado em {new Date(selectedUser.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Dados Pessoais
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Data de Nascimento" value={new Date(selectedUser.dateOfBirth).toLocaleDateString('pt-BR')} icon={<Calendar className="w-4 h-4" />} />
                    <InfoField label="Documento" value={`${selectedUser.documentType}: ${selectedUser.documentNumber}`} icon={<Target className="w-4 h-4" />} />
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <h4 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contato
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Email" value={selectedUser.email} icon={<Mail className="w-4 h-4" />} />
                    <InfoField label="Telefone" value={selectedUser.phoneNumber} icon={<Phone className="w-4 h-4" />} />
                    {selectedUser.whatsappNumber && (
                      <InfoField label="WhatsApp" value={selectedUser.whatsappNumber} icon={<Phone className="w-4 h-4" />} />
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h4 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="CEP" value={selectedUser.zipCode} />
                    <InfoField label="Rua" value={selectedUser.street} />
                    <InfoField label="Número" value={selectedUser.number} />
                    {selectedUser.complement && <InfoField label="Complemento" value={selectedUser.complement} />}
                    <InfoField label="Bairro" value={selectedUser.neighborhood} />
                    <InfoField label="Cidade" value={selectedUser.city} />
                    <InfoField label="Estado" value={selectedUser.state} />
                    <InfoField label="País" value={selectedUser.country} />
                  </div>
                </div>

                {/* Profissional */}
                <div>
                  <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Informações Profissionais
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Profissão" value={selectedUser.occupation} />
                    <InfoField label="Renda Mensal" value={selectedUser.monthlyIncome} />
                    <InfoField label="Experiência Trading" value={selectedUser.tradingExperience} />
                    <InfoField label="Objetivo Investimento" value={selectedUser.investmentGoal} />
                    <InfoField label="Tolerância a Risco" value={selectedUser.riskTolerance} />
                    {selectedUser.tradingHoursPerWeek && (
                      <InfoField label="Horas/Semana" value={`${selectedUser.tradingHoursPerWeek}h`} />
                    )}
                  </div>
                </div>

                {/* Consentimentos */}
                <div>
                  <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-3">
                    Consentimentos
                  </h4>
                  <div className="space-y-2">
                    <ConsentBadge label="Termos de Uso" accepted={selectedUser.termsAccepted} />
                    <ConsentBadge label="Política de Privacidade" accepted={selectedUser.privacyAccepted} />
                    <ConsentBadge label="Processamento de Dados (LGPD)" accepted={selectedUser.dataProcessingConsent} />
                    <ConsentBadge label="Marketing" accepted={selectedUser.marketingConsent} optional />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-black/30 border border-white/5 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <p className="text-xs text-slate-400 uppercase font-bold">{label}</p>
      </div>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}

function ConsentBadge({ label, accepted, optional = false }: { label: string; accepted: boolean; optional?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
      accepted 
        ? 'bg-emerald-500/10 border-emerald-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <span className={`text-sm font-medium ${accepted ? 'text-emerald-400' : 'text-red-400'}`}>
        {label} {optional && <span className="text-xs opacity-50">(Opcional)</span>}
      </span>
      <span className={`text-xs font-bold px-2 py-1 rounded ${
        accepted 
          ? 'bg-emerald-500/20 text-emerald-400' 
          : 'bg-red-500/20 text-red-400'
      }`}>
        {accepted ? 'ACEITO' : 'NÃO ACEITO'}
      </span>
    </div>
  );
}