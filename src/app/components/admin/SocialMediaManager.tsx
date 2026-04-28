import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  BarChart3, 
  Sparkles, 
  Send, 
  Calendar, 
  Users, 
  TrendingUp, 
  MousePointer2, 
  MoreHorizontal, 
  ThumbsUp, 
  Share2, 
  MessageCircle,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// Mock Data
const PERFORMANCE_DATA = [
  { name: 'Mon', followers: 12400, engagement: 2400, clicks: 120 },
  { name: 'Tue', followers: 12450, engagement: 1398, clicks: 145 },
  { name: 'Wed', followers: 12580, engagement: 9800, clicks: 350 }, // Viral post
  { name: 'Thu', followers: 12790, engagement: 3908, clicks: 210 },
  { name: 'Fri', followers: 12900, engagement: 4800, clicks: 290 },
  { name: 'Sat', followers: 13100, engagement: 3800, clicks: 180 },
  { name: 'Sun', followers: 13250, engagement: 4300, clicks: 230 },
];

const RECENT_INTERACTIONS = [
  { id: 1, user: 'CryptoWhale_99', platform: 'twitter', type: 'mention', content: 'The new @NeuralTech AI trading bot is insane! 🚀 #crypto #trading', time: '2m ago', sentiment: 'positive' },
  { id: 2, user: 'SarahInvests', platform: 'linkedin', type: 'comment', content: 'Great insights on the latest market trends. Would love to see more data on liquidity pools.', time: '15m ago', sentiment: 'neutral' },
  { id: 3, user: 'TradingViewPro', platform: 'instagram', type: 'reply', content: 'Dm sent! Interested in partnership.', time: '1h ago', sentiment: 'positive' },
  { id: 4, user: 'FUD_Buster', platform: 'twitter', type: 'mention', content: 'Is this legit? Seems too good to be true.', time: '2h ago', sentiment: 'negative' },
];

export function SocialMediaManager() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'studio' | 'community'>('dashboard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter']);
  const [previewPlatform, setPreviewPlatform] = useState('twitter');

  const togglePlatform = (p: string) => {
    if (selectedPlatforms.includes(p)) setSelectedPlatforms(prev => prev.filter(x => x !== p));
    else setSelectedPlatforms(prev => [...prev, p]);
  };

  const handleGenerate = () => {
    if (!prompt) return toast.error("Please enter a topic or prompt first.");
    setIsGenerating(true);
    
    // Simulate AI Generation
    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedContent(`🚀 **Market Alert: ${prompt}**\n\nOur Neural AI just detected a massive liquidity shift in the sector. Don't trade blindly.\n\nStats:\n• Volatility: High\n• Sentiment: Bullish\n\n#Trading #AI #FinTech #Crypto`);
      toast.success("Content generated successfully!");
    }, 2000);
  };

  const handlePost = () => {
    toast.success("Post scheduled for immediate publication across " + selectedPlatforms.length + " networks.");
    setGeneratedContent('');
    setPrompt('');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="px-6 py-6 border-b border-white/5 flex justify-between items-center bg-slate-950/50 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-6 h-6 text-purple-500" />
            Social Neural Grid
          </h1>
          <p className="text-sm text-slate-500">AI-Powered Audience Growth & Management</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Dashboard
          </button>
          <button 
             onClick={() => setActiveTab('studio')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'studio' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:text-white'}`}
          >
            AI Studio
          </button>
          <button 
             onClick={() => setActiveTab('community')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'community' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Community
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* Global KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard 
            title="Total Followers" 
            value="13,250" 
            trend="+12%" 
            icon={Users} 
            color="text-blue-400" 
          />
          <KPICard 
            title="Avg. Engagement" 
            value="8.4%" 
            trend="+2.1%" 
            icon={TrendingUp} 
            color="text-emerald-400" 
          />
          <KPICard 
            title="Link Clicks" 
            value="1,840" 
            trend="+24%" 
            icon={MousePointer2} 
            color="text-purple-400" 
          />
          <KPICard 
            title="Viral Score" 
            value="92/100" 
            trend="High" 
            icon={Zap} 
            color="text-amber-400" 
          />
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Main Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Growth & Engagement</h3>
                    <select className="bg-black/50 border border-white/10 rounded px-3 py-1 text-xs text-slate-400">
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                    </select>
                  </div>
                  <div className="h-[300px]" style={{ minHeight: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250}>
                      <AreaChart data={PERFORMANCE_DATA}>
                        <defs>
                          <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                          itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Area type="monotone" dataKey="engagement" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorEngage)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Platforms Breakdown */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
                   <h3 className="text-lg font-bold text-white mb-6">Network Distribution</h3>
                   <div className="space-y-4">
                      <NetworkStat icon={Twitter} name="X (Twitter)" percent={45} count="6.2k" color="text-sky-400" />
                      <NetworkStat icon={Linkedin} name="LinkedIn" percent={30} count="4.1k" color="text-blue-500" />
                      <NetworkStat icon={Instagram} name="Instagram" percent={15} count="2.1k" color="text-pink-500" />
                      <NetworkStat icon={Facebook} name="Facebook" percent={10} count="1.4k" color="text-blue-600" />
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'studio' && (
            <motion.div 
              key="studio"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full"
            >
              {/* Input Area */}
              <div className="space-y-6">
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    AI Content Generator
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">TARGET PLATFORMS</label>
                      <div className="flex gap-2">
                        <PlatformToggle active={selectedPlatforms.includes('twitter')} onClick={() => togglePlatform('twitter')} icon={Twitter} />
                        <PlatformToggle active={selectedPlatforms.includes('linkedin')} onClick={() => togglePlatform('linkedin')} icon={Linkedin} />
                        <PlatformToggle active={selectedPlatforms.includes('instagram')} onClick={() => togglePlatform('instagram')} icon={Instagram} />
                        <PlatformToggle active={selectedPlatforms.includes('facebook')} onClick={() => togglePlatform('facebook')} icon={Facebook} />
                      </div>
                    </div>

                    <div>
                       <label className="block text-xs font-medium text-slate-400 mb-2">TOPIC / PROMPT</label>
                       <textarea 
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Ex: Discuss the impact of Bitcoin halving on institutional liquidity..."
                          className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                       />
                    </div>
                    
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Generating Magic...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Generate Content
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-6">
                   <div className="flex gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg h-fit">
                         <TrendingUp className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-emerald-400 font-bold mb-1">Growth Tip</h4>
                        <p className="text-sm text-emerald-200/60 leading-relaxed">
                          Based on your analytics, your audience engages <strong>35% more</strong> with posts containing data visualizations posted between <strong>09:00 - 11:00 UTC</strong>.
                        </p>
                      </div>
                   </div>
                </div>
              </div>

              {/* Preview Area */}
              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">Preview</h3>
                  <div className="flex gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                     <button onClick={() => setPreviewPlatform('twitter')} className={`p-1.5 rounded transition-colors ${previewPlatform === 'twitter' ? 'bg-white/10 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`} title="X (Twitter)"><Twitter className="w-4 h-4"/></button>
                     <button onClick={() => setPreviewPlatform('linkedin')} className={`p-1.5 rounded transition-colors ${previewPlatform === 'linkedin' ? 'bg-white/10 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`} title="LinkedIn"><Linkedin className="w-4 h-4"/></button>
                     <button onClick={() => setPreviewPlatform('instagram')} className={`p-1.5 rounded transition-colors ${previewPlatform === 'instagram' ? 'bg-white/10 text-pink-500' : 'text-slate-500 hover:text-slate-300'}`} title="Instagram"><Instagram className="w-4 h-4"/></button>
                     <button onClick={() => setPreviewPlatform('facebook')} className={`p-1.5 rounded transition-colors ${previewPlatform === 'facebook' ? 'bg-white/10 text-blue-600' : 'text-slate-500 hover:text-slate-300'}`} title="Facebook"><Facebook className="w-4 h-4"/></button>
                  </div>
                </div>
                
                <div className="flex-1 bg-black/50 rounded-xl border border-white/5 p-6 flex items-center justify-center overflow-hidden">
                   {generatedContent ? (
                     <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
                        {previewPlatform === 'twitter' && <TwitterPreview content={generatedContent} />}
                        {previewPlatform === 'linkedin' && <LinkedInPreview content={generatedContent} />}
                        {previewPlatform === 'instagram' && <InstagramPreview content={generatedContent} />}
                        {previewPlatform === 'facebook' && <FacebookPreview content={generatedContent} />}
                     </div>
                   ) : (
                     <div className="text-center text-slate-600">
                        <LayoutDashboard className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>Generate content to see preview</p>
                     </div>
                   )}
                </div>

                {generatedContent && (
                  <div className="mt-6 flex gap-3">
                    <button className="flex-1 py-3 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 py-3 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 font-bold transition-colors flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </button>
                    <button 
                      onClick={handlePost}
                      className="flex-1 py-3 bg-white text-black rounded-lg hover:bg-slate-200 font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Post Now
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'community' && (
            <motion.div 
               key="community"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="space-y-6"
            >
               <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Inbox & Mentions</h3>
                  <div className="flex gap-2">
                     <button className="px-3 py-1 bg-white/10 rounded-lg text-xs font-medium text-white">All</button>
                     <button className="px-3 py-1 hover:bg-white/5 rounded-lg text-xs font-medium text-slate-500">Mentions</button>
                     <button className="px-3 py-1 hover:bg-white/5 rounded-lg text-xs font-medium text-slate-500">Comments</button>
                     <button className="px-3 py-1 hover:bg-white/5 rounded-lg text-xs font-medium text-slate-500">DMs</button>
                  </div>
               </div>

               <div className="space-y-4">
                  {RECENT_INTERACTIONS.map(item => (
                    <div key={item.id} className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex gap-4 hover:border-white/10 transition-colors group">
                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shrink-0">
                          <span className="font-bold text-xs text-white">{item.user[0]}</span>
                       </div>
                       <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{item.user}</span>
                                <span className="text-xs text-slate-500">{item.time}</span>
                                {item.platform === 'twitter' && <Twitter className="w-3 h-3 text-sky-500" />}
                                {item.platform === 'linkedin' && <Linkedin className="w-3 h-3 text-blue-500" />}
                                {item.platform === 'instagram' && <Instagram className="w-3 h-3 text-pink-500" />}
                             </div>
                             <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                               item.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' : 
                               item.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
                             }`}>
                                {item.sentiment}
                             </div>
                          </div>
                          <p className="text-sm text-slate-300 mb-3">{item.content}</p>
                          <div className="flex items-center gap-3">
                             <button className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Sparkles className="w-3 h-3" /> Auto-Reply
                             </button>
                             <button className="text-xs font-medium text-slate-500 hover:text-white flex items-center gap-1">
                                Reply
                             </button>
                             <button className="text-xs font-medium text-slate-500 hover:text-white flex items-center gap-1">
                                Like
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function KPICard({ title, value, trend, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <Icon className={`w-5 h-5 ${color} opacity-80`} />
      </div>
      <div className="flex items-baseline gap-2">
         <span className="text-2xl font-bold text-white">{value}</span>
         <span className="text-xs font-medium text-emerald-400">{trend}</span>
      </div>
    </div>
  );
}

function NetworkStat({ icon: Icon, name, percent, count, color }: any) {
   return (
      <div className="flex items-center gap-4">
         <div className={`w-8 h-8 rounded-lg ${color.replace('text', 'bg')}/10 flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${color}`} />
         </div>
         <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
               <span className="text-slate-300 font-medium">{name}</span>
               <span className="text-slate-500">{count}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
               <div className={`h-full ${color.replace('text', 'bg')} rounded-full`} style={{ width: `${percent}%` }} />
            </div>
         </div>
      </div>
   );
}

function PlatformToggle({ active, onClick, icon: Icon }: any) {
   return (
      <button 
         onClick={onClick}
         className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
            active 
            ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
            : 'bg-black/40 border-white/10 text-slate-600 hover:border-white/30 hover:text-slate-400'
         }`}
      >
         <Icon className="w-5 h-5" />
      </button>
   );
}

function TwitterPreview({ content }: { content: string }) {
  return (
    <div className="bg-white text-slate-900 rounded-xl p-4 shadow-xl font-sans w-full">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div>
                <div className="font-bold text-sm">Neural Day Trader</div>
                <div className="text-xs text-slate-500">@NeuralDayTrader</div>
            </div>
            <Twitter className="w-4 h-4 text-sky-500 ml-auto" />
        </div>
        <div className="text-sm whitespace-pre-wrap mb-4 leading-relaxed">
            {content}
        </div>
        <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
            <span className="text-xs font-mono">AI GENERATED IMAGE</span>
        </div>
        <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-100 px-2">
            <MessageCircle className="w-4 h-4" />
            <RefreshCw className="w-4 h-4" />
            <ThumbsUp className="w-4 h-4" />
            <Share2 className="w-4 h-4" />
        </div>
    </div>
  );
}

function LinkedInPreview({ content }: { content: string }) {
    return (
        <div className="bg-white text-slate-900 rounded-lg shadow-xl font-sans border border-slate-200 overflow-hidden w-full">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-10 h-10 rounded bg-slate-200" />
                <div className="flex-1">
                    <div className="font-bold text-sm text-slate-800">Neural Day Trader</div>
                    <div className="text-[10px] text-slate-500">FinTech • 12,450 followers</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">1h • <span className="text-xs">🌐</span></div>
                </div>
                <MoreHorizontal className="w-5 h-5 text-slate-500" />
            </div>
            <div className="p-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                {content}
            </div>
            <div className="h-56 bg-slate-100 flex items-center justify-center text-slate-400 border-y border-slate-100">
                 <span className="text-xs font-mono">LINKEDIN MEDIA ASSET</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-t border-slate-100">
                <button className="flex items-center gap-1 text-slate-500 text-xs font-medium"><ThumbsUp className="w-4 h-4"/> Like</button>
                <button className="flex items-center gap-1 text-slate-500 text-xs font-medium"><MessageSquare className="w-4 h-4"/> Comment</button>
                <button className="flex items-center gap-1 text-slate-500 text-xs font-medium"><RefreshCw className="w-4 h-4"/> Repost</button>
                <button className="flex items-center gap-1 text-slate-500 text-xs font-medium"><Send className="w-4 h-4"/> Send</button>
            </div>
        </div>
    );
}

function InstagramPreview({ content }: { content: string }) {
    return (
        <div className="bg-white text-slate-900 rounded-xl shadow-xl font-sans border border-slate-200 overflow-hidden w-full max-w-sm mx-auto">
             <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200" />
                    <span className="font-bold text-xs">neural_tech</span>
                </div>
                <MoreHorizontal className="w-4 h-4 text-slate-800" />
             </div>
             <div className="aspect-square bg-slate-100 flex items-center justify-center text-slate-400">
                 <span className="text-xs font-mono">INSTAGRAM PHOTO 1:1</span>
             </div>
             <div className="p-3">
                 <div className="flex justify-between mb-2">
                     <div className="flex gap-3">
                         <div className="w-6 h-6"><ThumbsUp className="w-full h-full text-slate-800" /></div>
                         <div className="w-6 h-6"><MessageCircle className="w-full h-full text-slate-800" /></div>
                         <div className="w-6 h-6"><Send className="w-full h-full text-slate-800" /></div>
                     </div>
                     <div className="w-6 h-6 border-slate-800 border-2 rounded-sm" /> 
                 </div>
                 <div className="text-xs font-bold mb-1">1,240 likes</div>
                 <div className="text-xs text-slate-800">
                    <span className="font-bold mr-1">neural_tech</span>
                    {content.substring(0, 100)}... <span className="text-slate-400">more</span>
                 </div>
             </div>
        </div>
    );
}

function FacebookPreview({ content }: { content: string }) {
    return (
        <div className="bg-white text-slate-900 rounded-lg shadow-xl font-sans border border-slate-200 overflow-hidden w-full">
            <div className="p-3 flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div>
                    <div className="font-bold text-sm text-slate-900">Neural Day Trader</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">Just now • 🌐</div>
                </div>
                <MoreHorizontal className="w-5 h-5 text-slate-500 ml-auto" />
            </div>
            <div className="px-3 pb-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-900">
                {content}
            </div>
            <div className="h-48 bg-slate-100 flex items-center justify-center text-slate-400 border-y border-slate-100">
                 <span className="text-xs font-mono">FACEBOOK MEDIA</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-t border-slate-100">
                <button className="flex items-center gap-2 text-slate-500 text-sm font-medium"><ThumbsUp className="w-5 h-5"/> Like</button>
                <button className="flex items-center gap-2 text-slate-500 text-sm font-medium"><MessageSquare className="w-5 h-5"/> Comment</button>
                <button className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Share2 className="w-5 h-5"/> Share</button>
            </div>
        </div>
    );
}