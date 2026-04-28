import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Sparkles, Send, Calendar, ThumbsUp, MessageCircle, Share2, Instagram, Linkedin, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const socialAccounts = [
  { id: 'insta', name: 'NeuroTrading', platform: 'Instagram', followers: '12.4k', status: 'Connected', icon: Instagram },
  { id: 'linkedin', name: 'Neuro Financial Tech', platform: 'LinkedIn', followers: '8.2k', status: 'Connected', icon: Linkedin },
  { id: 'twitter', name: '@neuro_fi', platform: 'X / Twitter', followers: '5.1k', status: 'Disconnected', icon: Share2 },
];

const scheduledPosts = [
  { id: 1, title: 'Análise de Mercado - Abertura', platform: 'LinkedIn', time: 'Hoje, 09:00', status: 'Posted' },
  { id: 2, title: 'Dica de Trading #42', platform: 'Instagram', time: 'Hoje, 14:00', status: 'Scheduled' },
  { id: 3, title: 'Relatório Semanal de Cripto', platform: 'All', time: 'Amanhã, 10:00', status: 'Draft' },
];

export function MarketingModule() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<null | { text: string, tags: string[] }>(null);
  const [prompt, setPrompt] = useState('');

  const handleGenerate = () => {
    if (!prompt) return;
    setIsGenerating(true);
    // Simulate AI delay
    setTimeout(() => {
      setGeneratedContent({
        text: `🚀 O mercado não dorme, e a sua estratégia também não deveria.\n\nCom a Neuro AI, você acessa dados em tempo real e insights preditivos que colocam você à frente da curva. Não opere com base em palpites, opere com inteligência.\n\n🔗 Teste agora o nosso novo módulo de Ticker ao vivo!\n\n#NeuroTech #Trading #Fintech #AI #Investment`,
        tags: ['#NeuroTech', '#Trading', '#AI']
      });
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Connection Status */}
        <Card className="col-span-1 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5 text-cyan-400" /> Canais Conectados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {socialAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-md bg-slate-950/50 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${account.platform === 'Instagram' ? 'bg-pink-900/20 text-pink-500' : account.platform === 'LinkedIn' ? 'bg-blue-900/20 text-blue-500' : 'bg-slate-800 text-white'}`}>
                    <account.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{account.name}</p>
                    <p className="text-xs text-slate-500">{account.followers} seguidores</p>
                  </div>
                </div>
                <Badge variant="outline" className={account.status === 'Connected' ? "text-emerald-400 border-emerald-400/20" : "text-slate-500"}>
                  {account.status}
                </Badge>
              </div>
            ))}
            <Button variant="outline" className="w-full border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-slate-400 hover:text-cyan-400 transition-all">
              + Conectar Nova Conta
            </Button>
          </CardContent>
        </Card>

        {/* AI Generator */}
        <Card className="col-span-1 lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" /> Neuro Cortex AI - Content Studio
            </CardTitle>
            <CardDescription className="text-slate-400">
              Gere posts otimizados para engajamento orgânico com um clique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Objetivo da Campanha</label>
              <Input 
                placeholder="Ex: Promover o novo Ticker de criptomoedas..." 
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 focus:ring-purple-500/20 focus:border-purple-500/50"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <AnimatePresence mode="wait">
              {generatedContent && !isGenerating ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-slate-300 whitespace-pre-line">{generatedContent.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {generatedContent.tags.map(tag => (
                      <span key={tag} className="text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !prompt}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0"
              >
                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando Neuro Dados...</> : <><Zap className="mr-2 h-4 w-4" /> Gerar Conteúdo</>}
              </Button>
              {generatedContent && (
                 <Button variant="outline" className="border-slate-700 text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300">
                   <Send className="mr-2 h-4 w-4" /> Agendar
                 </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduler / Feed */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Agenda de Publicações</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {scheduledPosts.map((post) => (
                 <div key={post.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-800 hover:bg-slate-800/50 transition-colors">
                   <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                     <Calendar className="h-5 w-5" />
                   </div>
                   <div className="flex-1">
                     <h4 className="text-sm font-medium text-white">{post.title}</h4>
                     <p className="text-xs text-slate-500">{post.platform} • {post.time}</p>
                   </div>
                   <Badge variant={post.status === 'Posted' ? 'secondary' : post.status === 'Scheduled' ? 'default' : 'outline'}>
                     {post.status}
                   </Badge>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Engajamento Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500"></div>
                  <div className="space-y-2 flex-1">
                    <div className="bg-slate-800/50 p-3 rounded-lg rounded-tl-none border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">@investor_pro respondeu ao seu story:</p>
                      <p className="text-sm text-slate-200">"Incrível essa nova funcionalidade de geolocalização! As notícias do Yahoo Finance estão batendo certinho."</p>
                    </div>
                    <div className="flex gap-2">
                       <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-white"><ThumbsUp className="mr-1 h-3 w-3" /> Curtir</Button>
                       <Button size="sm" variant="ghost" className="h-7 text-xs text-cyan-400 hover:text-cyan-300"><MessageCircle className="mr-1 h-3 w-3" /> Resposta IA Automática</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}