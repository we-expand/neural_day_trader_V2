import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Save, Shield, Bell, Key, Globe, Mail, Smartphone, User } from 'lucide-react';
import { toast } from 'sonner';

export function AdminSettings() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [mfa, setMfa] = useState(true);

  const handleSave = () => {
    toast.success("Configurações do sistema atualizadas com sucesso.", {
      description: "As alterações entrarão em vigor imediatamente."
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Configurações do Sistema</h2>
          <p className="text-slate-400">Gerencie parâmetros globais, segurança e integrações.</p>
        </div>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="mr-2 h-4 w-4" /> Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="security">Segurança & Acesso</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="api">API & Integrações</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-400" /> Identidade da Plataforma
              </CardTitle>
              <CardDescription>Informações visíveis para os usuários finais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Nome da Plataforma</label>
                  <Input defaultValue="Neuro Financial Technology" className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Moeda Base</label>
                  <Input defaultValue="EUR (€)" className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email de Suporte</label>
                <Input defaultValue="support@neuro-fi.tech" className="bg-slate-950 border-slate-800 text-white" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" /> Segurança Administrativa
              </CardTitle>
              <CardDescription>Controle quem pode acessar o painel de administração.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-white font-medium">Autenticação de Dois Fatores (2FA)</div>
                  <div className="text-sm text-slate-400">Obrigatório para todos os administradores.</div>
                </div>
                <Switch checked={mfa} onCheckedChange={setMfa} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-white font-medium">Whitelist de IP</div>
                  <div className="text-sm text-slate-400">Restringir acesso apenas a IPs corporativos (Portugal).</div>
                </div>
                <Switch />
              </div>
              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Sessões Ativas</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-500"><Globe className="h-4 w-4" /></div>
                      <div>
                        <p className="text-sm font-medium text-white">Lisboa, PT (Este dispositivo)</p>
                        <p className="text-xs text-slate-500">Chrome on MacOS • IP: 188.24.12.90</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">Ativo</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-400" /> Canais de Comunicação
              </CardTitle>
              <CardDescription>Configure como a plataforma se comunica com os usuários.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-white font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" /> Emails Transacionais
                  </div>
                  <div className="text-sm text-slate-400">Enviar emails reais de boas-vindas, redefinição de senha e alertas.</div>
                </div>
                <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
              </div>
               <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-white font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-slate-400" /> Push Notifications
                  </div>
                  <div className="text-sm text-slate-400">Alertas em tempo real no navegador/mobile.</div>
                </div>
                <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
              </div>
              
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400 mb-2 font-bold">⚠️ Integração SMTP</p>
                <p className="text-xs text-amber-200/80 mb-3">
                  Para envio real de emails, configure suas credenciais SMTP ou API Key (SendGrid/AWS SES).
                  No ambiente atual, os emails são simulados no log do sistema.
                </p>
                <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
                  Configurar Servidor SMTP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="space-y-4 mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
             <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-orange-400" /> Chaves de API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">OpenAI API Key (Neuro Cortex)</label>
                <div className="flex gap-2">
                   <Input type="password" value="sk-........................" disabled className="bg-slate-950 border-slate-800 text-slate-500" />
                   <Button variant="outline" className="shrink-0 border-slate-700">Alterar</Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Yahoo Finance API</label>
                <div className="flex gap-2">
                   <Input type="password" value="yf-........................" disabled className="bg-slate-950 border-slate-800 text-slate-500" />
                   <Button variant="outline" className="shrink-0 border-slate-700">Alterar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}