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
      systemStatus: "AI Algorithm",
      title: ["Neuro AI. Think.", "Connect. Profit."],
      subtitle: "The first neural interface for decentralized markets. Execute trades with the precision of a machine and the intuition of a hive mind.",
      ctaStart: "START TRADING",
      ctaDemo: "VIEW DEMO"
    },
    stats: {
      nodes: "Active Nodes",
      volume: "Daily Volume",
      latency: "Latency",
      uptime: "Uptime",
      leverage: "Max Leverage"
    },
    features: {
      neural: { title: "Neural Analysis", desc: "Our AI processes market sentiment and technical indicators in real-time, identifying patterns invisible to the human eye." },
      flash: { title: "Flash Execution", desc: "Direct market access ensures your trades are executed in milliseconds, staying ahead of volatility." },
      security: { title: "Military-Grade Security", desc: "Your assets are protected by quantum-resistant encryption and multi-signature wallet protocols." }
    },
    pricing: {
      title: "Deployment Costs",
      headline: "Select your operational capacity.",
      subhead: "Transparent resource allocation for every level of trading autonomy.",
      frequency: "/month",
      tiers: [
        {
          name: 'Protocol: Genesis',
          price: '$0',
          description: 'Essential access for early validation and manual execution.',
          cta: 'Deploy Instance',
          features: ['Basic Neural Engine Access', 'Manual Trade Execution', 'Standard Latency (50ms)', 'Max Leverage 1:1000', 'Community Ledger Support', '1 Workspace']
        },
        {
          name: 'Protocol: Velocity',
          price: '$299',
          description: 'Automated infrastructure for high-frequency quantitative strategies.',
          cta: 'Upgrade Uplink',
          features: ['Advanced Neural Forecasting', 'Auto-Research (20/day)', 'Low Latency (<10ms)', 'Max Leverage 1:1000', 'Direct Market Access (DMA)', '5 Workspaces', 'API Access']
        },
        {
          name: 'Protocol: Sovereign',
          price: 'Custom',
          description: 'Dedicated hardware and institutional-grade encryption for funds.',
          cta: 'Contact Syndicate',
          features: ['Dedicated Neural Cluster', 'Unlimited Auto-Research', 'Zero Latency Co-location', 'Custom Leverage (> 1:1000)', 'White-glove Integration', 'Unlimited Workspaces', 'On-premise Deployment Option']
        }
      ]
    },
    login: {
      gateway: "SECURE GATEWAY",
      cancel: "Cancel",
      accessPortal: "Access Portal",
      identify: "Identify yourself to proceed.",
      placeholder: "Agent ID / Email",
      analyzing: "Analyzing...",
      initialize: "Initialize Sequence",
      verify: "Verify Identity",
      mfa: "Multi-factor authentication required.",
      password: "Password",
      traditional: "Traditional entry",
      biometric: "Biometric Scan",
      recommended: "Recommended",
      scanning: "Scanning",
      dontMove: "Do not move your device",
      granted: "Access Granted",
      welcome: "Welcome back, Agent.",
      securityLog: [
        "Verifying IP origin...",
        "Analyzing device fingerprint...",
        "Checking geometric latency...",
        "Validating encryption keys...",
        "Connection secured: AES-256"
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
      title: ["Neuro AI. Pense.", "Conecte. Lucre."],
      subtitle: "Acesse o que o olho humano não vê. Com monitoramento quântico a cada 5 segundos, nosso algoritmo cruza variáveis complexas para entregar uma execução disciplinada e livre de vieses. Otimize sua carteira com um sistema quantitativo desenhado para operar com máxima eficiência e precisão técnica.",
      ctaStart: "INICIAR TRADING",
      ctaDemo: "VER DEMO"
    },
    stats: {
      nodes: "Nós Ativos",
      volume: "Volume Diário",
      latency: "Latência",
      uptime: "Uptime",
      leverage: "Alavancagem Max"
    },
    features: {
      neural: { title: "Análise Neural", desc: "Nossa IA processa o sentimento do mercado e indicadores técnicos em tempo real, identificando padrões invisíveis ao olho humano." },
      flash: { title: "Execução Flash", desc: "Acesso direto ao mercado garante que seus trades sejam executados em milissegundos, ficando à frente da volatilidade." },
      security: { title: "Segurança Militar", desc: "Seus ativos são protegidos por criptografia resistente a quantum e protocolos de carteira multi-assinatura." }
    },
    pricing: {
      title: "Alocação de Capacidade",
      headline: "Selecione sua interface neural.",
      subhead: "Acesso direto à infraestrutura de execução de grau institucional.",
      frequency: "/mês",
      tiers: [
        {
          name: 'Node: Starter',
          price: 'Gratuito',
          description: 'Acesso essencial para validação de latência e execução manual.',
          cta: 'Implantar Node',
          features: ['Previsão Neural Básica', 'Execução Manual', 'Latência Standard (50ms)', 'Alavancagem Max 1:1000', 'Suporte Comunitário', '1 Workspace']
        },
        {
          name: 'Node: Pro',
          price: '€99',
          description: 'Infraestrutura para traders ativos e execução semi-automatizada.',
          cta: 'Ativar Pro',
          features: ['Sinais Neurais Avançados', 'Copy-Trading MT5', 'Baixa Latência (<20ms)', 'Alavancagem Max 1:1000', 'Análise de Sentimento IA', '3 Workspaces', 'Prioridade na Fila']
        },
        {
          name: 'Node: Institutional',
          price: '€499',
          description: 'Poder computacional bruto para HFT e Prop Firms.',
          cta: 'Solicitar Acesso',
          features: ['Algoritmos Genéticos', 'Auto-Hedging Dinâmico', 'Ultra-Baixa Latência (<5ms)', 'Alavancagem Flexível (> 1:1000)', 'VPS Dedicado em Londres', '10 Workspaces', 'Gerente de Conta']
        },
        {
          name: 'Syndicate Core',
          price: 'Sob Medida',
          description: 'Soluções White-Label e infraestrutura bancária dedicada.',
          cta: 'Contatar Sindicato',
          features: ['Cluster Neural Exclusivo', 'Dark Pool Access', 'Co-localização Zero Latência', 'Alavancagem Ilimitada', 'API Fix Protocol', 'Workspaces Ilimitados', 'Conformidade LGPD/MiFID II']
        }
      ]
    },
    login: {
      gateway: "GATEWAY SEGURO",
      cancel: "Cancelar",
      accessPortal: "Portal de Acesso",
      identify: "Identifique-se para prosseguir.",
      placeholder: "ID do Agente / Email",
      analyzing: "Analisando...",
      initialize: "Inicializar Sequência",
      verify: "Verificar Identidade",
      mfa: "Autenticação multifator necessária.",
      password: "Senha",
      traditional: "Entrada tradicional",
      biometric: "Escaneamento Biométrico",
      recommended: "Recomendado",
      scanning: "Escaneando",
      dontMove: "Não mova seu dispositivo",
      granted: "Acesso Permitido",
      welcome: "Bem-vindo de volta, Agente.",
      securityLog: [
        "Verificando origem do IP...",
        "Analisando impressão digital do dispositivo...",
        "Verificando latência geométrica...",
        "Validando chaves de criptografia...",
        "Conexão segura: AES-256"
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
      systemStatus: "AI Algorithm",
      title: ["Neuro AI. Piense.", "Conecte. Gane."],
      subtitle: "La primera interfaz neuronal para mercados descentralizados. Ejecute operaciones con la precisión de una máquina y la intuición de una mente colectiva.",
      ctaStart: "INICIAR TRADING",
      ctaDemo: "VER DEMO"
    },
    stats: {
      nodes: "Nodos Activos",
      volume: "Volumen Diario",
      latency: "Latencia",
      uptime: "Tiempo Activo",
      leverage: "Apalancamiento Max"
    },
    features: {
      neural: { title: "Análisis Neuronal", desc: "Nuestra IA procesa el sentimiento del mercado y los indicadores técnicos en tiempo real, identificando patrones invisibles al ojo humano." },
      flash: { title: "Ejecución Flash", desc: "El acceso directo al mercado asegura que sus operaciones se ejecuten en milisegundos, manteniéndose por delante de la volatilidad." },
      security: { title: "Seguridad Militar", desc: "Sus activos están protegidos por encriptación resistente a cuántica y protocolos de billetera multi-firma." }
    },
    pricing: {
      title: "Costos de Despliegue",
      headline: "Seleccione su capacidad operativa.",
      subhead: "Asignación transparente de recursos para cada nivel de autonomía comercial.",
      frequency: "/mes",
      tiers: [
        {
          name: 'Protocolo: Génesis',
          price: '$0',
          description: 'Acceso esencial para validación temprana y ejecución manual.',
          cta: 'Desplegar Instancia',
          features: ['Acceso Básico al Motor Neuronal', 'Ejecución Manual de Operaciones', 'Latencia Estándar (50ms)', 'Apalancamiento Max 1:1000', 'Soporte Ledger Comunitario', '1 Espacio de Trabajo']
        },
        {
          name: 'Protocolo: Velocidad',
          price: '$299',
          description: 'Infraestructura automatizada para estrategias cuantitativas de alta frecuencia.',
          cta: 'Actualizar Uplink',
          features: ['Predicción Neuronal Avanzada', 'Auto-Investigación (20/día)', 'Baja Latencia (<10ms)', 'Apalancamiento Max 1:1000', 'Acceso Directo al Mercado (DMA)', '5 Espacios de Trabajo', 'Acceso API']
        },
        {
          name: 'Protocolo: Soberano',
          price: 'A Medida',
          description: 'Hardware dedicado y encriptación de grado institucional para fondos.',
          cta: 'Contactar Sindicato',
          features: ['Clúster Neuronal Dedicado', 'Auto-Investigación Ilimitada', 'Co-localización Cero Latencia', 'Apalancamiento Ilimitado (> 1:1000)', 'Integración White-glove', 'Espacios de Trabajo Ilimitados', 'Opción de Despliegue Local']
        }
      ]
    },
    login: {
      gateway: "PUERTA SEGURA",
      cancel: "Cancelar",
      accessPortal: "Portal de Acceso",
      identify: "Identifíquese para continuar.",
      placeholder: "ID de Agente / Email",
      analyzing: "Analizando...",
      initialize: "Inicializar Secuencia",
      verify: "Verificar Identidad",
      mfa: "Autenticación multifactor requerida.",
      password: "Contraseña",
      traditional: "Entrada tradicional",
      biometric: "Escaneo Biométrico",
      recommended: "Recomendado",
      scanning: "Escaneando",
      dontMove: "No mueva su dispositivo",
      granted: "Acceso Permitido",
      welcome: "Bienvenido de nuevo, Agente.",
      securityLog: [
        "Verificando origen de IP...",
        "Analizando huella digital del dispositivo...",
        "Comprobando latencia geométrica...",
        "Validando claves de encriptación...",
        "Conexión segura: AES-256"
      ]
    },
    footer: {
      rights: "TODOS LOS DERECHOS RESERVADOS."
    }
  }
};