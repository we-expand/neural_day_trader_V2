import React, { useState } from 'react';
import { Bell, Mail, CheckCircle2, Zap, X, Shield, Settings, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from "motion/react";
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'trade' | 'alert' | 'social';
  timestamp: Date;
  read: boolean;
  action?: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'AI Logic Upgrade v2.4',
    message: 'Algoritmo de cálculo PnL atualizado com precisão de swap institucional.',
    type: 'system',
    timestamp: new Date(),
    read: false,
    action: 'Ver Log'
  },
  {
    id: '2',
    title: 'Rompimento Confirmado',
    message: 'BTC/USD rompeu resistência de 68k com volume institucional.',
    type: 'trade',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    read: false,
    action: 'Trade'
  },
  {
    id: '3',
    title: 'Margin Call Warning',
    message: 'Exposição em alavancagem atingiu 80% do limite de segurança.',
    type: 'alert',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    read: false,
    action: 'Ajustar'
  }
];

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("Todas as notificações lidas");
  };

  const deleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === activeTab);

  const getIcon = (type: string) => {
    switch (type) {
      case 'system': return <Settings className="w-4 h-4 text-cyan-400" />;
      case 'trade': return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 w-10 h-10 rounded-xl border border-transparent hover:border-white/10">
          <Bell className={`w-5 h-5 transition-transform duration-500 ${isOpen ? 'rotate-12 scale-110 text-cyan-400' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500 border border-black"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-[400px] p-0 bg-[#0a0a0a]/95 border border-white/10 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden mr-4" 
        align="end" 
        sideOffset={10}
      >
        <div className="flex flex-col h-[500px]">
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></span>
              <h4 className="font-bold text-sm text-white tracking-wide uppercase">Notifications</h4>
              <span className="bg-white/10 text-[10px] px-1.5 py-0.5 rounded text-slate-400 font-mono">{notifications.length}</span>
            </div>
            {unreadCount > 0 && (
               <button 
                onClick={markAllRead}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider transition-colors"
               >
                 Mark all read
               </button>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="w-full flex-1 flex flex-col" onValueChange={setActiveTab}>
            <div className="px-4 pt-3 pb-2">
              <TabsList className="w-full bg-white/5 border border-white/5 h-8 p-0.5 rounded-lg grid grid-cols-4">
                <TabsTrigger value="all" className="text-[10px] uppercase font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white h-full rounded-md transition-all">All</TabsTrigger>
                <TabsTrigger value="system" className="text-[10px] uppercase font-bold data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 h-full rounded-md transition-all">System</TabsTrigger>
                <TabsTrigger value="trade" className="text-[10px] uppercase font-bold data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 h-full rounded-md transition-all">Trade</TabsTrigger>
                <TabsTrigger value="alert" className="text-[10px] uppercase font-bold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 h-full rounded-md transition-all">Alerts</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 px-2">
              <div className="flex flex-col gap-1 pb-4">
                <AnimatePresence mode="popLayout">
                  {filteredNotifications.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-40 text-slate-500"
                    >
                      <Bell className="w-8 h-8 opacity-20 mb-2" />
                      <p className="text-xs font-medium">No new notifications</p>
                    </motion.div>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => markAsRead(notif.id)}
                        className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                          notif.read 
                            ? 'bg-transparent border-transparent hover:bg-white/[0.02]' 
                            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10 shadow-lg'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-black/40 ${
                            notif.type === 'system' ? 'border-cyan-500/30' : 
                            notif.type === 'trade' ? 'border-emerald-500/30' :
                            notif.type === 'alert' ? 'border-amber-500/30' : 'border-slate-700'
                          }`}>
                            {getIcon(notif.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <h5 className={`text-xs font-bold truncate ${notif.read ? 'text-slate-500' : 'text-slate-200'}`}>
                                {notif.title}
                              </h5>
                              <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap ml-2">
                                {format(notif.timestamp, "HH:mm")}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                              {notif.message}
                            </p>

                            {/* Email / Action Footer */}
                            <div className="flex items-center gap-2 mt-2">
                               <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  <Mail className="w-2.5 h-2.5 text-slate-500" />
                                  <span className="text-[9px] text-slate-500 font-medium">Sent to Email</span>
                               </div>
                               {notif.action && (
                                 <button className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wide ml-auto">
                                    {notif.action} <ArrowUpRight className="w-2.5 h-2.5" />
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>

                        {/* Delete Button (Visible on Hover) */}
                        <button 
                          onClick={(e) => deleteNotification(e, notif.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Unread Indicator */}
                        {!notif.read && (
                          <div className={`absolute top-4 left-0 w-0.5 h-8 rounded-r-full ${
                             notif.type === 'system' ? 'bg-cyan-500' : 
                             notif.type === 'trade' ? 'bg-emerald-500' :
                             notif.type === 'alert' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} />
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </Tabs>

          {/* Footer */}
          <div className="p-3 border-t border-white/5 bg-white/[0.02]">
            <Button variant="outline" className="w-full h-8 text-xs bg-transparent border-white/10 hover:bg-white/5 hover:text-white text-slate-400 font-medium tracking-wide">
               View Full History
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
