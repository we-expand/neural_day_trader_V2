import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Mail, Activity, Wifi, Shield, RefreshCw, UserCheck, Fingerprint, Globe, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Sheet, SheetContent } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { projectId } from "../../../../utils/supabase/info";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function UserIntelligence() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const fetchUsers = async () => {
      setLoading(true);
      try {
          // 🚨 FIX (auditoria 2026-08-03): a rota /list-users agora exige um JWT de
          // admin de verdade (ver requireAdmin em supabase/functions/server/index.ts)
          // -- a anon key pública nunca deveria ter sido aceita aqui, expunha email +
          // metadata de todo mundo pra quem chamasse a API direto, sem estar logado.
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
              toast.error('Sessão expirada — faça login novamente');
              setUsers([]);
              return;
          }

          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/server/list-users`, {
             method: 'GET',
             headers: {
                 'Authorization': `Bearer ${accessToken}`,
                 'Content-Type': 'application/json'
             }
          });

          if (!response.ok) {
              if (response.status === 403) {
                  toast.error('Acesso restrito a administradores');
              } else {
                  console.warn('Falha ao carregar usuários do servidor');
              }
              setUsers([]);
              return;
          }

          const data = await response.json();
          if (data.error) throw new Error(data.error);

          if (data.users) {
              // 🚨 FIX (auditoria 2026-08-03): removido TODO campo fabricado que
              // fingia ser dado real (wallet = UUID cortado, networkNode = dígitos
              // extraídos da data de criação, riskScore/netWorth/kycLevel/location
              // já vinham null da Fase 0 mas ainda eram exibidos como se fossem
              // "0/100"/"$NaNk"). Só campos que a rota realmente devolve, direto do
              // Supabase Auth -- nada inventado.
              const formatted = data.users.map((u: any) => ({
                  id: u.id,
                  name: u.user_metadata?.name || u.email?.split('@')[0] || 'Sem nome',
                  email: u.email,
                  createdAt: u.created_at,
                  lastSignInAt: u.last_sign_in_at,
                  emailConfirmedAt: u.email_confirmed_at,
                  // "everLoggedIn" -- só sabemos SE já logou alguma vez, não se está
                  // online AGORA. Não existe telemetria de sessão/presença ligada
                  // hoje (ver UserTracker.tsx, componente pronto mas não montado em
                  // lugar nenhum da aplicação) -- não fabricar "online em tempo real".
                  everLoggedIn: !!u.last_sign_in_at,
              }));
              setUsers(formatted);
          }
      } catch (e: any) {
          console.error("Failed to fetch users", e);
          toast.error("Falha ao carregar usuários");
          setUsers([]);
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
                      {/* Sem foto real do usuário disponível -- antes usava um avatar
                          genérico de terceiro (pravatar.cc) fingindo ser a foto da
                          pessoa. Só iniciais. */}
                      <Avatar className="h-20 w-20 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                        <AvatarFallback className="bg-cyan-950 text-cyan-400 text-xl font-bold">
                           {selectedUser.name.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="mb-1">
                         <h2 className="text-2xl font-bold text-white tracking-tight">{selectedUser.name}</h2>
                         <div className="flex items-center gap-2 text-cyan-400/80 text-sm font-mono">
                            <Shield className="w-3 h-3" />
                            <span>ID: {selectedUser.id.substring(0,8).toUpperCase()}</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* 🚨 FIX (auditoria 2026-08-03): dossiê inteiro reescrito -- removido
                    tudo que era fabricado (score de risco, net worth, "Reputação A+",
                    carteiras Binance/Ethereum, depósitos/saques, perfil psicométrico,
                    log stream fake, telefone/2FA e localização inventados). Mostra só o
                    que a rota /list-users realmente devolve (Supabase Auth real), com
                    estado vazio honesto pro que não está instrumentado ainda. */}
                <ScrollArea className="flex-1 p-6">
                   <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                         <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-slate-500" />
                            <div>
                               <p className="text-xs text-slate-500">Email</p>
                               <p className="text-sm text-white">{selectedUser.email}</p>
                            </div>
                         </div>
                         <Badge className={selectedUser.emailConfirmedAt ? "bg-emerald-500/10 text-emerald-400 border-none" : "bg-slate-500/10 text-slate-400 border-none"}>
                            {selectedUser.emailConfirmedAt ? 'Email confirmado' : 'Email não confirmado'}
                         </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                         <div className="flex items-center gap-3">
                            <History className="w-4 h-4 text-slate-500" />
                            <div>
                               <p className="text-xs text-slate-500">Conta criada em</p>
                               <p className="text-sm text-white">{new Date(selectedUser.createdAt).toLocaleString('pt-BR')}</p>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-800">
                         <div className="flex items-center gap-3">
                            <Activity className="w-4 h-4 text-slate-500" />
                            <div>
                               <p className="text-xs text-slate-500">Último login</p>
                               <p className="text-sm text-white">
                                  {selectedUser.lastSignInAt ? new Date(selectedUser.lastSignInAt).toLocaleString('pt-BR') : 'Nunca fez login'}
                               </p>
                            </div>
                         </div>
                      </div>

                      {/* Estado vazio honesto -- IP, geolocalização, dispositivo e
                          presença online em tempo real NÃO estão instrumentados hoje.
                          Existe um componente pronto (UserTracker.tsx) e uma rota no
                          Edge Function (/telemetry/track) mas nenhum dos dois está
                          ligado em produção -- ligar isso é uma decisão de produto
                          separada (implicação de LGPD, precisa alinhar com a tela
                          "Dados de Usuários (LGPD)"), não fingir que já existe. */}
                      <div className="p-4 bg-slate-900/20 border border-dashed border-slate-700 rounded-lg text-center space-y-1">
                         <Globe className="w-5 h-5 text-slate-600 mx-auto" />
                         <p className="text-xs text-slate-500">
                            IP, localização, dispositivo e presença online em tempo real ainda não são coletados por este sistema.
                         </p>
                      </div>
                   </div>
                </ScrollArea>
             </div>
           )}
        </SheetContent>
      </Sheet>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Inteligência de Usuários</h2>
          {/* 🚨 FIX (auditoria 2026-08-03): a promessa "monitoramento em tempo real de
              identidades e status de rede" não correspondia a NENHUM dado real -- não
              existe telemetria de IP/dispositivo/presença online ligada hoje. Texto
              honesto sobre o que a tela realmente mostra. */}
          <p className="text-slate-400">Base real de usuários (Supabase Auth) — sem telemetria de rede/dispositivo ligada ainda.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
             {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
             Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards -- só métricas reais, calculadas a partir do que a rota devolve */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium text-slate-400">Já fizeram login</CardTitle>
            <Wifi className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {users.filter(u => u.everLoggedIn).length}
            </div>
            <p className="text-xs text-slate-500">Ao menos 1 sessão iniciada (não é "online agora")</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Emails confirmados</CardTitle>
            <UserCheck className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
                 {users.filter(u => u.emailConfirmedAt).length}
            </div>
            <p className="text-xs text-slate-500">de {users.length} cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Base de Usuários</CardTitle>
              <CardDescription className="text-slate-400">Dados reais do Supabase Auth.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[300px] bg-slate-950 border-slate-800 text-slate-200 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-900/50">
                <TableHead className="text-slate-400">Usuário</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Email</TableHead>
                <TableHead className="text-slate-400">Criado em</TableHead>
                <TableHead className="text-slate-400 text-right">Último login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => openDossier(user)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-700">
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
                      className={
                        user.everLoggedIn
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }
                    >
                      {user.everLoggedIn ? 'Já logou' : 'Nunca logou'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="h-3 w-3 text-slate-500" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-300 text-sm">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-slate-300 text-sm">
                      {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('pt-BR') : '—'}
                    </span>
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
