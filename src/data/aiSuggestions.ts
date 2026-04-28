import { Zap, Brain, Layout, BarChart2, Shield, Smartphone, Globe, Cpu } from 'lucide-react';

export type Category = 'COMPETITION' | 'DESIGN_UX' | 'FEATURE' | 'TECH' | 'DAY_TRADE' | 'INNOVATION';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  fullAnalysis: string;
  category: Category;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
}

export const AI_SUGGESTIONS_POOL: Suggestion[] = [
  // ==========================================
  // 1. DAY TRADE (20 items)
  // ==========================================
  {
    id: 'dt-1', category: 'DAY_TRADE', title: 'Heatmap de Correlação em Tempo Real',
    description: 'Matriz 5x5 mostrando correlação Pearson entre principais pares.',
    fullAnalysis: 'Essencial para evitar exposição dobrada ao mesmo risco (ex: Comprar EURUSD e vender USDCHF). Deve atualizar a cada 1m.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Risk', 'Data Viz']
  },
  {
    id: 'dt-2', category: 'DAY_TRADE', title: 'Detector de Liquidez (Order Flow)',
    description: 'Visualização de "Iceberg Orders" e zonas de alta liquidez no DOM.',
    fullAnalysis: 'Identificar onde grandes players estão posicionando ordens passivas permite front-running ou proteção de stops.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Tape Reading', 'Level 2']
  },
  {
    id: 'dt-3', category: 'DAY_TRADE', title: 'Trailing Stop baseado em ATR',
    description: 'Stop móvel que se ajusta automaticamente à volatilidade (Chandelier Exit).',
    fullAnalysis: 'Evita violínadas em mercados voláteis mantendo o stop fora do ruído estatístico.',
    impact: 'HIGH', effort: 'LOW', tags: ['Automation', 'Risk']
  },
  {
    id: 'dt-4', category: 'DAY_TRADE', title: 'Gráficos de Renko Puros',
    description: 'Implementar visualização Renko (baseada em movimento, não tempo).',
    fullAnalysis: 'Remove o ruído temporal, focando apenas na ação do preço. Excelente para identificar tendências claras.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Charting', 'Price Action']
  },
  {
    id: 'dt-5', category: 'DAY_TRADE', title: 'Simulador de Slippage',
    description: 'Adicionar delay e slippage aleatório no ambiente de backtest.',
    fullAnalysis: 'Backtests irreais quebram contas. Simular condições ruins prepara o trader para a realidade.',
    impact: 'HIGH', effort: 'LOW', tags: ['Backtest', 'Reality']
  },
  {
    id: 'dt-6', category: 'DAY_TRADE', title: 'Indicador VWAP Bands',
    description: 'Bandas de Desvio Padrão ancoradas na VWAP diária/semanal.',
    fullAnalysis: 'Institucionais usam VWAP como referência de valor justo. As bandas indicam sobrecompra/sobrevenda institucional.',
    impact: 'HIGH', effort: 'LOW', tags: ['Institutional', 'Indicator']
  },
  {
    id: 'dt-7', category: 'DAY_TRADE', title: 'Perfil de Mercado (TPO Profile)',
    description: 'Time Price Opportunity profile para identificar áreas de aceitação de preço.',
    fullAnalysis: 'Ferramenta clássica de futuros para ver onde o mercado passou mais tempo (Valor) vs Rejeição.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Profile', 'Advanced']
  },
  {
    id: 'dt-8', category: 'DAY_TRADE', title: 'Execução TWAP Automatizada',
    description: 'Time Weighted Average Price para executar ordens grandes sem mover o preço.',
    fullAnalysis: 'Divide uma ordem grande em 100 pedaços executados ao longo de 1 hora. Útil para quem opera lotes grandes.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Algo Trading', 'Execution']
  },
  {
    id: 'dt-9', category: 'DAY_TRADE', title: 'Scanner de Divergências',
    description: 'Alerta automático quando Preço faz topo mais alto e RSI faz topo mais baixo.',
    fullAnalysis: 'Automatiza a busca por reversões clássicas em múltiplos timeframes simultaneamente.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Automation', 'Signals']
  },
  {
    id: 'dt-10', category: 'DAY_TRADE', title: 'Gráfico de Footprint',
    description: 'Candles que mostram volume comprado vs vendido em cada nível de preço.',
    fullAnalysis: 'A visão raio-X definitiva do candle. Permite ver agressão real dentro da barra.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Order Flow', 'Pro']
  },
  {
    id: 'dt-11', category: 'DAY_TRADE', title: 'Calculadora de Griegas (Opções)',
    description: 'Visualização em tempo real de Delta, Gamma, Theta e Vega para portfólio.',
    fullAnalysis: 'Para traders que fazem hedge com opções, saber a exposição às griegas é vital.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Options', 'Math']
  },
  {
    id: 'dt-12', category: 'DAY_TRADE', title: 'Bot de Grade (Grid Trading)',
    description: 'Automatizar compras e vendas em intervalos fixos para mercados laterais.',
    fullAnalysis: 'Estratégia clássica para "farmar" volatilidade em consolidações.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Bot', 'Strategy']
  },
  {
    id: 'dt-13', category: 'DAY_TRADE', title: 'Indicador de Sessões de Mercado',
    description: 'Caixas coloridas no fundo do gráfico marcando Londres, NY e Tóquio.',
    fullAnalysis: 'Ajuda a visualizar a liquidez e volatilidade típica de cada horário.',
    impact: 'LOW', effort: 'LOW', tags: ['Visual', 'Time']
  },
  {
    id: 'dt-14', category: 'DAY_TRADE', title: 'One-Click Trading no Gráfico',
    description: 'Botões de C/V que seguem o cursor do mouse para execução instantânea.',
    fullAnalysis: 'Para scalpers, cada milissegundo conta. Eliminar o movimento até a boleta lateral é crucial.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['UX', 'Speed']
  },
  {
    id: 'dt-15', category: 'DAY_TRADE', title: 'Fechamento Parcial Automático',
    description: 'Configurar para fechar 50% da posição ao atingir Take Profit 1.',
    fullAnalysis: 'Garante lucro no bolso ("pay the trader") e deixa o resto correr sem risco.',
    impact: 'HIGH', effort: 'LOW', tags: ['Risk Mgt', 'Automation']
  },
  {
    id: 'dt-16', category: 'DAY_TRADE', title: 'Gráfico de Tick (Não Temporal)',
    description: 'Nova vela a cada X transações, independente do tempo.',
    fullAnalysis: 'Em momentos de alta volatilidade (Payroll), candles de tempo escondem a ação. Ticks mostram a "violência" real.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Charting', 'Data']
  },
  {
    id: 'dt-17', category: 'DAY_TRADE', title: 'Análise de Sazonalidade',
    description: 'Gráfico mostrando a performance média do ativo nesta semana nos últimos 10 anos.',
    fullAnalysis: 'Se o Ouro subiu na primeira semana de janeiro em 8 dos últimos 10 anos, é um viés estatístico importante.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Stats', 'Macro']
  },
  {
    id: 'dt-18', category: 'DAY_TRADE', title: 'Painel de Força da Moeda (CSM)',
    description: 'Ranking de qual moeda está mais forte/fraca no momento (ex: JPY > USD > EUR).',
    fullAnalysis: 'Ajuda a escolher o par certo. Se JPY é forte e EUR é fraco, opere EURJPY para maior deslocamento.',
    impact: 'HIGH', effort: 'LOW', tags: ['Forex', 'Dashboard']
  },
  {
    id: 'dt-19', category: 'DAY_TRADE', title: 'Detecção de Padrões Harmônicos',
    description: 'Auto-desenho de Gartley, Butterfly, Bat e Crab patterns.',
    fullAnalysis: 'Padrões complexos de identificar a olho nu, mas matematicamente precisos para algoritmos.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Tech Analysis', 'Automation']
  },
  {
    id: 'dt-20', category: 'DAY_TRADE', title: 'Book Visual (Depth Chart)',
    description: 'Visualização gráfica das paredes de compra e venda.',
    fullAnalysis: 'Permite ver intuitivamente se há mais pressão compradora ou vendedora no book.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Visualization', 'L2']
  },

  // ==========================================
  // 2. TECH (20 items)
  // ==========================================
  {
    id: 'tech-1', category: 'TECH', title: 'Renderização via WebGPU',
    description: 'Migrar engine gráfica para WebGPU para performance nativa de GPU.',
    fullAnalysis: 'Supera o Canvas2D e WebGL em performance, permitindo milhões de pontos de dados sem lag.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Performance', 'Future']
  },
  {
    id: 'tech-2', category: 'TECH', title: 'Database Local-First (RxDB)',
    description: 'Arquitetura onde dados vivem no cliente e sincronizam em background.',
    fullAnalysis: 'Permite operação 100% offline com resolução de conflitos automática quando a internet voltar.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Offline', 'Architecture']
  },
  {
    id: 'tech-3', category: 'TECH', title: 'WebSockets Binários (Protobuf)',
    description: 'Substituir JSON por Protocol Buffers na transmissão de dados de mercado.',
    fullAnalysis: 'Reduz o tamanho do payload em até 80%, diminuindo latência em redes móveis instáveis.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Network', 'Optimization']
  },
  {
    id: 'tech-4', category: 'TECH', title: 'Edge Functions para Latência',
    description: 'Mover lógica de cálculo de alertas para servidores na borda (Edge).',
    fullAnalysis: 'Processar dados fisicamente mais perto do usuário reduz o RTT (Round Trip Time).',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Cloud', 'Speed']
  },
  {
    id: 'tech-5', category: 'TECH', title: 'Autenticação Biométrica (WebAuthn)',
    description: 'Login via FaceID/TouchID sem senha (Passkeys).',
    fullAnalysis: 'Maior segurança e conveniência. Fim dos ataques de phishing de senha.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Security', 'Auth']
  },
  {
    id: 'tech-6', category: 'TECH', title: 'Microsserviço de Risco em Rust',
    description: 'Módulo isolado de alta performance para validar risco pré-trade.',
    fullAnalysis: 'Rust garante memory safety e performance para checar limites de risco em microssegundos.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Backend', 'Safety']
  },
  {
    id: 'tech-7', category: 'TECH', title: 'Compressão Brotli Dinâmica',
    description: 'Otimizar entrega de assets estáticos com compressão de última geração.',
    fullAnalysis: 'Load time mais rápido = melhor UX inicial.',
    impact: 'LOW', effort: 'LOW', tags: ['Infra', 'Web']
  },
  {
    id: 'tech-8', category: 'TECH', title: 'Service Workers para Cache Avançado',
    description: 'Estratégia "Stale-While-Revalidate" para dados históricos.',
    fullAnalysis: 'Carrega dados instantaneamente do cache enquanto busca atualização em background.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['PWA', 'UX']
  },
  {
    id: 'tech-9', category: 'TECH', title: 'Integração CI/CD com Testes E2E',
    description: 'Pipeline que roda Cypress simulando trades antes de cada deploy.',
    fullAnalysis: 'Garante que nenhuma atualização quebre a funcionalidade crítica de abrir ordens.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['DevOps', 'Quality']
  },
  {
    id: 'tech-10', category: 'TECH', title: 'Dockerização de Bots Locais',
    description: 'Permitir que usuários rodem seus algos em containers Docker locais.',
    fullAnalysis: 'Isolamento total de ambiente. O usuário pode rodar Python/JS sem conflito de dependências.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Developer', 'Feature']
  },
  {
    id: 'tech-11', category: 'TECH', title: 'Vector Search para Padrões',
    description: 'Banco de dados vetorial para buscar "gráficos parecidos com este" no passado.',
    fullAnalysis: 'Transformar candles em embeddings e buscar similaridade por cosseno. Inovação pura.',
    impact: 'HIGH', effort: 'HIGH', tags: ['AI', 'Database']
  },
  {
    id: 'tech-12', category: 'TECH', title: 'Otimização de Re-renders React',
    description: 'Implementar React.memo e useMemo agressivo nos componentes de tick.',
    fullAnalysis: 'Evitar que a atualização de preço de um ativo renderize a lista inteira de ativos.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Frontend', 'Perf']
  },
  {
    id: 'tech-13', category: 'TECH', title: 'API GraphQL para Dados Flexíveis',
    description: 'Permitir que o front peça exatamente os campos necessários.',
    fullAnalysis: 'Evita over-fetching. Ótimo para dashboards personalizáveis onde cada usuário vê dados diferentes.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['API', 'Data']
  },
  {
    id: 'tech-14', category: 'TECH', title: 'Monitoramento de Erros (Sentry)',
    description: 'Rastreamento de exceções em tempo real no cliente.',
    fullAnalysis: 'Saber proativamente quando um usuário enfrenta um crash de JS.',
    impact: 'HIGH', effort: 'LOW', tags: ['Observability', 'Ops']
  },
  {
    id: 'tech-15', category: 'TECH', title: 'Backup Descentralizado IPFS',
    description: 'Salvar logs de auditoria em rede imutável.',
    fullAnalysis: 'Auditabilidade à prova de adulteração para compliance.',
    impact: 'LOW', effort: 'MEDIUM', tags: ['Web3', 'Security']
  },
  {
    id: 'tech-16', category: 'TECH', title: 'Suporte a Múltiplos Monitores',
    description: 'API window.open para destacar janelas (Pop-out) do navegador.',
    fullAnalysis: 'Traders usam 2-4 telas. A plataforma web precisa suportar janelas desacopladas.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Desktop', 'UX']
  },
  {
    id: 'tech-17', category: 'TECH', title: 'WebHooks para Automação Externa',
    description: 'Permitir que sistemas externos (TradingView) disparem ordens via URL.',
    fullAnalysis: 'Integração universal com qualquer sistema que faça requisições HTTP.',
    impact: 'HIGH', effort: 'LOW', tags: ['Integration', 'API']
  },
  {
    id: 'tech-18', category: 'TECH', title: 'Criptografia Ponta-a-Ponta',
    description: 'Encriptar chaves de API do usuário no cliente antes de salvar.',
    fullAnalysis: 'Nem os admins do banco de dados podem ver as API Keys das corretoras dos usuários.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Security', 'Privacy']
  },
  {
    id: 'tech-19', category: 'TECH', title: 'Lazy Loading de Indicadores',
    description: 'Carregar código de indicadores complexos (Ichimoku) apenas sob demanda.',
    fullAnalysis: 'Reduz o bundle inicial, acelerando o First Contentful Paint (FCP).',
    impact: 'LOW', effort: 'LOW', tags: ['Performance', 'Web']
  },
  {
    id: 'tech-20', category: 'TECH', title: 'Multi-Region Failover',
    description: 'Redirecionamento automático de DNS se a região principal da AWS cair.',
    fullAnalysis: 'Alta disponibilidade. O trading não pode parar porque a us-east-1 caiu.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Infra', 'Reliability']
  },

  // ==========================================
  // 3. DESIGN_UX (20 items)
  // ==========================================
  {
    id: 'ux-1', category: 'DESIGN_UX', title: 'Modo Foco (Zen Mode)',
    description: 'Tecla de atalho para esconder toda a UI, deixando só o gráfico.',
    fullAnalysis: 'Reduz carga cognitiva e distrações visuais em momentos decisivos.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Minimalism', 'UI']
  },
  {
    id: 'ux-2', category: 'DESIGN_UX', title: 'Command Palette (Cmd+K)',
    description: 'Menu de busca universal para ações, ativos e configurações.',
    fullAnalysis: 'Power users não usam mouse. Cmd+K > "Buy 1 BTC" é muito mais rápido.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Productivity', 'Navigation']
  },
  {
    id: 'ux-3', category: 'DESIGN_UX', title: 'Interface Mobile-First para Gestão',
    description: 'App simplificado focado apenas em *gerir* posições abertas, não análise.',
    fullAnalysis: 'No celular, ninguém traça Fibonacci. O usuário quer ver PnL e Fechar Posição rápido.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Mobile', 'Strategy']
  },
  {
    id: 'ux-4', category: 'DESIGN_UX', title: 'Drag & Drop no Gráfico',
    description: 'Mover linhas de Stop Loss e Take Profit arrastando com o mouse.',
    fullAnalysis: 'Interação direta e intuitiva. Ajustar risco visualmente é melhor que digitar números.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Interaction', 'Chart']
  },
  {
    id: 'ux-5', category: 'DESIGN_UX', title: 'Temas de Alto Contraste',
    description: 'Paleta de cores acessível para daltônicos (ex: Azul/Laranja em vez de Verde/Vermelho).',
    fullAnalysis: 'Acessibilidade é fundamental. 8% dos homens são daltônicos.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['A11y', 'Inclusivity']
  },
  {
    id: 'ux-6', category: 'DESIGN_UX', title: 'Workspace Salvo na Nuvem',
    description: 'Sincronizar layout de telas entre Home Office e Notebook.',
    fullAnalysis: 'Começar o dia no desktop e continuar no laptop com as mesmas janelas abertas.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Sync', 'Convenience']
  },
  {
    id: 'ux-7', category: 'DESIGN_UX', title: 'Micro-interações de Feedback',
    description: 'Vibração sutil (Haptic) ou som de "Cash Register" ao executar ordem.',
    fullAnalysis: 'Confirmação sensorial de que a ação foi registrada. Aumenta a satisfação de uso.',
    impact: 'LOW', effort: 'LOW', tags: ['Feel', 'Polish']
  },
  {
    id: 'ux-8', category: 'DESIGN_UX', title: 'Gráficos Skeleton no Loading',
    description: 'Mostrar esqueleto da UI enquanto dados carregam para evitar layout shift.',
    fullAnalysis: 'Melhora a percepção de velocidade e evita o CLS (Cumulative Layout Shift).',
    impact: 'LOW', effort: 'LOW', tags: ['Polish', 'Web Vitals']
  },
  {
    id: 'ux-9', category: 'DESIGN_UX', title: 'Modo "Privacidade" (Blur)',
    description: 'Atalho para borrar valores de saldo/PnL instantaneamente.',
    fullAnalysis: 'Útil para traders que operam em locais públicos ou fazem streaming/gravação de tela.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Privacy', 'Streaming']
  },
  {
    id: 'ux-10', category: 'DESIGN_UX', title: 'Atalhos estilo Vim/Gamer',
    description: 'Mapeamento total de teclas: W/S para Zoom, A/D para Scroll, B para Buy.',
    fullAnalysis: 'Gamers e Devs adoram atalhos eficientes. Torna a operação fluida como um jogo.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Customization', 'Speed']
  },
  {
    id: 'ux-11', category: 'DESIGN_UX', title: 'Widget de Notas Adesivas',
    description: 'Post-its virtuais que ficam "colados" em coordenadas de preço/tempo.',
    fullAnalysis: 'Anotar "Resistência Mensal Aqui" diretamente no gráfico.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Tools', 'Annotation']
  },
  {
    id: 'ux-12', category: 'DESIGN_UX', title: 'Scroll Infinito no Histórico',
    description: 'Carregamento dinâmico de candles passados sem travar a tela.',
    fullAnalysis: 'Experiência fluida ao voltar no tempo, sem botões de "Carregar mais".',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Performance', 'UX']
  },
  {
    id: 'ux-13', category: 'DESIGN_UX', title: 'Dashboard Modular (Gridstack)',
    description: 'Usuário redimensiona e reposiciona widgets livremente.',
    fullAnalysis: 'Personalização total. Cada trader tem um layout mental diferente.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Layout', 'Library']
  },
  {
    id: 'ux-14', category: 'DESIGN_UX', title: 'Tutorial Interativo (Onboarding)',
    description: 'Passo a passo guiado na primeira visita destacando funções chave.',
    fullAnalysis: 'Plataformas de trade são complexas. Reduzir a curva de aprendizado inicial evita churn.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Onboarding', 'Help']
  },
  {
    id: 'ux-15', category: 'DESIGN_UX', title: 'Comparação Visual de Ativos',
    description: 'Botão "Comparar" que sobrepõe outro ativo em linha percentual.',
    fullAnalysis: 'Facilita ver correlação visualmente (ex: BTC vs ETH).',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Chart', 'Feature']
  },
  {
    id: 'ux-16', category: 'DESIGN_UX', title: 'Tema "Cyberpunk / Neon"',
    description: 'Skin visual com cores neon e fundo escuro profundo.',
    fullAnalysis: 'Apelo estético para o nicho "Trader Gamer". Diferenciação visual da marca.',
    impact: 'LOW', effort: 'LOW', tags: ['Theming', 'Fun']
  },
  {
    id: 'ux-17', category: 'DESIGN_UX', title: 'Agrupamento de Posições',
    description: 'Visualizar múltiplas ordens no mesmo ativo como uma posição média consolidada.',
    fullAnalysis: 'Simplifica a visualização. Em vez de 10 linhas no gráfico, vê-se 1 Preço Médio.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Clarity', 'Management']
  },
  {
    id: 'ux-18', category: 'DESIGN_UX', title: 'Cursor Crosshair Sincronizado',
    description: 'Cursor aparece na mesma posição de tempo em todos os gráficos abertos.',
    fullAnalysis: 'Análise multi-timeframe. Ver onde o candle de H1 está no gráfico de M5 instantaneamente.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Pro', 'Analysis']
  },
  {
    id: 'ux-19', category: 'DESIGN_UX', title: 'Barra de Progresso do Candle',
    description: 'Visualização do tempo restante para o fechamento do candle atual.',
    fullAnalysis: 'Crucial para quem opera fechamento de vela. Saber se faltam 5s ou 5min muda a decisão.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Info', 'Timing']
  },
  {
    id: 'ux-20', category: 'DESIGN_UX', title: 'Mini-gráficos na Watchlist',
    description: 'Sparklines (gráficos de linha simples) ao lado do nome do ativo na lista.',
    fullAnalysis: 'Visão rápida da tendência das últimas 24h sem precisar abrir o gráfico completo.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Data Viz', 'List']
  },

  // ==========================================
  // 4. COMPETITION (20 items)
  // ==========================================
  {
    id: 'comp-1', category: 'COMPETITION', title: 'Copy Trading Social',
    description: 'Marketplace onde novatos copiam trades de veteranos automaticamente.',
    fullAnalysis: 'Feature chave da eToro. Cria efeito de rede e monetização extra para bons traders.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Social', 'Growth']
  },
  {
    id: 'comp-2', category: 'COMPETITION', title: 'Desafios de Mesa Proprietária',
    description: 'Modo simulação com regras estritas de drawdown para qualificação.',
    fullAnalysis: 'Muitos traders querem entrar em "Prop Firms". Oferecer o ambiente de treino atrai esse público.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Education', 'Niche']
  },
  {
    id: 'comp-3', category: 'COMPETITION', title: 'Importador de TradingView',
    description: 'Ferramenta para converter listas e desenhos do TV para nossa plataforma.',
    fullAnalysis: 'Reduz a barreira de saída do concorrente dominante.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Migration', 'Growth']
  },
  {
    id: 'comp-4', category: 'COMPETITION', title: 'Feed de Notícias Integrado',
    description: 'Agregador de notícias financeiras em tempo real (estilo Bloomberg Terminal).',
    fullAnalysis: 'Mantém o usuário na plataforma. Se ele sai para ler notícia no Twitter, pode não voltar.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Content', 'Retention']
  },
  {
    id: 'comp-5', category: 'COMPETITION', title: 'Ranking Global de Traders',
    description: 'Leaderboard semanal baseada em ROI (Retorno sobre Investimento).',
    fullAnalysis: 'Gamificação competitiva. Todos querem estar no topo.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Social', 'Gamification']
  },
  {
    id: 'comp-6', category: 'COMPETITION', title: 'Loja de Estratégias (Bots)',
    description: 'Marketplace onde devs vendem seus algoritmos para usuários.',
    fullAnalysis: 'Ecossistema de criadores. Gera receita passiva para a plataforma (take rate).',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Marketplace', 'Revenue']
  },
  {
    id: 'comp-7', category: 'COMPETITION', title: 'Integração com Discord',
    description: 'Bot que posta os trades do usuário automaticamente no servidor dele.',
    fullAnalysis: 'Viralidade. O trader exibe seus ganhos na comunidade dele, divulgando a plataforma.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Marketing', 'Social']
  },
  {
    id: 'comp-8', category: 'COMPETITION', title: 'Calculadora de Impostos (IR)',
    description: 'Gerador de DARF e relatórios fiscais prontos.',
    fullAnalysis: 'Resolver a dor burocrática é um diferencial enorme contra plataformas estrangeiras.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Utility', 'Localization']
  },
  {
    id: 'comp-9', category: 'COMPETITION', title: 'Simulador de Replay de Mercado',
    description: 'Voltar no tempo e operar o passado tick a tick.',
    fullAnalysis: 'Ferramenta educacional essencial. Concorrentes cobram caro por isso.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Education', 'Premium']
  },
  {
    id: 'comp-10', category: 'COMPETITION', title: 'Análise de Sentimento Social',
    description: 'Scraping do Twitter/Reddit para medir "Hype" de um ativo.',
    fullAnalysis: 'Feature popular em plataformas cripto (LunarCrush). Ajuda a pegar pumps.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Data', 'Crypto']
  },
  {
    id: 'comp-11', category: 'COMPETITION', title: 'Chat da Comunidade por Ativo',
    description: 'Sala de bate-papo específica na página de cada moeda/ação.',
    fullAnalysis: 'Estilo Investing.com ou Binance. Cria senso de comunidade e engajamento.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Social', 'Chat']
  },
  {
    id: 'comp-12', category: 'COMPETITION', title: 'Alertas de "Baleias"',
    description: 'Notificar transações anormais de grande volume na Blockchain/Book.',
    fullAnalysis: 'Informação privilegiada democratizada. Muito valorizado no varejo.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Data', 'Alerts']
  },
  {
    id: 'comp-13', category: 'COMPETITION', title: 'Programa de Indicação (Referral)',
    description: 'Sistema robusto de afiliados com comissão recorrente.',
    fullAnalysis: 'Growth hacking básico. Usuários trazem usuários.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Growth', 'Marketing']
  },
  {
    id: 'comp-14', category: 'COMPETITION', title: 'Integração Multi-Corretora',
    description: 'Operar contas da Binance, Bybit e Forex no mesmo painel.',
    fullAnalysis: 'O "Santo Graal" da unificação. O usuário não precisa logar em 5 lugares.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['Aggregation', 'Utility']
  },
  {
    id: 'comp-15', category: 'COMPETITION', title: 'Calendário Econômico no Gráfico',
    description: 'Bandeiras verticais no gráfico indicando horários de notícias.',
    fullAnalysis: 'Contextualiza o movimento. "Ah, caiu porque saiu o CPI".',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Info', 'Context']
  },
  {
    id: 'comp-16', category: 'COMPETITION', title: 'Perfil de Influencer Verificado',
    description: 'Selo azul para traders com track record comprovado e público.',
    fullAnalysis: 'Segurança contra golpistas. Aumenta a confiança na plataforma.',
    impact: 'LOW', effort: 'LOW', tags: ['Trust', 'Social']
  },
  {
    id: 'comp-17', category: 'COMPETITION', title: 'API Pública para Devs',
    description: 'Documentação Swagger para devs criarem apps em cima da nossa plataforma.',
    fullAnalysis: 'Transforma o produto em plataforma. A comunidade constrói features por nós.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Dev', 'Ecosystem']
  },
  {
    id: 'comp-18', category: 'COMPETITION', title: 'Suporte a Scripts Python',
    description: 'Rodar notebooks Jupyter simples direto no browser (Pyodide).',
    fullAnalysis: 'Quant traders preferem Python a interfaces gráficas. Atrai o público nerd/quant.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Quant', 'Tech']
  },
  {
    id: 'comp-19', category: 'COMPETITION', title: 'Comparador de Spreads',
    description: 'Tabela mostrando qual corretora está com melhor preço agora.',
    fullAnalysis: 'Transparência total. O usuário economiza dinheiro escolhendo a melhor rota.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Utility', 'Cost']
  },
  {
    id: 'comp-20', category: 'COMPETITION', title: 'Modo "Paper Trading" Ilimitado',
    description: 'Conta demo com dinheiro infinito e resetável.',
    fullAnalysis: 'Essencial para aquisição. O usuário testa sem risco antes de depositar.',
    impact: 'HIGH', effort: 'LOW', tags: ['Onboarding', 'Free']
  },

  // ==========================================
  // 5. INNOVATION (20 items)
  // ==========================================
  {
    id: 'inno-1', category: 'INNOVATION', title: 'Biofeedback via Smartwatch',
    description: 'Bloquear trading se batimentos cardíacos excederem 120bpm (Estresse).',
    fullAnalysis: 'Gerenciamento fisiológico de risco. Previne o "Tilt" emocional.',
    impact: 'HIGH', effort: 'HIGH', tags: ['IoT', 'Health']
  },
  {
    id: 'inno-2', category: 'INNOVATION', title: 'Comandos de Voz (NLP)',
    description: 'Executar ordens falando "Vender metade agora!"',
    fullAnalysis: 'Acessibilidade e velocidade em momentos de pânico.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['AI', 'Voice']
  },
  {
    id: 'inno-3', category: 'INNOVATION', title: 'Trading via Realidade Virtual (VR)',
    description: 'Sala de trading imersiva estilo Minority Report com múltiplos painéis 3D.',
    fullAnalysis: 'O futuro do workspace. Espaço de tela infinito em 360 graus.',
    impact: 'LOW', effort: 'EXTREME', tags: ['VR', 'Future']
  },
  {
    id: 'inno-4', category: 'INNOVATION', title: 'Psicólogo IA no Chat',
    description: 'Chatbot treinado em psicologia de trading que detecta frustração do usuário.',
    fullAnalysis: 'Intervenção ativa: "Você perdeu 3x seguidas e aumentou a mão. Quer fazer uma pausa?"',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['AI', 'Psychology']
  },
  {
    id: 'inno-5', category: 'INNOVATION', title: 'Sonificação de Mercado',
    description: 'Transformar fluxo de ordens em sons (Agudos = Compra, Graves = Venda).',
    fullAnalysis: 'Permite "ouvir" o mercado sem olhar para a tela. Aumenta a percepção sensorial.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Audio', 'Accessibility']
  },
  {
    id: 'inno-6', category: 'INNOVATION', title: 'Previsão de Liquidez (AI)',
    description: 'Modelo preditivo que estima onde a liquidez estará daqui a 10 minutos.',
    fullAnalysis: 'Antecipar movimentos de formadores de mercado. Vantagem competitiva enorme.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['AI', 'ML']
  },
  {
    id: 'inno-7', category: 'INNOVATION', title: 'Heatmap de Olhar (Eye Tracking)',
    description: 'Usar webcam para analisar onde o trader foca no gráfico.',
    fullAnalysis: 'Feedback educacional: "Você focou demais no PnL e pouco no preço".',
    impact: 'LOW', effort: 'HIGH', tags: ['Education', 'Tech']
  },
  {
    id: 'inno-8', category: 'INNOVATION', title: 'Trilha Sonora Adaptativa',
    description: 'Música de fundo que muda o ritmo conforme a volatilidade do mercado.',
    fullAnalysis: 'Gera imersão e alerta subconsciente sobre a mudança de estado do mercado.',
    impact: 'LOW', effort: 'MEDIUM', tags: ['Audio', 'Experience']
  },
  {
    id: 'inno-9', category: 'INNOVATION', title: 'Governança DAO para Features',
    description: 'Usuários votam com tokens quais features devem ser desenvolvidas.',
    fullAnalysis: 'Democracia de produto. Engaja a comunidade no roadmap.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Web3', 'Product']
  },
  {
    id: 'inno-10', category: 'INNOVATION', title: 'Tokenização de Performance (NFT)',
    description: 'Transformar um track record verificado em um NFT negociável.',
    fullAnalysis: 'Reputação on-chain portátil. O currículo do trader na blockchain.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Web3', 'NFT']
  },
  {
    id: 'inno-11', category: 'INNOVATION', title: 'Alertas de Correlação Astrológica',
    description: 'Sobreposição de ciclos lunares no gráfico (Financial Astrology).',
    fullAnalysis: 'Nicho controverso mas existente (Gann Traders). Inovação por atender um público esquecido.',
    impact: 'LOW', effort: 'LOW', tags: ['Niche', 'Chart']
  },
  {
    id: 'inno-12', category: 'INNOVATION', title: 'Interface Neural (Conceito)',
    description: 'Preparação de arquitetura para futuros dispositivos BCI (Brain Computer Interface).',
    fullAnalysis: 'Pensar longe. Executar trade com o pensamento (Neuralink).',
    impact: 'LOW', effort: 'EXTREME', tags: ['SciFi', 'R&D']
  },
  {
    id: 'inno-13', category: 'INNOVATION', title: 'Gamificação RPG Completa',
    description: 'Avatar que evolui, ganha armaduras e skills conforme o trader lucra.',
    fullAnalysis: 'Transforma a jornada solitária do trader em um jogo de progressão viciante.',
    impact: 'MEDIUM', effort: 'HIGH', tags: ['Game', 'Fun']
  },
  {
    id: 'inno-14', category: 'INNOVATION', title: 'Análise de Sentimento de Vídeo',
    description: 'Transcrever e analisar tom de voz de vídeos do Youtube ao vivo (Fed Chair).',
    fullAnalysis: 'Saber se o discurso é Hawkish antes do mercado reagir ao texto.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['AI', 'Video']
  },
  {
    id: 'inno-15', category: 'INNOVATION', title: 'Backtest em Realidade Aumentada (AR)',
    description: 'Ver o gráfico histórico projetado na mesa da sala.',
    fullAnalysis: 'Visualização de dados espacial para encontrar padrões macro.',
    impact: 'LOW', effort: 'HIGH', tags: ['AR', 'Viz']
  },
  {
    id: 'inno-16', category: 'INNOVATION', title: 'Seguro de Stop Loss (DeFi)',
    description: 'Pool de liquidez descentralizado que paga se houver slippage excessivo.',
    fullAnalysis: 'Produto financeiro inovador embutido na plataforma.',
    impact: 'HIGH', effort: 'EXTREME', tags: ['DeFi', 'Finance']
  },
  {
    id: 'inno-17', category: 'INNOVATION', title: 'Matchmaking de Mentor',
    description: 'Algoritmo tipo "Tinder" para conectar novatos a mentores compatíveis.',
    fullAnalysis: 'Baseado em estilo operacional (Scalper dá match com Scalper).',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Social', 'EdTech']
  },
  {
    id: 'inno-18', category: 'INNOVATION', title: 'Smart Contracts para Copy Trading',
    description: 'Execução de cópia via contrato inteligente, sem custódia da plataforma.',
    fullAnalysis: 'Trustless copy trading. Ninguém pode fugir com o dinheiro.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Web3', 'Trust']
  },
  {
    id: 'inno-19', category: 'INNOVATION', title: 'Anti-Phishing Image Generator',
    description: 'Gerar imagem única diária que só a plataforma oficial conhece.',
    fullAnalysis: 'Segurança visual. O usuário sabe que está no site certo se vir a imagem secreta dele.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Security', 'UX']
  },
  {
    id: 'inno-20', category: 'INNOVATION', title: 'Feedback Híbrido Humano-IA',
    description: 'IA analisa o trade, mas um humano revisa os "Edge Cases" e comenta.',
    fullAnalysis: 'Serviço premium de coaching escalável.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Service', 'Hybrid']
  },

  // ==========================================
  // 6. FEATURE (20 items)
  // ==========================================
  {
    id: 'feat-1', category: 'FEATURE', title: 'Diário de Trade Automatizado',
    description: 'Captura automática de screenshot e indicadores na hora da entrada.',
    fullAnalysis: 'Documentação sem esforço. Essencial para revisão posterior.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Journal', 'Utility']
  },
  {
    id: 'feat-2', category: 'FEATURE', title: 'Calculadora de Risco/Retorno',
    description: 'Ferramenta overlay para desenhar alvo e stop e ver Ratio instantâneo.',
    fullAnalysis: 'Básico mas vital. Ninguém deve operar com R:R negativo.',
    impact: 'HIGH', effort: 'LOW', tags: ['Tool', 'Risk']
  },
  {
    id: 'feat-3', category: 'FEATURE', title: 'Exportação para PDF/Excel',
    description: 'Relatórios bonitos para compartilhar ou arquivar.',
    fullAnalysis: 'Necessidade administrativa.',
    impact: 'LOW', effort: 'LOW', tags: ['Admin', 'Export']
  },
  {
    id: 'feat-4', category: 'FEATURE', title: 'Screeners de Mercado (Scanner)',
    description: 'Filtros customizáveis: "Mostre ações com RSI < 30 e Vol > 1M".',
    fullAnalysis: 'Ferramenta de busca de oportunidades. Poupa tempo de análise manual.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Search', 'Tool']
  },
  {
    id: 'feat-5', category: 'FEATURE', title: 'Notificações Push Personalizáveis',
    description: 'Alertas via App, Telegram, Email ou SMS.',
    fullAnalysis: 'O trader não pode perder o setup porque foi ao banheiro.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Alerts', 'Mobile']
  },
  {
    id: 'feat-6', category: 'FEATURE', title: 'Lista de Observação (Watchlist) em Nuvem',
    description: 'Listas sincronizadas entre dispositivos e compartilháveis.',
    fullAnalysis: 'Organização fundamental.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Core', 'Sync']
  },
  {
    id: 'feat-7', category: 'FEATURE', title: 'Calculadora de Tamanho de Posição',
    description: 'Input: Risco $50. Output: 0.15 Lotes.',
    fullAnalysis: 'Evita erros de cálculo mental que levam a perdas maiores que o planejado.',
    impact: 'HIGH', effort: 'LOW', tags: ['Math', 'Risk']
  },
  {
    id: 'feat-8', category: 'FEATURE', title: 'Notas de Texto por Ativo',
    description: 'Bloco de notas persistente atrelado ao par (ex: anotações sobre AAPL).',
    fullAnalysis: 'Memória externa para o trader manter teses de investimento.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Notes', 'Org']
  },
  {
    id: 'feat-9', category: 'FEATURE', title: 'Timer de Sessão (Pomodoro)',
    description: 'Cronômetro para lembrar pausas e evitar fadiga.',
    fullAnalysis: 'Saúde mental e foco. O trading cansa a mente rápido.',
    impact: 'LOW', effort: 'LOW', tags: ['Health', 'Tool']
  },
  {
    id: 'feat-10', category: 'FEATURE', title: 'Gráfico de Curva de Capital (Equity)',
    description: 'Visualização do crescimento da conta ao longo do tempo.',
    fullAnalysis: 'Feedback visual do progresso. Motivacional (ou alerta de perigo).',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Analytics', 'Viz']
  },
  {
    id: 'feat-11', category: 'FEATURE', title: 'Análise de Drawdown',
    description: 'Métricas sobre a queda máxima da conta e tempo de recuperação.',
    fullAnalysis: 'Métrica chave para investidores profissionais avaliarem risco.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Stats', 'Risk']
  },
  {
    id: 'feat-12', category: 'FEATURE', title: 'Rastreador de Dividendos',
    description: 'Calendário e projeção de pagamentos para quem faz Buy & Hold.',
    fullAnalysis: 'Foco em investidores de longo prazo, ampliando o público alvo.',
    impact: 'MEDIUM', effort: 'MEDIUM', tags: ['Investing', 'Info']
  },
  {
    id: 'feat-13', category: 'FEATURE', title: 'Rebalanceamento de Portfólio',
    description: 'Sugestão de trades para voltar às % ideais da carteira.',
    fullAnalysis: 'Gestão de portfólio automatizada.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Investing', 'Auto']
  },
  {
    id: 'feat-14', category: 'FEATURE', title: 'Simulador de Juros Compostos',
    description: 'Calculadora de projeção de riqueza a longo prazo.',
    fullAnalysis: 'Ferramenta de vendas e motivação.',
    impact: 'LOW', effort: 'LOW', tags: ['Calc', 'Growth']
  },
  {
    id: 'feat-15', category: 'FEATURE', title: 'Lembrete de Hidratação',
    description: 'Alertas simples para beber água durante o pregão.',
    fullAnalysis: 'Feature "Carinhosa". Mostra que a plataforma liga para o usuário.',
    impact: 'LOW', effort: 'LOW', tags: ['Health', 'Fun']
  },
  {
    id: 'feat-16', category: 'FEATURE', title: 'Modo Screenshot Limpo',
    description: 'Botão para gerar imagem do gráfico sem saldo/conta/menus.',
    fullAnalysis: 'Perfeito para compartilhar em redes sociais sem expor dados sensíveis.',
    impact: 'MEDIUM', effort: 'LOW', tags: ['Social', 'Share']
  },
  {
    id: 'feat-17', category: 'FEATURE', title: 'Conversor de Moedas Integrado',
    description: 'Calculadora rápida para conversão de PnL em moeda local.',
    fullAnalysis: 'Utilidade para quem opera contas em USD mas gasta em BRL.',
    impact: 'LOW', effort: 'LOW', tags: ['Tool', 'Fiat']
  },
  {
    id: 'feat-18', category: 'FEATURE', title: 'Checklist Pré-Trading',
    description: 'Lista de verificação obrigatória antes de liberar o botão de compra.',
    fullAnalysis: 'Enforce disciplina. "Leu as notícias? Checou o risco? Está calmo?"',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Psychology', 'Safety']
  },
  {
    id: 'feat-19', category: 'FEATURE', title: 'Gerador de Relatório de Erros',
    description: 'Análise pós-sessão destacando onde o trader desviou do plano.',
    fullAnalysis: 'Aprendizado contínuo. A melhor forma de evoluir é analisar erros.',
    impact: 'HIGH', effort: 'HIGH', tags: ['Education', 'Analytics']
  },
  {
    id: 'feat-20', category: 'FEATURE', title: 'Múltiplos Workspaces Salvos',
    description: 'Salvar "Setup Scalping", "Setup Swing", "Setup Crypto" separadamente.',
    fullAnalysis: 'Flexibilidade para quem opera diversos estilos.',
    impact: 'HIGH', effort: 'MEDIUM', tags: ['Org', 'UX']
  }
];

// --- GENERATOR LOGIC FOR INFINITE SUGGESTIONS ---

const ACTIONS = ['Implementar', 'Otimizar', 'Integrar', 'Desenvolver', 'Analisar', 'Adicionar', 'Refatorar', 'Automatizar'];
const TECHNOLOGIES = ['Machine Learning', 'Blockchain', 'WebSockets', 'GraphQL', 'Python Scripts', 'Serverless Functions', 'Zero-Knowledge Proofs', 'Rust', 'WebAssembly', 'IPFS', 'NLP', 'Computer Vision'];
const TARGETS = ['latência de execução', 'segurança de dados', 'experiência mobile', 'algoritmos de entrada', 'gestão de risco', 'onboarding de usuários', 'visualização de dados', 'psicologia do trader', 'conformidade fiscal'];
const BENEFITS = ['para reduzir slippage', 'para aumentar a retenção', 'para garantir privacidade total', 'para maximizar o PnL', 'para reduzir custos operacionais', 'para diferenciar da concorrência', 'para atrair institucionais', 'para facilitar o aprendizado'];

const TEMPLATES = [
  { t: "Sistema de [TECH] para [TARGET]", c: "TECH" as Category },
  { t: "[ACTION] [TARGET] usando [TECH]", c: "FEATURE" as Category },
  { t: "Novo módulo de [TARGET] [BENEFIT]", c: "DAY_TRADE" as Category },
  { t: "Dashboard de [TARGET] com foco em [TECH]", c: "DESIGN_UX" as Category },
  { t: "Estratégia baseada em [TECH] [BENEFIT]", c: "INNOVATION" as Category },
  { t: "Comparativo de [TARGET] contra concorrentes", c: "COMPETITION" as Category },
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSyntheticSuggestion(excludeIds: Set<string>): Suggestion {
  const template = getRandomElement(TEMPLATES);
  const tech = getRandomElement(TECHNOLOGIES);
  const target = getRandomElement(TARGETS);
  const action = getRandomElement(ACTIONS);
  const benefit = getRandomElement(BENEFITS);

  let title = template.t
    .replace('[TECH]', tech)
    .replace('[TARGET]', target)
    .replace('[ACTION]', action)
    .replace('[BENEFIT]', benefit);

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const id = `synth-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Ensure uniqueness (very unlikely collision, but safe practice)
  if (excludeIds.has(id)) return generateSyntheticSuggestion(excludeIds);

  return {
    id,
    category: template.c,
    title,
    description: `Uma proposta gerada pela IA para ${action.toLowerCase()} ${target} utilizando ${tech}.`,
    fullAnalysis: `Esta sugestão visa aplicar o estado da arte em ${tech} especificamente no contexto de ${target}. A análise preliminar indica que isso seria fundamental ${benefit}. Recomenda-se um estudo de viabilidade técnica focado na integração com a arquitetura atual.`,
    impact: getRandomElement(['HIGH', 'MEDIUM', 'LOW']),
    effort: getRandomElement(['HIGH', 'MEDIUM', 'LOW']),
    tags: ['AI Generated', 'Infinite', 'Auto']
  };
}

export function getFreshSuggestion(excludeIds: Set<string>): Suggestion {
  // 1. Try to find a static suggestion not used yet
  const availableStatic = AI_SUGGESTIONS_POOL.filter(s => !excludeIds.has(s.id));
  
  if (availableStatic.length > 0) {
    return availableStatic[Math.floor(Math.random() * availableStatic.length)];
  }

  // 2. If all static are used, generate a synthetic one
  return generateSyntheticSuggestion(excludeIds);
}
