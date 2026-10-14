// 🔴 2026-10-13 (pedido do Cleber -- "ela não está sabendo interpretar nem o
// estocástico nem o MACD"): leitura PRONTA dos indicadores, calculada por
// código, para os analistas da mesa de operações (desk.ts).
//
// Achado que motivou (madrugada de 12→13/10, 460 tentativas de entrada): o
// validador barrou 59 raciocínios em que a IA descrevia o indicador errado
// ("tendência de baixa" com dado lateral, "estocástico sobrecomprado" com dado
// neutro). O número estava certo; a INTERPRETAÇÃO é que saía errada. Aqui o
// motor entrega a interpretação já feita -- o analista só precisa juntar os
// tempos gráficos e concluir.
//
// Funções PURAS: sem rede, sem config, sem estado. Testadas em
// scripts/test-desk.ts. Nunca fabricam dado: entrada nula devolve "sem dado".

export type Vies = "ALTA" | "BAIXA" | "NEUTRO";

export interface StochLike {
  k: number;
  d: number;
  label: "SOBRECOMPRADO" | "SOBREVENDIDO" | "NEUTRO";
  crossing: "CRUZOU_PARA_CIMA" | "CRUZOU_PARA_BAIXO" | null;
}

export interface MacdLike {
  macd: number;
  signal: number;
  histogram: number;
  label: "ALTA" | "BAIXA" | "NEUTRO";
  crossing: "CRUZOU_PARA_CIMA" | "CRUZOU_PARA_BAIXO" | null;
  turning: "VIRANDO_PARA_CIMA" | "VIRANDO_PARA_BAIXO" | null;
  histogramRecent: number[];
}

export interface AveragesLike {
  ema9: number | null;
  sma20: number | null;
  sma200: number | null;
  distancePctFromEma9: number | null;
  distancePctFromSma20: number | null;
  distancePctFromSma200: number | null;
  extended: boolean;
}

export interface Reading {
  /** Frase pronta, em português, para o analista citar. */
  texto: string;
  /** Para onde o indicador aponta AGORA neste tempo gráfico. */
  vies: Vies;
  /** Gatilho clássico de entrada presente nesta vela (cruzamento em extremo). null = sem gatilho. */
  gatilho: "COMPRA" | "VENDA" | null;
  /** Lado que este indicador DESACONSELHA neste tempo gráfico (ex.: vender em sobrevenda). */
  contraIndica: "LONG" | "SHORT" | null;
}

const SEM_DADO: Reading = { texto: "sem dado real disponível", vies: "NEUTRO", gatilho: null, contraIndica: null };

/** Linhas a menos disso de distância são tratadas como "coladas" (sem rumo). */
const STOCH_FLAT_GAP = 1.5;
const STOCH_NEAR_OVERBOUGHT = 70;
const STOCH_NEAR_OVERSOLD = 30;

const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "?");

/**
 * Estocástico Lento (5,3,3; níveis 20/80), método da casa:
 *  - extremo SEM cruzamento não é sinal de entrada;
 *  - %K cruzando o %D DENTRO do extremo é o gatilho;
 *  - nunca se vende em sobrevenda nem se compra em sobrecompra.
 */
export function readStochastic(s: StochLike | null | undefined): Reading {
  if (!s || !Number.isFinite(s.k) || !Number.isFinite(s.d)) return SEM_DADO;
  const nums = `%K ${n1(s.k)} / %D ${n1(s.d)}`;
  const kAcima = s.k > s.d;
  const coladas = Math.abs(s.k - s.d) < STOCH_FLAT_GAP;

  if (s.label === "SOBREVENDIDO") {
    if (s.crossing === "CRUZOU_PARA_CIMA") {
      return {
        texto: `SOBREVENDIDO (${nums}) e o %K ACABOU DE CRUZAR PARA CIMA do %D: gatilho clássico de COMPRA (fundo confirmado pelo cruzamento). Vender aqui é vender no fundo.`,
        vies: "ALTA", gatilho: "COMPRA", contraIndica: "SHORT",
      };
    }
    if (kAcima && !coladas) {
      return {
        texto: `SOBREVENDIDO (${nums}) com o %K já acima do %D: fundo se formando, viés de alta. Vender aqui é vender no fundo.`,
        vies: "ALTA", gatilho: null, contraIndica: "SHORT",
      };
    }
    return {
      texto: `SOBREVENDIDO (${nums}) e ainda SEM cruzamento para cima: a queda está esticada. NÃO é hora de vender (esticado) e AINDA NÃO é hora de comprar (falta o %K cruzar para cima do %D).`,
      vies: "NEUTRO", gatilho: null, contraIndica: "SHORT",
    };
  }

  if (s.label === "SOBRECOMPRADO") {
    if (s.crossing === "CRUZOU_PARA_BAIXO") {
      return {
        texto: `SOBRECOMPRADO (${nums}) e o %K ACABOU DE CRUZAR PARA BAIXO do %D: gatilho clássico de VENDA (topo confirmado pelo cruzamento). Comprar aqui é comprar no topo.`,
        vies: "BAIXA", gatilho: "VENDA", contraIndica: "LONG",
      };
    }
    if (!kAcima && !coladas) {
      return {
        texto: `SOBRECOMPRADO (${nums}) com o %K já abaixo do %D: topo se formando, viés de baixa. Comprar aqui é comprar no topo.`,
        vies: "BAIXA", gatilho: null, contraIndica: "LONG",
      };
    }
    return {
      texto: `SOBRECOMPRADO (${nums}) e ainda SEM cruzamento para baixo: a alta está esticada. NÃO é hora de comprar (esticado) e AINDA NÃO é hora de vender (falta o %K cruzar para baixo do %D).`,
      vies: "NEUTRO", gatilho: null, contraIndica: "LONG",
    };
  }

  // Zona neutra (20-80): cruzamento aqui é sinal mais fraco que em extremo.
  if (coladas && s.crossing == null) {
    return { texto: `zona neutra (${nums}) com as linhas COLADAS: sem rumo, indecisão.`, vies: "NEUTRO", gatilho: null, contraIndica: null };
  }
  if (s.crossing === "CRUZOU_PARA_CIMA" || (kAcima && s.crossing == null)) {
    const perto = s.k >= STOCH_NEAR_OVERBOUGHT ? " Já perto da sobrecompra: pouco espaço para subir antes de esticar." : "";
    const evento = s.crossing === "CRUZOU_PARA_CIMA" ? "o %K acabou de cruzar para cima do %D" : "%K acima do %D";
    return {
      texto: `zona neutra (${nums}), ${evento}: subindo, no meio do caminho (sinal mais fraco que cruzamento em extremo).${perto}`,
      vies: "ALTA", gatilho: null, contraIndica: null,
    };
  }
  const perto = s.k <= STOCH_NEAR_OVERSOLD ? " Já perto da sobrevenda: pouco espaço para cair antes de esticar." : "";
  const evento = s.crossing === "CRUZOU_PARA_BAIXO" ? "o %K acabou de cruzar para baixo do %D" : "%K abaixo do %D";
  return {
    texto: `zona neutra (${nums}), ${evento}: descendo, no meio do caminho (sinal mais fraco que cruzamento em extremo).${perto}`,
    vies: "BAIXA", gatilho: null, contraIndica: null,
  };
}

export interface MacdReading extends Reading {
  /** true quando o histograma está ENCOLHENDO em direção a zero (o lado dominante está cansando). */
  perdendoForca: boolean;
}

/**
 * MACD 12/26/9. O erro clássico que esta função existe para impedir: ler
 * "histograma negativo SUBINDO" como "baixa ganhando força" -- é o oposto, é a
 * queda perdendo força. O sinal do histograma diz QUEM manda; a inclinação diz
 * se essa força está crescendo ou morrendo.
 */
export function readMacd(m: MacdLike | null | undefined): MacdReading {
  if (!m || !Number.isFinite(m.histogram)) return { ...SEM_DADO, perdendoForca: false };
  const recent = (m.histogramRecent ?? []).filter((v) => Number.isFinite(v));
  const prev = recent.length >= 2 ? recent[recent.length - 2] : null;
  const subindo = m.turning === "VIRANDO_PARA_CIMA" || (m.turning == null && prev != null && m.histogram > prev);
  const descendo = m.turning === "VIRANDO_PARA_BAIXO" || (m.turning == null && prev != null && m.histogram < prev);
  const serie = recent.length ? ` Histograma recente: ${recent.map((v) => v.toFixed(4)).join(" → ")}.` : "";
  const fundo = Number.isFinite(m.macd) ? (m.macd > 0 ? " Linha MACD acima de zero (pano de fundo de alta)." : m.macd < 0 ? " Linha MACD abaixo de zero (pano de fundo de baixa)." : "") : "";

  if (m.crossing === "CRUZOU_PARA_CIMA") {
    return { texto: `o histograma ACABOU DE CRUZAR PARA CIMA de zero: virada de momentum para ALTA nesta vela.${serie}${fundo}`, vies: "ALTA", gatilho: "COMPRA", contraIndica: "SHORT", perdendoForca: false };
  }
  if (m.crossing === "CRUZOU_PARA_BAIXO") {
    return { texto: `o histograma ACABOU DE CRUZAR PARA BAIXO de zero: virada de momentum para BAIXA nesta vela.${serie}${fundo}`, vies: "BAIXA", gatilho: "VENDA", contraIndica: "LONG", perdendoForca: false };
  }
  if (m.histogram > 0) {
    if (descendo) {
      return { texto: `histograma POSITIVO mas ENCOLHENDO: os compradores ainda mandam, porém a alta está PERDENDO força (não é sinal de venda sozinho; é a compra cansando).${serie}${fundo}`, vies: "ALTA", gatilho: null, contraIndica: null, perdendoForca: true };
    }
    return { texto: `histograma POSITIVO${subindo ? " e CRESCENDO: força compradora aumentando" : ": compradores no comando"}.${serie}${fundo}`, vies: "ALTA", gatilho: null, contraIndica: subindo ? "SHORT" : null, perdendoForca: false };
  }
  if (m.histogram < 0) {
    if (subindo) {
      return { texto: `histograma NEGATIVO mas ENCOLHENDO (subindo em direção a zero): os vendedores ainda mandam, porém a queda está PERDENDO força -- possível virada para cima. Isto NÃO é "baixa ganhando força".${serie}${fundo}`, vies: "BAIXA", gatilho: null, contraIndica: null, perdendoForca: true };
    }
    return { texto: `histograma NEGATIVO${descendo ? " e AFUNDANDO: força vendedora aumentando" : ": vendedores no comando"}.${serie}${fundo}`, vies: "BAIXA", gatilho: null, contraIndica: descendo ? "LONG" : null, perdendoForca: false };
  }
  return { texto: `histograma em zero: sem momentum definido.${serie}${fundo}`, vies: "NEUTRO", gatilho: null, contraIndica: null, perdendoForca: false };
}

const pct = (v: number | null) => (v == null || !Number.isFinite(v) ? "?" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);

/** Médias 9 (EMA) e 20 (SMA), mais a 200 como pano de fundo. distancePct = (preço - média) / média. */
export function readAverages(a: AveragesLike | null | undefined): Reading {
  if (!a || a.distancePctFromEma9 == null || a.distancePctFromSma20 == null) return SEM_DADO;
  const acima9 = a.distancePctFromEma9 > 0;
  const acima20 = a.distancePctFromSma20 > 0;
  const armadas: Vies = a.ema9 != null && a.sma20 != null ? (a.ema9 > a.sma20 ? "ALTA" : a.ema9 < a.sma20 ? "BAIXA" : "NEUTRO") : "NEUTRO";
  const fundo = a.distancePctFromSma200 == null ? "" : ` Preço ${a.distancePctFromSma200 > 0 ? "acima" : "abaixo"} da média de 200 (${pct(a.distancePctFromSma200)}).`;
  const esticado = a.extended ? " Preço ESTICADO, longe das médias: risco de voltar para a média." : "";
  const base = `preço ${acima9 ? "acima" : "abaixo"} da média de 9 (${pct(a.distancePctFromEma9)}) e ${acima20 ? "acima" : "abaixo"} da média de 20 (${pct(a.distancePctFromSma20)})`;

  if (acima9 && acima20 && armadas === "ALTA") {
    return { texto: `${base}; média de 9 acima da de 20: médias ARMADAS PARA ALTA.${fundo}${esticado}`, vies: "ALTA", gatilho: null, contraIndica: a.extended ? "LONG" : null };
  }
  if (!acima9 && !acima20 && armadas === "BAIXA") {
    return { texto: `${base}; média de 9 abaixo da de 20: médias ARMADAS PARA BAIXA.${fundo}${esticado}`, vies: "BAIXA", gatilho: null, contraIndica: a.extended ? "SHORT" : null };
  }
  const cruzando = armadas === "ALTA" ? "média de 9 acima da de 20" : armadas === "BAIXA" ? "média de 9 abaixo da de 20" : "médias de 9 e 20 juntas";
  return { texto: `${base}; ${cruzando}: médias EMBARALHADAS (preço entre as médias ou contra elas), sem tendência limpa.${fundo}${esticado}`, vies: "NEUTRO", gatilho: null, contraIndica: null };
}

export interface TimeframeReadings {
  tf: string;
  estocastico: Reading;
  macd: MacdReading;
  medias: Reading;
}

/** Placar de alinhamento entre tempos gráficos, calculado por código (a IA não conta nada). */
export function alignmentSummary(rows: TimeframeReadings[]): string {
  if (rows.length === 0) return "sem dado de nenhum tempo gráfico";
  const linhas = rows.map((r) => `${r.tf}: estocástico ${r.estocastico.vies} | MACD ${r.macd.vies}${r.macd.perdendoForca ? " (perdendo força)" : ""} | médias ${r.medias.vies}`);
  const conta = (campo: "estocastico" | "macd" | "medias", v: Vies) => rows.filter((r) => r[campo].vies === v).length;
  const total = (v: Vies) => conta("estocastico", v) + conta("macd", v) + conta("medias", v);
  const semDado = rows.reduce((s, r) => s + [r.estocastico, r.macd, r.medias].filter((x) => x.texto === SEM_DADO.texto).length, 0);
  const gatilhos = rows.flatMap((r) => [
    r.estocastico.gatilho ? `estocástico ${r.tf}: ${r.estocastico.gatilho}` : null,
    r.macd.gatilho ? `MACD ${r.tf}: ${r.macd.gatilho}` : null,
  ]).filter((x): x is string => x !== null);
  const contras = (lado: "LONG" | "SHORT") => rows.flatMap((r) => [
    r.estocastico.contraIndica === lado ? `estocástico ${r.tf}` : null,
    r.macd.contraIndica === lado ? `MACD ${r.tf}` : null,
    r.medias.contraIndica === lado ? `médias ${r.tf}` : null,
  ]).filter((x): x is string => x !== null);
  return [
    ...linhas,
    `PLACAR (${rows.length} tempos x 3 indicadores): ALTA ${total("ALTA")} | BAIXA ${total("BAIXA")} | NEUTRO ${total("NEUTRO")}${semDado ? ` (dos quais ${semDado} sem dado)` : ""}`,
    `GATILHOS NESTA VELA: ${gatilhos.length ? gatilhos.join("; ") : "nenhum"}`,
    `DESACONSELHAM COMPRA (LONG): ${contras("LONG").join(", ") || "nenhum"}`,
    `DESACONSELHAM VENDA (SHORT): ${contras("SHORT").join(", ") || "nenhum"}`,
  ].join("\n");
}

export interface DayRangeReading {
  texto: string;
  /** Onde o preço está no range das últimas 24h. */
  zona: "COLADO_NA_MINIMA" | "PARTE_DE_BAIXO" | "MEIO" | "PARTE_DE_CIMA" | "COLADO_NA_MAXIMA" | "ROMPEU_MINIMA" | "ROMPEU_MAXIMA";
  /** true quando a proposta é vender colado na mínima ou comprar colado na máxima. */
  contraOExtremo: boolean;
}

/**
 * Posição do preço no range do dia, EM PALAVRAS. No ensaio de 13/10 o analista
 * recebeu "0,35 do range (0 = mínima, 1 = máxima)" e escreveu "entrada colada
 * no topo do dia" -- leu ao contrário, e o erro foi parar na decisão final.
 * Número cru não vai mais pra IA: vai a conclusão.
 */
export function readDayRange(
  price: number,
  dailyHigh: number,
  dailyLow: number,
  side: "LONG" | "SHORT",
  coladoFrac = 0.15,
): DayRangeReading | null {
  const range = dailyHigh - dailyLow;
  if (![price, dailyHigh, dailyLow].every((v) => Number.isFinite(v) && v > 0) || !(range > 0)) return null;
  const pos = (price - dailyLow) / range;
  const pctDoRange = `${Math.round(Math.max(0, Math.min(1, pos)) * 100)}% do caminho entre a mínima e a máxima`;

  if (pos < 0) {
    return {
      texto: `o preço está ABAIXO da mínima das últimas 24h: fundo novo sendo feito agora.${side === "SHORT" ? " Vender aqui é vender depois do rompimento: só com fechamento de vela confirmando." : " Comprar aqui é comprar faca caindo: só com sinal claro de reversão."}`,
      zona: "ROMPEU_MINIMA",
      contraOExtremo: false,
    };
  }
  if (pos > 1) {
    return {
      texto: `o preço está ACIMA da máxima das últimas 24h: topo novo sendo feito agora.${side === "LONG" ? " Comprar aqui é comprar depois do rompimento: só com fechamento de vela confirmando." : " Vender aqui é vender contra um rompimento: só com sinal claro de reversão."}`,
      zona: "ROMPEU_MAXIMA",
      contraOExtremo: false,
    };
  }
  if (pos <= coladoFrac) {
    return {
      texto: `o preço está COLADO NA MÍNIMA do dia (${pctDoRange}).${side === "SHORT" ? " A proposta é VENDER NA MÍNIMA DO DIA: mínima costuma segurar e devolver." : " Comprar aqui é comprar perto do fundo do dia."}`,
      zona: "COLADO_NA_MINIMA",
      contraOExtremo: side === "SHORT",
    };
  }
  if (pos >= 1 - coladoFrac) {
    return {
      texto: `o preço está COLADO NA MÁXIMA do dia (${pctDoRange}).${side === "LONG" ? " A proposta é COMPRAR NA MÁXIMA DO DIA: máxima costuma barrar e devolver." : " Vender aqui é vender perto do topo do dia."}`,
      zona: "COLADO_NA_MAXIMA",
      contraOExtremo: side === "LONG",
    };
  }
  if (pos < 0.4) {
    return { texto: `o preço está na PARTE DE BAIXO do range do dia (${pctDoRange}): mais perto da mínima que da máxima, mas NÃO colado em nenhum extremo.`, zona: "PARTE_DE_BAIXO", contraOExtremo: false };
  }
  if (pos > 0.6) {
    return { texto: `o preço está na PARTE DE CIMA do range do dia (${pctDoRange}): mais perto da máxima que da mínima, mas NÃO colado em nenhum extremo.`, zona: "PARTE_DE_CIMA", contraOExtremo: false };
  }
  return { texto: `o preço está no MEIO do range do dia (${pctDoRange}): longe dos dois extremos.`, zona: "MEIO", contraOExtremo: false };
}

export interface TargetBarrier {
  /** Ex.: "suporte do 5m", "mínima das últimas 24h". */
  nome: string;
  /** Distância do preço até o nível, em % do preço (0,12 = 0,12%). null = sem dado. */
  distanciaPct: number | null;
  /** Nível que o preço já rompeu não barra mais nada. */
  rompido: boolean;
}

export interface TargetRoomReading {
  texto: string;
  /** true = nenhum nível conhecido fica no caminho do alvo. false = o alvo depende de romper algo. null = sem dado de nenhum nível. */
  cabe: boolean | null;
}

/**
 * Há espaço para o alvo? Para VENDA o que barra é o que está ABAIXO (suporte,
 * mínima do dia); para COMPRA, o que está ACIMA (resistência, máxima). Quem
 * chama já passa só as barreiras do lado certo -- no ensaio de 13/10 o
 * analista mediu o espaço de uma venda até a RESISTÊNCIA.
 */
export function readTargetRoom(side: "LONG" | "SHORT", alvoPct: number, barreiras: TargetBarrier[]): TargetRoomReading {
  const direcao = side === "LONG" ? "para cima" : "para baixo";
  const conhecidas = barreiras.filter((b) => b.rompido || (b.distanciaPct != null && Number.isFinite(b.distanciaPct)));
  if (!(alvoPct > 0) || conhecidas.length === 0) {
    return { texto: `sem dado de nível ${direcao}: não dá para dizer se o alvo cabe.`, cabe: null };
  }
  const noCaminho = conhecidas.filter((b) => !b.rompido && (b.distanciaPct as number) < alvoPct);
  const livres = conhecidas.filter((b) => !noCaminho.includes(b));
  const fmt = (b: TargetBarrier) => (b.rompido ? `${b.nome} (já rompido, não barra)` : `${b.nome} a ${(b.distanciaPct as number).toFixed(3)}%`);
  if (noCaminho.length === 0) {
    return {
      texto: `HÁ ESPAÇO para o alvo de ${alvoPct.toFixed(3)}% ${direcao}: nenhum nível conhecido fica no caminho (${livres.map(fmt).join("; ")}).`,
      cabe: true,
    };
  }
  return {
    texto:
      `O ALVO NÃO CABE sem rompimento: o alvo fica a ${alvoPct.toFixed(3)}% ${direcao}, mas antes dele está ${noCaminho.map(fmt).join(" e ")}. ` +
      `Para o alvo ser atingido o preço teria de ROMPER ${noCaminho.length > 1 ? "esses níveis" : "esse nível"}.` +
      (livres.length ? ` Sem barreira: ${livres.map(fmt).join("; ")}.` : ""),
    cabe: false,
  };
}

export interface HardVeto {
  id: "ESTOCASTICO_EXTREMO_CONTRA" | "MACD_5M_ESGOTANDO" | "TEMPO_MAIOR_CONTRA" | "EXTREMO_DO_DIA_CONTRA" | "ALVO_NAO_CABE";
  texto: string;
}

/** Viés geral de um tempo gráfico: o lado com mais votos entre estocástico, MACD e médias. Empate = NEUTRO. */
export function timeframeBias(r: TimeframeReadings): Vies {
  const votes = [r.estocastico.vies, r.macd.vies, r.medias.vies];
  const alta = votes.filter((v) => v === "ALTA").length;
  const baixa = votes.filter((v) => v === "BAIXA").length;
  return alta > baixa ? "ALTA" : baixa > alta ? "BAIXA" : "NEUTRO";
}

/**
 * Os 4 vetos duros do método da casa, CALCULADOS POR CÓDIGO. No 1º teste real da mesa (13/10) o
 * Trader Sênior reconheceu um gatilho válido (estocástico cruzando para baixo em sobrecompra,
 * VENDA) e barrou por um "veto duro: preço colado no extremo do dia contra o lado" que nenhum
 * dado sustentava: ele inventou o veto. Agora só valem como veto duro os que esta função listar.
 *
 * Só os tempos de 5m, 15m e 1H entram no veto de estocástico (o 4H é contexto, não veto).
 */
export function computeHardVetoes(params: {
  side: "LONG" | "SHORT";
  readings: TimeframeReadings[];
  dayRange: DayRangeReading | null;
  targetRoom: TargetRoomReading;
}): HardVeto[] {
  const { side, readings, dayRange, targetRoom } = params;
  const vetoes: HardVeto[] = [];

  // (a) estocástico em extremo CONTRA o lado: nunca vender em sobrevenda, nunca comprar em sobrecompra
  const contra = readings.filter((r) => ["5m", "15m", "1H"].includes(r.tf) && r.estocastico.contraIndica === side);
  if (contra.length > 0) {
    vetoes.push({
      id: "ESTOCASTICO_EXTREMO_CONTRA",
      texto: `estocástico em extremo contra ${side === "SHORT" ? "a venda (sobrevendido)" : "a compra (sobrecomprado)"} no(s) tempo(s) ${contra.map((r) => r.tf).join(", ")}`,
    });
  }

  // (b) 1H E 4H, os dois, contra o lado
  const oposto: Vies = side === "LONG" ? "BAIXA" : "ALTA";
  const h1 = readings.find((r) => r.tf === "1H");
  const h4 = readings.find((r) => r.tf === "4H");
  if (h1 && h4 && timeframeBias(h1) === oposto && timeframeBias(h4) === oposto) {
    // 14/10: so vira veto duro com MT5_DESK_HIGHER_TF_VETO=true (pedido do Cleber: mesa rejeitava todo repique).
    if (process.env.MT5_DESK_HIGHER_TF_VETO === "true") vetoes.push({ id: "TEMPO_MAIOR_CONTRA", texto: `1H e 4H, os dois, apontam ${oposto} contra ${side === "LONG" ? "a compra" : "a venda"}` });
  }

  // (c) colado no extremo do dia contra o lado (vender na mínima / comprar na máxima)
  if (dayRange?.contraOExtremo) {
    vetoes.push({ id: "EXTREMO_DO_DIA_CONTRA", texto: dayRange.texto });
  }

  // (e) MACD do 5m (tempo da entrada) já perdendo força NO LADO da entrada: comprar com o
  // histograma positivo encolhendo / vender com o negativo subindo é entrar no fim do impulso.
  // Gatilho vindo de tempo maior (ex.: MACD 15m cruzando) não compensa o 5m virando.
  const m5 = readings.find((r) => r.tf === "5m")?.macd;
  if (m5?.perdendoForca && m5.vies === (side === "LONG" ? "ALTA" : "BAIXA")) {
    vetoes.push({
      id: "MACD_5M_ESGOTANDO",
      texto: `MACD do 5m (tempo da entrada) já perdendo força no lado ${side === "LONG" ? "da compra" : "da venda"}: o impulso está cansando, entrada no fim do movimento`,
    });
  }

  // (d) o alvo não cabe antes do próximo nível
  // 14/10: deixou de ser veto duro (pedido do Cleber, mesa rejeitava tudo); segue como leitura pra mesa.
  if (targetRoom.cabe === false && process.env.MT5_DESK_TARGET_ROOM_VETO === "true") {
    vetoes.push({ id: "ALVO_NAO_CABE", texto: targetRoom.texto });
  }
  return vetoes;
}

/** Extrai o primeiro objeto JSON de uma resposta de modelo (tolera ```json ... ``` e texto em volta). */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface MasterVerdict {
  decision: "APPROVE" | "REJECT";
  /** 1 = tamanho inteiro, 0.5 = metade. A mesa só REDUZ, nunca aumenta. */
  sizeFactor: 1 | 0.5;
  conviction: number | null;
  reason: string;
}

/**
 * Normaliza a resposta do Agente Master. Qualquer coisa que não seja uma
 * aprovação explícita vira REJECT (na dúvida, fica fora).
 */
export function normalizeMasterVerdict(json: Record<string, unknown> | null): MasterVerdict {
  if (!json) return { decision: "REJECT", sizeFactor: 1, conviction: null, reason: "Agente Master não devolveu uma decisão legível" };
  const decisao = String(json.decisao ?? json.decision ?? "").toUpperCase();
  const approved = /^(APROVA|APROVAR|APROVADO|APPROVE)/.test(decisao.trim()) && !/N[ÃA]O/.test(decisao);
  const tamanho = String(json.tamanho ?? "").toUpperCase();
  const convRaw = Number(json.conviccao ?? json.conviction);
  const conviction = Number.isFinite(convRaw) ? Math.max(0, Math.min(100, convRaw)) : null;
  const motivo = typeof json.motivo === "string" && json.motivo.trim() ? json.motivo.trim() : "sem motivo informado";
  return { decision: approved ? "APPROVE" : "REJECT", sizeFactor: tamanho.includes("METADE") ? 0.5 : 1, conviction, reason: motivo };
}
