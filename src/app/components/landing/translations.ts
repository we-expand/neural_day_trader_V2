export type Language = 'en' | 'pt' | 'es';

export const translations = {
  en: {
    nav: {
      protocol: "Infrastructure",
      intelligence: "Neural Engine",
      syndicate: "Institutional",
      login: "LOGIN"
    },
    hero: {
      systemStatus: "Quant System Active",
      rotating: [
        "Quantitative Signals.",
        "Algorithmic Trading.",
        "Market Intelligence.",
        "Disciplined Execution.",
        "Risk Under Control."
      ],
      subtitle: "Real price, real news, real order book — no simulation, no invented number. Every signal only reaches you after out-of-sample statistical validation, with transaction cost already deducted. The same rigor a professional quant desk applies, built into your trading.",
      ctaStart: "START TRADING",
      ctaDemo: "VIEW DEMO"
    },
    stats: {
      newsSources: { value: '18', label: 'Real-time news sources' },
      backtestYears: { value: '10+', label: 'Years of backtest history' },
      dataCost: { value: '$0', label: 'Data cost to you' },
      realData: { value: '100%', label: 'Real price, zero simulation' }
    },
    features: {
      neural: { title: "Neural Analysis", desc: "Cross-references market sentiment (18 real news sources) with statistically validated technical indicators — we never promise a win rate, we always show the methodology behind it." },
      risk: { title: "Execution Discipline", desc: "Daily loss limit, volatility-based position sizing, and automatic blocking of excess risk — the rule applies before the order goes out, not after the loss." },
      security: { title: "Real Security", desc: "Broker credentials encrypted (AES-256) and never exposed to the browser — only the backend function has access. Row Level Security enabled on every database table." }
    },
    pricing: {
      title: "Plans",
      headline: "Choose the level of discipline your trading needs.",
      subhead: "Validated methodology, risk under control, no promise of returns.",
      frequency: "/month",
      tiers: [
        {
          name: 'Protocol: Genesis',
          price: '$0',
          description: 'Essential access to validate the methodology with manual execution.',
          cta: 'Deploy Instance',
          features: ['Statistically validated signals', 'Market sentiment (18 real-time RSS sources)', 'Manual execution guided by risk alerts', 'Backtest with real historical data', '1 Workspace']
        },
        {
          name: 'Protocol: Velocity',
          price: '$299',
          description: 'For active traders who want automated risk discipline.',
          cta: 'Upgrade Uplink',
          features: ['Everything in Genesis', 'ATR-based position sizing + daily loss limit', 'Automatic cooldown after a losing streak', 'Real-time risk alerts', '5 Workspaces', 'API Access']
        },
        {
          name: 'Protocol: Sovereign',
          price: 'Custom',
          description: 'Dedicated infrastructure for funds and proprietary desks.',
          cta: 'Contact Syndicate',
          features: ['Dedicated environment', 'Custom API integration', 'Dedicated support SLA', 'Assisted onboarding', 'Unlimited Workspaces', 'On-premise deployment option']
        }
      ]
    },
    footer: {
      rights: "ALL RIGHTS RESERVED."
    }
  },
  pt: {
    nav: {
      protocol: "Infraestrutura",
      intelligence: "Motor Neural",
      syndicate: "Institucional",
      login: "ENTRAR"
    },
    hero: {
      systemStatus: "Sistema Quant Ativo",
      rotating: [
        "Sinais Quantitativos.",
        "Trading Algorítmico.",
        "Inteligência de Mercado.",
        "Execução Disciplinada.",
        "Risco sob Controle."
      ],
      subtitle: "Preço real, notícia real, order book real — sem simulação, sem número inventado. Cada sinal só chega até você depois de validação estatística fora da amostra, com custo de transação já descontado. É o mesmo rigor de uma mesa quant profissional, aplicado à sua operação.",
      ctaStart: "INICIAR TRADING",
      ctaDemo: "VER DEMO"
    },
    stats: {
      newsSources: { value: '18', label: 'Fontes de notícia em tempo real' },
      backtestYears: { value: '10+', label: 'Anos de histórico em backtest' },
      dataCost: { value: 'R$0', label: 'Custo de dado pra você' },
      realData: { value: '100%', label: 'Preço real, sem simulação' }
    },
    features: {
      neural: { title: "Análise Neural", desc: "Cruza sentimento de mercado (18 fontes de notícia reais) com indicadores técnicos validados estatisticamente — nunca prometemos taxa de acerto, sempre mostramos a metodologia por trás." },
      risk: { title: "Disciplina de Execução", desc: "Limite de perda diária, tamanho de posição por volatilidade e bloqueio automático de excesso de risco — a regra vale antes da ordem sair, não depois do prejuízo." },
      security: { title: "Segurança Real", desc: "Credencial de corretora cifrada (AES-256) e nunca exposta ao navegador — só a função de backend acessa. Row Level Security ativo em todas as tabelas do banco." }
    },
    pricing: {
      title: "Planos",
      headline: "Escolha o nível de disciplina que sua operação precisa.",
      subhead: "Metodologia validada, risco sob controle, sem promessa de rentabilidade.",
      frequency: "/mês",
      tiers: [
        {
          name: 'Node: Starter',
          price: 'Gratuito',
          description: 'Acesso essencial para validar a metodologia com execução manual.',
          cta: 'Implantar Node',
          features: ['Sinais validados estatisticamente', 'Sentimento de mercado (18 fontes RSS em tempo real)', 'Execução manual guiada por alerta de risco', 'Backtest com dado histórico real', '1 Workspace']
        },
        {
          name: 'Node: Pro',
          price: 'R$199,00',
          description: 'Para quem opera com frequência e quer disciplina de risco automatizada.',
          cta: 'Ativar Pro',
          features: ['Tudo do Starter', 'Position sizing por ATR + limite de perda diária', 'Cooldown automático após sequência de perdas', 'Alertas de risco em tempo real', '3 Workspaces', 'Suporte prioritário']
        },
        {
          name: 'Node: Institutional',
          price: 'R$399,00',
          description: 'Para operação em maior escala, com múltiplas estratégias e contas.',
          cta: 'Solicitar Acesso',
          features: ['Tudo do Pro', 'Múltiplas estratégias simultâneas', 'Backtest e Market Replay ilimitados', 'Catálogo completo (cripto, forex, índices)', '10 Workspaces', 'Gerente de conta dedicado']
        },
        {
          name: 'Syndicate Core',
          price: 'Sob Medida',
          description: 'Infraestrutura dedicada para fundos e mesas proprietárias.',
          cta: 'Contatar Sindicato',
          features: ['Ambiente dedicado', 'Integração personalizada via API', 'SLA de suporte dedicado', 'Onboarding assistido', 'Conformidade LGPD', 'Workspaces ilimitados']
        }
      ]
    },
    footer: {
      rights: "TODOS OS DIREITOS RESERVADOS."
    }
  },
  es: {
    nav: {
      protocol: "Infraestructura",
      intelligence: "Motor Neuronal",
      syndicate: "Institucional",
      login: "ACCESO"
    },
    hero: {
      systemStatus: "Sistema Quant Activo",
      rotating: [
        "Señales Cuantitativas.",
        "Trading Algorítmico.",
        "Inteligencia de Mercado.",
        "Ejecución Disciplinada.",
        "Riesgo Bajo Control."
      ],
      subtitle: "Precio real, noticia real, order book real — sin simulación, sin número inventado. Cada señal solo llega hasta usted después de validación estadística fuera de muestra, con el costo de transacción ya descontado. El mismo rigor de una mesa cuantitativa profesional, aplicado a su operación.",
      ctaStart: "INICIAR TRADING",
      ctaDemo: "VER DEMO"
    },
    stats: {
      newsSources: { value: '18', label: 'Fuentes de noticias en tiempo real' },
      backtestYears: { value: '10+', label: 'Años de historial en backtest' },
      dataCost: { value: '$0', label: 'Costo de dato para usted' },
      realData: { value: '100%', label: 'Precio real, sin simulación' }
    },
    features: {
      neural: { title: "Análisis Neuronal", desc: "Cruza el sentimiento de mercado (18 fuentes de noticias reales) con indicadores técnicos validados estadísticamente — nunca prometemos una tasa de acierto, siempre mostramos la metodología detrás." },
      risk: { title: "Disciplina de Ejecución", desc: "Límite de pérdida diaria, tamaño de posición por volatilidad y bloqueo automático de exceso de riesgo — la regla se aplica antes de que salga la orden, no después de la pérdida." },
      security: { title: "Seguridad Real", desc: "Credenciales de corretaje cifradas (AES-256) y nunca expuestas al navegador — solo la función de backend tiene acceso. Row Level Security activo en todas las tablas de la base de datos." }
    },
    pricing: {
      title: "Planes",
      headline: "Elija el nivel de disciplina que su operación necesita.",
      subhead: "Metodología validada, riesgo bajo control, sin promesa de rentabilidad.",
      frequency: "/mes",
      tiers: [
        {
          name: 'Protocolo: Génesis',
          price: '$0',
          description: 'Acceso esencial para validar la metodología con ejecución manual.',
          cta: 'Desplegar Instancia',
          features: ['Señales validadas estadísticamente', 'Sentimiento de mercado (18 fuentes RSS en tiempo real)', 'Ejecución manual guiada por alertas de riesgo', 'Backtest con datos históricos reales', '1 Espacio de Trabajo']
        },
        {
          name: 'Protocolo: Velocidad',
          price: '$299',
          description: 'Para traders activos que quieren disciplina de riesgo automatizada.',
          cta: 'Actualizar Uplink',
          features: ['Todo lo de Génesis', 'Tamaño de posición por ATR + límite de pérdida diaria', 'Enfriamiento automático tras racha de pérdidas', 'Alertas de riesgo en tiempo real', '5 Espacios de Trabajo', 'Acceso API']
        },
        {
          name: 'Protocolo: Soberano',
          price: 'A Medida',
          description: 'Infraestructura dedicada para fondos y mesas propietarias.',
          cta: 'Contactar Sindicato',
          features: ['Entorno dedicado', 'Integración personalizada vía API', 'SLA de soporte dedicado', 'Onboarding asistido', 'Espacios de Trabajo ilimitados', 'Opción de despliegue local']
        }
      ]
    },
    footer: {
      rights: "TODOS LOS DERECHOS RESERVADOS."
    }
  }
};
