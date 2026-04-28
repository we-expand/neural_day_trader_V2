import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '../../contexts/AuthContext';

export function Tutorial() {
  const [run, setRun] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Check if tutorial was already completed
    const completed = localStorage.getItem('tutorial_completed');
    if (!completed && user) {
        // Small delay to ensure DOM is ready
        setTimeout(() => setRun(true), 1000);
    }
  }, [user]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('tutorial_completed', 'true');
    }
  };

  const steps: Step[] = React.useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="space-y-3 font-sans">
          <div className="flex items-center gap-2 mb-2">
             <span className="text-2xl">🚀</span>
             <h3 className="text-lg font-bold text-emerald-400">Bem-vindo ao Neural Day Trader</h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Sistema de Trading Quantitativo Automatizado para operações de Crypto, Forex e Índices com inteligência artificial.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#app-sidebar',
      content: (
        <div className="space-y-2 font-sans">
          <h3 className="text-base font-bold text-emerald-400">Navegação Principal</h3>
          <p className="text-slate-300 text-sm">
            Acesse todas as ferramentas aqui: Carteira, IA Preditiva, Social Trading e Configurações do sistema.
          </p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '#modular-dashboard',
      content: (
        <div className="space-y-2 font-sans">
          <h3 className="text-base font-bold text-purple-400">Dashboard Modular</h3>
          <p className="text-slate-300 text-sm">
            Este é seu painel de comando. Totalmente personalizável e persistente.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '#widget-equity',
      content: (
        <div className="space-y-2 font-sans">
          <h3 className="text-base font-bold text-cyan-400">Análise de Equity</h3>
          <p className="text-slate-300 text-sm">
            Acompanhe a performance da sua conta em tempo real com gráficos interativos e detalhados.
          </p>
        </div>
      ),
    },
    {
      target: '#widget-terminal',
      content: (
        <div className="space-y-2 font-sans">
          <h3 className="text-base font-bold text-green-400">Terminal de Logs</h3>
          <p className="text-slate-300 text-sm">
            Monitore cada ação do robô. O terminal possui <i>infinite scroll</i> para histórico completo sem travar a página.
          </p>
        </div>
      ),
    },
    {
        target: '#app-header',
        content: (
            <div className="space-y-2 font-sans">
                <h3 className="text-base font-bold text-blue-400">Status & Conta</h3>
                <p className="text-slate-300 text-sm">
                    Verifique se está operando em <b>Conta Real</b> ou <b>Simulação</b>, e gerencie seu perfil de usuário aqui.
                </p>
            </div>
        ),
        placement: 'bottom'
    }
  ], []);

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose={true}
      spotlightClicks={true}
      callback={handleJoyrideCallback}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        skip: 'Pular',
      }}
      styles={{
        options: {
          arrowColor: '#09090b', // zinc-950
          backgroundColor: '#09090b',
          overlayColor: 'rgba(0, 0, 0, 0.85)',
          primaryColor: '#10b981', // emerald-500
          textColor: '#e2e8f0', // slate-200
          width: 380,
          zIndex: 10000,
        },
        tooltip: {
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.2), 0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            padding: '20px',
        },
        tooltipContainer: {
            textAlign: 'left',
        },
        buttonNext: {
            backgroundColor: '#10b981',
            color: '#000',
            fontWeight: '600',
            fontFamily: 'inherit',
            outline: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
        },
        buttonBack: {
            color: '#94a3b8',
            marginRight: 10,
            fontFamily: 'inherit',
            fontSize: '14px',
        },
        buttonSkip: {
            color: '#ef4444',
            fontFamily: 'inherit',
            fontSize: '14px',
        }
      }}
    />
  );
}