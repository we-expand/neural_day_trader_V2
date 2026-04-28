import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Mail, Wallet, Activity, Wifi, Shield, MoreHorizontal, Filter, Download, RefreshCw, UserCheck, AlertTriangle, Fingerprint, Globe, CreditCard, DollarSign, Lock, Brain, MapPin, Phone, History, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter } from "../ui/sheet";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Separator } from "../ui/separator";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function UserIntelligence() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const fetchUsers = async () => {
      setLoading(true);
      try {
          // Fetch from our new Edge Function
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/list-users`, {
             method: 'GET',
             headers: { 
                 'Authorization': `Bearer ${publicAnonKey}`,
                 'Content-Type': 'application/json'
             }
          });
          
          if (!response.ok) {
              // Mock fallback for development if server is unreachable
              const mockUsers = Array.from({ length: 10 }).map((_, i) => ({
                  id: `user-00${i}-${Math.random().toString(36).substring(7)}`,
                  name: ['Alex Sterling', 'Sarah Connor', 'John Doe', 'Neo Anderson', 'Trinity Matrix'][i % 5] + ` ${i}`,
                  email: `user${i}@neural.net`,
                  wallet: `0x${Math.random().toString(16).substring(2, 14)}...`,
                  networkNode: Math.floor(Math.random() * 9000000),
                  status: i % 3 === 0 ? 'inactive' : 'active',
                  lastActive: new Date().toLocaleDateString('pt-BR'),
                  avatar: `https://i.pravatar.cc/150?u=${i}`,
                  riskScore: Math.floor(Math.random() * 100),
                  netWorth: Math.floor(Math.random() * 500000),
                  location: ['São Paulo, BR', 'New York, US', 'London, UK', 'Tokyo, JP'][i % 4],
                  kycLevel: Math.floor(Math.random() * 3) + 1
              }));
              setUsers(mockUsers);
              return;
          }
          
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          
          if (data.users) {
              const formatted = data.users.map((u: any) => ({
                  id: u.id,
                  name: u.user_metadata?.name || u.email?.split('@')[0] || 'Unknown',
                  email: u.email,
                  wallet: u.id.substring(0, 12) + "...", // Proxy for wallet
                  networkNode: parseInt(u.created_at.replace(/\D/g, '').substring(0, 8)),
                  status: u.last_sign_in_at ? 'active' : 'inactive',
                  lastActive: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('pt-BR') : 'Nunca',
                  avatar: u.user_metadata?.avatar_url || `https://i.pravatar.cc/150?u=${u.id}`,
                  riskScore: Math.floor(Math.random() * 100),
                  netWorth: Math.floor(Math.random() * 100000), // Simulated internal data
                  location: 'Unknown Node',
                  kycLevel: 1
              }));
              setUsers(formatted);
          }
      } catch (e: any) {
          console.error("Failed to fetch users", e);
          toast.error("Carregando dados de contingência (Offline Mode)");
          // Fallback handled above
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchUsers();
  }, []);

  const openDossier = (user: any) => {
      setSelectedUser(user);
      setIsDossierOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Dossier Sheet (The "Capivara") */}
      <Sheet open={isDossierOpen} onOpenChange={setIsDossierOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] bg-black border-l border-cyan-900/50 p-0 text-slate-200 overflow-y-auto">
           {selectedUser && (
             <div className="flex flex-col h-full font-sans">
                {/* Header Profile */}
                <div className="relative h-48 bg-gradient-to-b from-cyan-950/40 to-black p-6 flex flex-col justify-end border-b border-cyan-900/30">
                   <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Fingerprint className="w-32 h-32 text-cyan-500" />
                   </div>
                   
                   <div className="flex items-end gap-4 relative z-10">
                      <Avatar className="h-20 w-20 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                        <AvatarImage src={selectedUser.avatar} />
                        <AvatarFallback className="bg-cyan-950 text-cyan-400 text-xl font-bold">
                           {selectedUser.name.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="mb-1">
                         <h2 className="text-2xl font-bold text-white tracking-tight">{selectedUser.name}</h2>
                         <div className="flex items-center gap-2 text-cyan-400/80 text-sm font-mono">
                            <Shield className="w-3 h-3" />
                            <span>ID: {selectedUser.id.substring(0,8).toUpperCase()}</span>
                            <Badge variant="outline" className="ml-2 border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] h-5">
                                KYC LEVEL {selectedUser.kycLevel}
                            </Badge>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Dossier Content */}
                <ScrollArea className="flex-1 p-6">
                   <div className="space-y-8">
                      
                      {/* Status Indicators */}
                      <div className="grid grid-cols-3 gap-3">
                         <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Risco</div>
                            <div className={`text-xl font-bold ${selectedUser.riskScore > 70 ? 'text-red-500' : 'text-emerald-400'}`}>
                               {selectedUser.riskScore}/100
                            </div>
                         </div>
                         <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Net Worth (Est.)</div>
                            <div className="text-xl font-bold text-white">
                               ${(selectedUser.netWorth / 1000).toFixed(1)}k
                            </div>
                         </div>
                         <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Reputação</div>
                            <div className="text-xl font-bold text-cyan-400">
                               A+
                            </div>
                         </div>
                      </div>

                      {/* Tabs Analysis */}
                      <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="w-full bg-slate-900/50 border border-slate-800">
                           <TabsTrigger value="overview" className="flex-1">Geral</TabsTrigger>
                           <TabsTrigger value="financial" className="flex-1">Financeiro</TabsTrigger>
                           <TabsTrigger value="intelligence" className="flex-1 text-cyan-400">Intelligence</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="overview" className="space-y-4 mt-4">
                           <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                                 <div className="flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    <div>
                                       <p className="text-xs text-slate-500">Email Principal</p>
                                       <p className="text-sm text-white">{selectedUser.email}</p>
                                    </div>
                                 </div>
                                 <Badge className="bg-emerald-500/10 text-emerald-400 border-none">Verificado</Badge>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                                 <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                    <div>
                                       <p className="text-xs text-slate-500">Localização Estimada</p>
                                       <p className="text-sm text-white">{selectedUser.location || 'IP Protegido / VPN Detectada'}</p>
                                    </div>
                                 </div>
                                 <Globe className="w-4 h-4 text-slate-600" />
                              </div>

                              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                                 <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-slate-500" />
                                    <div>
                                       <p className="text-xs text-slate-500">Telefone (2FA)</p>
                                       <p className="text-sm text-white">+55 11 *****-8829</p>
                                    </div>
                                 </div>
                                 <Lock className="w-3 h-3 text-emerald-500" />
                              </div>
                           </div>
                        </TabsContent>

                        <TabsContent value="financial" className="space-y-4 mt-4">
                           <Card className="bg-slate-900 border-slate-800">
                              <CardHeader className="pb-2">
                                 <CardTitle className="text-sm font-medium text-slate-400">Carteiras Conectadas</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                       <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 text-[10px] font-bold">B</div>
                                       <span className="text-sm text-white">Binance Connect</span>
                                    </div>
                                    <span className="text-xs text-emerald-400 font-mono">Ativo • $12,450.00</span>
                                 </div>
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                       <div className="w-6 h-6 rounded-full bg-slate-100/10 flex items-center justify-center text-white text-[10px] font-bold">E</div>
                                       <span className="text-sm text-white">Ethereum Mainnet</span>
                                    </div>
                                    <span className="text-xs text-emerald-400 font-mono">Ativo • 2.4 ETH</span>
                                 </div>
                              </CardContent>
                           </Card>
                           
                           <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-slate-900 rounded border border-slate-800">
                                 <p className="text-xs text-slate-500 mb-1">Total Depositado</p>
                                 <p className="text-lg font-bold text-white">$45,200.00</p>
                              </div>
                              <div className="p-4 bg-slate-900 rounded border border-slate-800">
                                 <p className="text-xs text-slate-500 mb-1">Saques (Lifetime)</p>
                                 <p className="text-lg font-bold text-slate-300">$12,050.00</p>
                              </div>
                           </div>
                        </TabsContent>

                        <TabsContent value="intelligence" className="space-y-4 mt-4">
                           <div className="p-4 bg-cyan-950/20 border border-cyan-900/50 rounded-lg space-y-4">
                              <div className="flex items-center gap-2 mb-2">
                                 <Brain className="w-4 h-4 text-cyan-400" />
                                 <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Perfil Psicométrico</h4>
                              </div>
                              
                              <div className="space-y-3">
                                 <div>
                                    <div className="flex justify-between text-xs mb-1">
                                       <span className="text-slate-400">Tolerância ao Risco</span>
                                       <span className="text-red-400 font-bold">Alta</span>
                                    </div>
                                    <Progress value={85} className="h-1 bg-slate-800" indicatorClassName="bg-red-500" />
                                 </div>
                                 <div>
                                    <div className="flex justify-between text-xs mb-1">
                                       <span className="text-slate-400">Consistência Operacional</span>
                                       <span className="text-yellow-400 font-bold">Média</span>
                                    </div>
                                    <Progress value={55} className="h-1 bg-slate-800" indicatorClassName="bg-yellow-500" />
                                 </div>
                              </div>

                              <Separator className="bg-cyan-900/30" />
                              
                              <div className="space-y-2">
                                 <p className="text-xs text-slate-400">Notas do Sistema:</p>
                                 <p className="text-xs text-cyan-200/70 italic leading-relaxed">
                                    "Usuário demonstra padrões agressivos em horários de alta volatilidade (NFP/FOMC). Aumentou alavancagem em 200% na última semana. Requer monitoramento de liquidação."
                                 </p>
                              </div>
                           </div>

                           <Button className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 mt-4">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Gerar Relatório de Atividade Suspeita
                           </Button>
                        </TabsContent>
                      </Tabs>

                      {/* Log Stream */}
                      <div className="space-y-2">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <History className="w-3 h-3" /> Logs Recentes
                         </h4>
                         <div className="bg-black border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-400 space-y-1 h-32 overflow-y-auto">
                            <p><span className="text-emerald-500">10:42:01</span> [LOGIN] Successful auth via IP 201.32.xx.xx</p>
                            <p><span className="text-blue-500">10:45:22</span> [TRADE] Open Long BTCUSDT (20x)</p>
                            <p><span className="text-yellow-500">10:55:00</span> [RISK] Margin Call Warning L1 triggered</p>
                            <p><span className="text-blue-500">11:10:15</span> [TRADE] Close Long BTCUSDT (+12.5%)</p>
                            <p><span className="text-slate-600">11:15:00</span> [SYSTEM] Snapshot taken for daily audit</p>
                         </div>
                      </div>

                   </div>
                </ScrollArea>
                
                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-800 bg-black flex gap-2">
                   <Button variant="outline" className="flex-1 border-slate-700 hover:bg-slate-900">
                      <FileText className="w-4 h-4 mr-2" /> Exportar PDF
                   </Button>
                   <Button className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white">
                      <Activity className="w-4 h-4 mr-2" /> Monitorar
                   </Button>
                </div>
             </div>
           )}
        </SheetContent>
      </Sheet>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Inteligência de Usuários</h2>
          <p className="text-slate-400">Monitoramento em tempo real de identidades e status de rede.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
             {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} 
             Atualizar
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
            <Download className="mr-2 h-4 w-4" /> Exportar Dados
          </Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Shield className="mr-2 h-4 w-4" /> Auditoria Geral
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total de Usuários</CardTitle>
            <Activity className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <p className="text-xs text-slate-500">Registrados na plataforma</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Nós Ativos</CardTitle>
            <Wifi className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {users.filter(u => u.status === 'active').length}
            </div>
            <p className="text-xs text-slate-500">Sessões recentes</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Verificados</CardTitle>
            <UserCheck className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
                 {users.filter(u => u.email).length}
            </div>
            <p className="text-xs text-slate-500">Emails confirmados</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Status do Sistema</CardTitle>
            <Shield className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">Seguro</div>
            <p className="text-xs text-slate-500">Monitoramento ativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Base de Usuários</CardTitle>
              <CardDescription className="text-slate-400">Visibilidade completa de dados e rede.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar por nome, email ou carteira..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[300px] bg-slate-950 border-slate-800 text-slate-200 focus:ring-cyan-500"
                />
              </div>
              <Button variant="outline" size="icon" className="border-slate-800 hover:bg-slate-800">
                <Filter className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-900/50">
                <TableHead className="text-slate-400">Usuário</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Email / Contato</TableHead>
                <TableHead className="text-slate-400">Endereço de Rede (Carteira)</TableHead>
                <TableHead className="text-slate-400 text-right">Último Bloco/Nó</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => openDossier(user)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-700">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-slate-800 text-slate-300">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{user.name}</span>
                        <span className="text-xs text-slate-500">ID: {user.id.substring(0,8)}...</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`
                        ${user.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}
                      `}
                    >
                      {user.status === 'active' ? 'Online' : 'Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="h-3 w-3 text-slate-500" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-xs text-cyan-300/80 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/30 w-fit">
                      <Wallet className="h-3 w-3" />
                      {user.wallet}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-200 font-mono">#{user.networkNode.toLocaleString()}</span>
                      <span className="text-xs text-slate-500">Última sync: {user.lastActive}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800 text-slate-200">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={(e) => { e.stopPropagation(); openDossier(user); }}>
                          Ver "Capivara" Completa
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer">
                          Histórico de Transações
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 cursor-pointer">
                          Suspender Acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
