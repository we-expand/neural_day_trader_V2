// Testes das funções puras da mesa de operações (src/deskReadings.ts).
// Sem rede, sem .env. Uso:  npx tsx scripts/test-desk.ts
import assert from "node:assert/strict";
import {
  alignmentSummary,
  extractJsonObject,
  normalizeMasterVerdict,
  readAverages,
  readDayRange,
  readMacd,
  readStochastic,
  readTargetRoom,
  computeHardVetoes,
  timeframeBias,
  type MacdLike,
  type StochLike,
} from "../src/deskReadings.js";
import { baseAgentName, extractStances, resolveCounterfactual, scoreAgents, wilsonInterval, type Candle1m } from "../src/deskScoring.js";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

const stoch = (k: number, d: number, crossing: StochLike["crossing"] = null): StochLike => ({
  k,
  d,
  label: k >= 80 ? "SOBRECOMPRADO" : k <= 20 ? "SOBREVENDIDO" : "NEUTRO",
  crossing,
});
const macd = (histogram: number, recent: number[], extra: Partial<MacdLike> = {}): MacdLike => ({
  macd: histogram,
  signal: 0,
  histogram,
  label: histogram > 0 ? "ALTA" : histogram < 0 ? "BAIXA" : "NEUTRO",
  crossing: null,
  turning: null,
  histogramRecent: recent,
  ...extra,
});

// ---------------- Estocástico ----------------

check("sobrevendido cruzando para cima = gatilho de COMPRA e desaconselha SHORT", () => {
  const r = readStochastic(stoch(15, 12, "CRUZOU_PARA_CIMA"));
  assert.equal(r.gatilho, "COMPRA");
  assert.equal(r.vies, "ALTA");
  assert.equal(r.contraIndica, "SHORT");
});

check("sobrevendido SEM cruzamento: não vende e ainda não compra", () => {
  const r = readStochastic(stoch(10, 16));
  assert.equal(r.gatilho, null);
  assert.equal(r.vies, "NEUTRO");
  assert.equal(r.contraIndica, "SHORT"); // nunca vender em sobrevenda
  assert.match(r.texto, /AINDA NÃO é hora de comprar/);
});

check("sobrevendido com %K já acima do %D: viés de alta, desaconselha SHORT", () => {
  const r = readStochastic(stoch(18, 12));
  assert.equal(r.vies, "ALTA");
  assert.equal(r.contraIndica, "SHORT");
  assert.equal(r.gatilho, null);
});

check("sobrecomprado cruzando para baixo = gatilho de VENDA e desaconselha LONG", () => {
  const r = readStochastic(stoch(86, 90, "CRUZOU_PARA_BAIXO"));
  assert.equal(r.gatilho, "VENDA");
  assert.equal(r.vies, "BAIXA");
  assert.equal(r.contraIndica, "LONG");
});

check("sobrecomprado SEM cruzamento: não compra e ainda não vende", () => {
  const r = readStochastic(stoch(92, 88));
  assert.equal(r.gatilho, null);
  assert.equal(r.vies, "NEUTRO");
  assert.equal(r.contraIndica, "LONG"); // nunca comprar em sobrecompra
});

check("os casos reais da madrugada: SHORT em sobrevenda é sempre desaconselhado", () => {
  // AUS200 e CHINA50 SHORT de 13/10 abriram com estocástico 5m SOBREVENDIDO.
  for (const s of [stoch(8, 14), stoch(19, 19.5), stoch(12, 9), stoch(5, 5, "CRUZOU_PARA_CIMA")]) {
    assert.equal(readStochastic(s).contraIndica, "SHORT", JSON.stringify(s));
  }
});

check("zona neutra: sobe/desce sem gatilho, e avisa quando está perto do extremo", () => {
  const up = readStochastic(stoch(74, 66));
  assert.equal(up.vies, "ALTA");
  assert.equal(up.gatilho, null);
  assert.equal(up.contraIndica, null);
  assert.match(up.texto, /perto da sobrecompra/);
  const down = readStochastic(stoch(27, 35));
  assert.equal(down.vies, "BAIXA");
  assert.match(down.texto, /perto da sobrevenda/);
  assert.equal(readStochastic(stoch(50, 40, "CRUZOU_PARA_CIMA")).vies, "ALTA");
  assert.equal(readStochastic(stoch(50, 60, "CRUZOU_PARA_BAIXO")).vies, "BAIXA");
});

check("linhas coladas na zona neutra = indecisão", () => {
  const r = readStochastic(stoch(50, 50.4));
  assert.equal(r.vies, "NEUTRO");
  assert.match(r.texto, /COLADAS/);
});

check("sem dado não vira sinal", () => {
  for (const r of [readStochastic(null), readStochastic(undefined), readStochastic({ k: NaN, d: 10, label: "NEUTRO", crossing: null })]) {
    assert.equal(r.vies, "NEUTRO");
    assert.equal(r.gatilho, null);
    assert.equal(r.contraIndica, null);
    assert.match(r.texto, /sem dado/);
  }
});

// ---------------- MACD ----------------

check("histograma negativo SUBINDO = queda perdendo força (o erro clássico da IA)", () => {
  const r = readMacd(macd(-0.08, [-0.62, -0.27, -0.08]));
  assert.equal(r.vies, "BAIXA"); // os vendedores ainda mandam...
  assert.equal(r.perdendoForca, true); // ...mas a força está morrendo
  assert.equal(r.contraIndica, null); // não desaconselha comprar
  assert.match(r.texto, /PERDENDO força/);
  assert.match(r.texto, /NÃO é "baixa ganhando força"/);
});

check("histograma negativo AFUNDANDO = força vendedora aumentando, desaconselha LONG", () => {
  const r = readMacd(macd(-0.9, [-0.2, -0.5, -0.9]));
  assert.equal(r.vies, "BAIXA");
  assert.equal(r.perdendoForca, false);
  assert.equal(r.contraIndica, "LONG");
});

check("histograma positivo ENCOLHENDO = alta perdendo força", () => {
  const r = readMacd(macd(0.1, [0.7, 0.4, 0.1]));
  assert.equal(r.vies, "ALTA");
  assert.equal(r.perdendoForca, true);
  assert.equal(r.contraIndica, null);
});

check("histograma positivo CRESCENDO = força compradora, desaconselha SHORT", () => {
  const r = readMacd(macd(0.9, [0.2, 0.5, 0.9]));
  assert.equal(r.vies, "ALTA");
  assert.equal(r.contraIndica, "SHORT");
});

check("cruzamento do histograma é gatilho", () => {
  const up = readMacd(macd(0.05, [-0.3, -0.1, 0.05], { crossing: "CRUZOU_PARA_CIMA" }));
  assert.equal(up.gatilho, "COMPRA");
  assert.equal(up.contraIndica, "SHORT");
  const down = readMacd(macd(-0.05, [0.3, 0.1, -0.05], { crossing: "CRUZOU_PARA_BAIXO" }));
  assert.equal(down.gatilho, "VENDA");
  assert.equal(down.contraIndica, "LONG");
});

check("o campo `turning` do motor manda sobre a comparação de 2 velas", () => {
  // histograma negativo, última vela um pouco menor, mas o motor já classificou VIRANDO_PARA_CIMA (2 altas seguidas antes)
  const r = readMacd(macd(-0.3, [-0.5, -0.29, -0.3], { turning: "VIRANDO_PARA_CIMA" }));
  assert.equal(r.perdendoForca, true);
});

check("MACD sem dado não vira sinal", () => {
  const r = readMacd(null);
  assert.equal(r.vies, "NEUTRO");
  assert.equal(r.perdendoForca, false);
});

// ---------------- Médias ----------------

const avg = (d9: number, d20: number, ema9: number, sma20: number, extended = false, d200: number | null = null) => ({
  ema9,
  sma20,
  sma200: d200 == null ? null : 100,
  distancePctFromEma9: d9,
  distancePctFromSma20: d20,
  distancePctFromSma200: d200,
  extended,
});

check("preço acima das duas médias e 9 acima da 20 = armadas para alta", () => {
  const r = readAverages(avg(0.1, 0.25, 101, 100));
  assert.equal(r.vies, "ALTA");
  assert.equal(r.contraIndica, null);
});

check("armadas para alta mas ESTICADO = desaconselha comprar", () => {
  const r = readAverages(avg(0.9, 1.4, 101, 100, true));
  assert.equal(r.vies, "ALTA");
  assert.equal(r.contraIndica, "LONG");
  assert.match(r.texto, /ESTICADO/);
});

check("preço abaixo das duas médias e 9 abaixo da 20 = armadas para baixa", () => {
  assert.equal(readAverages(avg(-0.1, -0.3, 99, 100)).vies, "BAIXA");
});

check("preço entre as médias = embaralhadas, sem tendência", () => {
  const r = readAverages(avg(-0.05, 0.1, 100.5, 100));
  assert.equal(r.vies, "NEUTRO");
  assert.match(r.texto, /EMBARALHADAS/);
});

check("médias sem dado não viram sinal", () => {
  assert.equal(readAverages(null).vies, "NEUTRO");
  assert.equal(readAverages({ ...avg(0.1, 0.1, 1, 1), distancePctFromSma20: null }).texto, "sem dado real disponível");
});

// ---------------- Placar ----------------

check("placar conta os tempos gráficos e lista quem desaconselha cada lado", () => {
  const rows = [
    { tf: "5m", estocastico: readStochastic(stoch(10, 16)), macd: readMacd(macd(-0.9, [-0.2, -0.5, -0.9])), medias: readAverages(avg(-0.1, -0.3, 99, 100)) },
    { tf: "1H", estocastico: readStochastic(stoch(15, 12, "CRUZOU_PARA_CIMA")), macd: readMacd(macd(-0.08, [-0.62, -0.27, -0.08])), medias: readAverages(null) },
  ];
  const text = alignmentSummary(rows);
  assert.match(text, /5m: estocástico NEUTRO \| MACD BAIXA \| médias BAIXA/);
  assert.match(text, /1H: estocástico ALTA \| MACD BAIXA \(perdendo força\) \| médias NEUTRO/);
  assert.match(text, /ALTA 1 \| BAIXA 3 \| NEUTRO 2 \(dos quais 1 sem dado\)/);
  assert.match(text, /GATILHOS NESTA VELA: estocástico 1H: COMPRA/);
  assert.match(text, /DESACONSELHAM VENDA \(SHORT\): estocástico 5m, estocástico 1H/);
  assert.match(text, /DESACONSELHAM COMPRA \(LONG\): MACD 5m/);
  assert.equal(alignmentSummary([]), "sem dado de nenhum tempo gráfico");
});

// ---------------- Posição no dia e espaço para o alvo ----------------

check("o caso real do ensaio: 35% do range é parte de BAIXO, não 'colado no topo'", () => {
  // NAS100 13/10: o analista recebeu "0,35 (0 = mínima, 1 = máxima)" e escreveu "entrada colada no topo do dia".
  const r = readDayRange(30535, 30700, 30446, "SHORT")!;
  assert.equal(r.zona, "PARTE_DE_BAIXO");
  assert.equal(r.contraOExtremo, false);
  assert.match(r.texto, /PARTE DE BAIXO/);
  assert.match(r.texto, /NÃO colado/);
  assert.doesNotMatch(r.texto, /MÁXIMA do dia/);
});

check("vender colado na mínima e comprar colado na máxima são marcados", () => {
  const venderNaMinima = readDayRange(101, 200, 100, "SHORT")!;
  assert.equal(venderNaMinima.zona, "COLADO_NA_MINIMA");
  assert.equal(venderNaMinima.contraOExtremo, true);
  assert.match(venderNaMinima.texto, /VENDER NA MÍNIMA DO DIA/);
  const comprarNaMaxima = readDayRange(199, 200, 100, "LONG")!;
  assert.equal(comprarNaMaxima.zona, "COLADO_NA_MAXIMA");
  assert.equal(comprarNaMaxima.contraOExtremo, true);
  // os casos reais de 13/10: BTCUSD LONG em 0,872 e 0,829 do range
  assert.equal(readDayRange(187.2, 200, 100, "LONG")!.contraOExtremo, true);
  assert.equal(readDayRange(182.9, 200, 100, "LONG")!.contraOExtremo, false); // 0,829 fica fora do limite de 15%
  // comprar perto do fundo / vender perto do topo NÃO é "contra o extremo"
  assert.equal(readDayRange(101, 200, 100, "LONG")!.contraOExtremo, false);
  assert.equal(readDayRange(199, 200, 100, "SHORT")!.contraOExtremo, false);
});

check("meio, parte de cima e rompimentos", () => {
  assert.equal(readDayRange(150, 200, 100, "LONG")!.zona, "MEIO");
  assert.equal(readDayRange(170, 200, 100, "LONG")!.zona, "PARTE_DE_CIMA");
  assert.equal(readDayRange(95, 200, 100, "SHORT")!.zona, "ROMPEU_MINIMA");
  assert.equal(readDayRange(205, 200, 100, "LONG")!.zona, "ROMPEU_MAXIMA");
  assert.equal(readDayRange(150, 100, 100, "LONG"), null); // range zero: sem leitura
  assert.equal(readDayRange(NaN, 200, 100, "LONG"), null);
});

check("venda: o que barra o alvo é o suporte (abaixo), e o alvo cabe ou não cabe", () => {
  const cabe = readTargetRoom("SHORT", 0.29, [{ nome: "suporte do 5m", distanciaPct: 0.45, rompido: false }, { nome: "mínima das últimas 24h", distanciaPct: 0.9, rompido: false }]);
  assert.equal(cabe.cabe, true);
  assert.match(cabe.texto, /HÁ ESPAÇO/);
  assert.match(cabe.texto, /para baixo/);
  const naoCabe = readTargetRoom("SHORT", 0.29, [{ nome: "suporte do 5m", distanciaPct: 0.1, rompido: false }, { nome: "suporte do 1H", distanciaPct: 0.6, rompido: false }]);
  assert.equal(naoCabe.cabe, false);
  assert.match(naoCabe.texto, /O ALVO NÃO CABE/);
  assert.match(naoCabe.texto, /suporte do 5m a 0\.100%/);
  assert.match(naoCabe.texto, /ROMPER esse nível/);
  assert.match(naoCabe.texto, /Sem barreira: suporte do 1H/);
});

check("nível já rompido não barra; sem dado não vira conclusão", () => {
  assert.equal(readTargetRoom("LONG", 0.29, [{ nome: "resistência do 5m", distanciaPct: 0.05, rompido: true }]).cabe, true);
  assert.equal(readTargetRoom("LONG", 0.29, []).cabe, null);
  assert.equal(readTargetRoom("LONG", 0.29, [{ nome: "resistência do 5m", distanciaPct: null, rompido: false }]).cabe, null);
  assert.match(readTargetRoom("LONG", 0.29, [{ nome: "resistência do 5m", distanciaPct: 0.5, rompido: false }]).texto, /para cima/);
});

// ---------------- Vetos duros calculados por código ----------------

const rowTf = (tf: string, st: StochLike | null, m: MacdLike | null, a: ReturnType<typeof avg> | null) => ({
  tf,
  estocastico: readStochastic(st),
  macd: readMacd(m),
  medias: readAverages(a),
});
const folga = readTargetRoom("SHORT", 0.35, [{ nome: "suporte do 5m", distanciaPct: 0.9, rompido: false }]);

check("o caso real XETUSD SHORT (13/10): gatilho A válido, nada colado no extremo => NENHUM veto duro", () => {
  // estocástico 5m sobrecomprado cruzando para baixo (o melhor gatilho de VENDA); preço acima das médias; posição no meio do dia
  const readings = [
    rowTf("5m", stoch(86, 90, "CRUZOU_PARA_BAIXO"), macd(0.05, [0.3, 0.1, 0.05]), avg(0.1, 0.25, 101, 100)),
    rowTf("1H", stoch(60, 55), macd(0.4, [0.1, 0.2, 0.4]), avg(0.2, 0.3, 101, 100)),
    rowTf("4H", stoch(48, 52), null, null), // 4H sem direção contra a venda (1H em alta, 4H não)
  ];
  const dayRange = readDayRange(100, 200, 50, "SHORT")!; // 33% do range: parte de baixo, mas NÃO colado na mínima
  assert.equal(dayRange.contraOExtremo, false);
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings, dayRange, targetRoom: folga }), []);
});

check("o mesmo cenário com 1H E 4H os dois em alta VETA a venda (regra de tempo maior)", () => {
  const readings = [
    rowTf("5m", stoch(86, 90, "CRUZOU_PARA_BAIXO"), null, null),
    rowTf("1H", stoch(60, 55), macd(0.4, [0.1, 0.2, 0.4]), avg(0.2, 0.3, 101, 100)),
    rowTf("4H", stoch(60, 55), macd(0.4, [0.1, 0.2, 0.4]), avg(0.2, 0.3, 101, 100)),
  ];
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings, dayRange: null, targetRoom: folga }).map((x) => x.id), ["TEMPO_MAIOR_CONTRA"]);
});

check("veto: estocástico em extremo contra o lado (vender em sobrevenda / comprar em sobrecompra)", () => {
  const r = [rowTf("5m", stoch(10, 16), null, null), rowTf("1H", stoch(50, 50.2), null, null)];
  const v = computeHardVetoes({ side: "SHORT", readings: r, dayRange: null, targetRoom: folga });
  assert.deepEqual(v.map((x) => x.id), ["ESTOCASTICO_EXTREMO_CONTRA"]);
  assert.match(v[0].texto, /5m/);
  // o mesmo estocástico não veta a COMPRA
  assert.deepEqual(computeHardVetoes({ side: "LONG", readings: r, dayRange: null, targetRoom: folga }), []);
  // o 4H em extremo é contexto, não veto
  const so4h = [rowTf("5m", stoch(50, 40), null, null), rowTf("4H", stoch(95, 90), null, null)];
  assert.deepEqual(computeHardVetoes({ side: "LONG", readings: so4h, dayRange: null, targetRoom: folga }), []);
});

check("veto: MACD do 5m perdendo força no lado da entrada (caso XETUSD 13/10)", () => {
  // histograma positivo encolhendo = compra cansando; 15m acabou de cruzar para cima não salva
  const cansando = [
    rowTf("5m", stoch(50, 45), macd(0.2, [0.6, 0.4, 0.2]), null),
    rowTf("15m", stoch(50, 45), macd(0.05, [-0.1, 0.05], { crossing: "CRUZOU_PARA_CIMA" }), null),
  ];
  assert.deepEqual(computeHardVetoes({ side: "LONG", readings: cansando, dayRange: null, targetRoom: folga }).map((x) => x.id), ["MACD_5M_ESGOTANDO"]);
  // o mesmo MACD não veta a VENDA (compra cansando favorece vender)
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings: cansando, dayRange: null, targetRoom: folga }), []);
  // 5m crescendo a favor: sem veto
  const forte = [rowTf("5m", stoch(50, 45), macd(0.6, [0.2, 0.4, 0.6]), null)];
  assert.deepEqual(computeHardVetoes({ side: "LONG", readings: forte, dayRange: null, targetRoom: folga }), []);
});

check("veto: 1H E 4H os dois contra (um só discordando não é veto)", () => {
  const baixa = (tf: string) => rowTf(tf, stoch(40, 50), macd(-0.5, [-0.1, -0.3, -0.5]), avg(-0.1, -0.3, 99, 100));
  const alta = (tf: string) => rowTf(tf, stoch(60, 50), macd(0.5, [0.1, 0.3, 0.5]), avg(0.1, 0.3, 101, 100));
  assert.equal(timeframeBias(baixa("1H")), "BAIXA");
  const ambos = computeHardVetoes({ side: "LONG", readings: [baixa("1H"), baixa("4H")], dayRange: null, targetRoom: folga });
  assert.deepEqual(ambos.map((x) => x.id), ["TEMPO_MAIOR_CONTRA"]);
  assert.deepEqual(computeHardVetoes({ side: "LONG", readings: [baixa("1H"), alta("4H")], dayRange: null, targetRoom: folga }), []);
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings: [baixa("1H"), baixa("4H")], dayRange: null, targetRoom: folga }), []);
});

check("veto: vender colado na mínima / comprar colado na máxima; e alvo que não cabe", () => {
  const sobMinima = readDayRange(101, 200, 100, "SHORT")!;
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings: [], dayRange: sobMinima, targetRoom: folga }).map((x) => x.id), ["EXTREMO_DO_DIA_CONTRA"]);
  const naoCabe = readTargetRoom("SHORT", 0.35, [{ nome: "suporte do 5m", distanciaPct: 0.1, rompido: false }]);
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings: [], dayRange: null, targetRoom: naoCabe }).map((x) => x.id), ["ALVO_NAO_CABE"]);
  // sem dado de nível: não vira veto
  assert.deepEqual(computeHardVetoes({ side: "SHORT", readings: [], dayRange: null, targetRoom: readTargetRoom("SHORT", 0.35, []) }), []);
});

// ---------------- JSON e veredito do Master ----------------

check("extrai JSON mesmo com cerca de código e texto em volta", () => {
  assert.deepEqual(extractJsonObject('```json\n{"decisao":"APROVAR","conviccao":70}\n```'), { decisao: "APROVAR", conviccao: 70 });
  assert.deepEqual(extractJsonObject('Claro! {"a":{"b":1}} fim'), { a: { b: 1 } });
  assert.equal(extractJsonObject("sem json aqui"), null);
  assert.equal(extractJsonObject('{"cortado": '), null);
  assert.equal(extractJsonObject("[1,2]"), null);
  assert.equal(extractJsonObject(""), null);
});

check("Master: só aprovação explícita aprova; todo o resto rejeita", () => {
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", tamanho: "INTEIRO", conviccao: 72, motivo: "ok" }).decision, "APPROVE");
  assert.equal(normalizeMasterVerdict({ decisao: "aprovado" }).decision, "APPROVE");
  for (const decisao of ["REJEITAR", "NAO APROVAR", "NÃO APROVAR", "", "TALVEZ", "EXECUTAR", "aprovar não"]) {
    assert.equal(normalizeMasterVerdict({ decisao }).decision, "REJECT", decisao);
  }
  assert.equal(normalizeMasterVerdict(null).decision, "REJECT");
  assert.equal(normalizeMasterVerdict({}).decision, "REJECT");
  assert.equal(normalizeMasterVerdict({ decisao: 1 }).decision, "REJECT");
});

check("Master: tamanho só reduz e convicção fica entre 0 e 100", () => {
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", tamanho: "METADE" }).sizeFactor, 0.5);
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", tamanho: "DOBRO" }).sizeFactor, 1);
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR" }).sizeFactor, 1);
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", conviccao: 140 }).conviction, 100);
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", conviccao: -3 }).conviction, 0);
  assert.equal(normalizeMasterVerdict({ decisao: "APROVAR", conviccao: "alta" }).conviction, null);
  assert.equal(normalizeMasterVerdict({ decisao: "REJEITAR" }).reason, "sem motivo informado");
});

// ---------------- Aprendizado: posturas, desfecho contrafactual, placar ----------------

const MIN = 60_000;
const T0 = 1_800_000_000_000; // instante da decisão
const c = (minAfter: number, high: number, low: number): Candle1m => ({ timestamp: T0 + minAfter * MIN, high, low });
const base = { side: "LONG" as const, entryPrice: 100, stopPrice: 99, targetPrice: 101, decidedAtMs: T0 };

check("nome do agente: a réplica não vira outro agente", () => {
  assert.equal(baseAgentName("Pesquisador Comprador (réplica)"), "Pesquisador Comprador");
  assert.equal(baseAgentName("Pesquisador Vendedor (réplica 2)"), "Pesquisador Vendedor");
  assert.equal(baseAgentName("Trader Sênior"), "Trader Sênior");
});

check("posturas: cada agente, no formato real que ele devolve", () => {
  const t = [
    { agent: "Analista de Estocástico", ok: true, json: { apoia_a_proposta: false } },
    { agent: "Analista de MACD", ok: true, json: { apoia_a_proposta: true } },
    { agent: "Analista de Notícias", ok: true, json: { vies: "ALTA" } }, // sem o campo: sem posição
    { agent: "Trader Sênior", ok: true, json: { decisao: "NAO_EXECUTAR" } },
    { agent: "Risco Agressivo", ok: true, json: { posicao: "APOIA_COM_METADE" } },
    { agent: "Risco Conservador", ok: true, json: { posicao: "CONTRA" } },
    { agent: "Gestor de Portfólio", ok: true, json: { parecer: "CABE_NA_CARTEIRA" } },
    { agent: "Gestor de Risco", ok: true, json: { parecer: "VETA" } },
    { agent: "Analista de Sentimento", ok: false, json: null }, // não respondeu: sem posição
  ];
  const st = extractStances(t, "LONG", "REJECT");
  assert.deepEqual(st, {
    "Analista de Estocástico": false,
    "Analista de MACD": true,
    "Trader Sênior": false,
    "Risco Agressivo": true,
    "Risco Conservador": false,
    "Gestor de Portfólio": true,
    "Gestor de Risco": false,
    "Agente Master": false,
  });
  assert.equal(extractStances([], "LONG", "APPROVE")["Agente Master"], true);
});

check("posturas: analista NEUTRO não tomou posição (não conta como 'foi contra')", () => {
  const t = [
    { agent: "Analista Fundamentalista", ok: true, json: { vies: "NEUTRO", apoia_a_proposta: false } },
    { agent: "Analista de Notícias", ok: true, json: { vies: "NEUTRO", apoia_a_proposta: false } },
    { agent: "Analista de Sentimento", ok: true, json: { vies: "neutro", apoia_a_proposta: false } },
    { agent: "Analista de Estocástico", ok: true, json: { vies: "BAIXA", apoia_a_proposta: false } }, // direcional e contra: conta
    { agent: "Analista de MACD", ok: true, json: { vies: "ALTA", apoia_a_proposta: true } },
  ];
  const st = extractStances(t, "LONG", "REJECT");
  assert.equal("Analista Fundamentalista" in st, false);
  assert.equal("Analista de Notícias" in st, false);
  assert.equal("Analista de Sentimento" in st, false);
  assert.equal(st["Analista de Estocástico"], false);
  assert.equal(st["Analista de MACD"], true);
});

check("posturas: debate usa a réplica (a mais nova) e o lado da proposta", () => {
  const t = [
    { agent: "Pesquisador Comprador", ok: true, json: { forca_da_tese: 80 } },
    { agent: "Pesquisador Vendedor", ok: true, json: { forca_da_tese: 30 } },
    { agent: "Pesquisador Comprador (réplica)", ok: true, json: { forca_da_tese: 40 } },
    { agent: "Pesquisador Vendedor (réplica)", ok: true, json: { forca_da_tese: 70 } },
  ];
  assert.equal(extractStances(t, "LONG", "REJECT")["Debate (comprador x vendedor)"], false); // vendedor terminou mais forte
  assert.equal(extractStances(t, "SHORT", "REJECT")["Debate (comprador x vendedor)"], true);
  const empate = [
    { agent: "Pesquisador Comprador", ok: true, json: { forca_da_tese: 50 } },
    { agent: "Pesquisador Vendedor", ok: true, json: { forca_da_tese: 50 } },
  ];
  assert.equal("Debate (comprador x vendedor)" in extractStances(empate, "LONG", "REJECT"), false); // empate: sem posição
});

check("desfecho LONG: alvo antes do stop, stop antes do alvo, mesma vela = STOP", () => {
  const now = T0 + 30 * MIN;
  assert.equal(resolveCounterfactual({ ...base, nowMs: now, candles: [c(1, 100.4, 99.8), c(2, 101.2, 100.2)] }).status, "TARGET");
  assert.equal(resolveCounterfactual({ ...base, nowMs: now, candles: [c(1, 100.4, 98.9), c(2, 101.5, 100)] }).status, "STOP");
  const mesma = resolveCounterfactual({ ...base, nowMs: now, candles: [c(1, 101.5, 98.5)] });
  assert.equal(mesma.status, "STOP");
  assert.match(mesma.note, /mesma vela/);
});

check("desfecho SHORT é o espelho do LONG", () => {
  const sh = { side: "SHORT" as const, entryPrice: 100, stopPrice: 101, targetPrice: 99, decidedAtMs: T0, nowMs: T0 + 30 * MIN };
  assert.equal(resolveCounterfactual({ ...sh, candles: [c(1, 100.3, 98.8)] }).status, "TARGET");
  assert.equal(resolveCounterfactual({ ...sh, candles: [c(1, 101.2, 99.9)] }).status, "STOP");
});

check("desfecho: a vela em curso na hora da decisão NÃO conta", () => {
  // vela aberta 1 min ANTES da decisão tinha preço de antes dela: não pode decidir nada
  const r = resolveCounterfactual({ ...base, nowMs: T0 + 30 * MIN, candles: [c(-1, 105, 90), c(1, 100.5, 99.5)] });
  assert.notEqual(r.status, "TARGET");
  assert.notEqual(r.status, "STOP");
});

check("desfecho: mede máximo a favor e contra, e expira depois do horizonte", () => {
  const r = resolveCounterfactual({ ...base, nowMs: T0 + 61 * MIN, candles: [c(1, 100.6, 99.7), c(2, 100.4, 99.5)] });
  assert.equal(r.status, "EXPIRED");
  assert.equal(r.maxFavorablePct, 0.6);
  assert.equal(r.maxAdversePct, 0.5);
});

check("desfecho: ainda em andamento fica PENDING; sem velas nunca inventa", () => {
  assert.equal(resolveCounterfactual({ ...base, nowMs: T0 + 20 * MIN, candles: [c(1, 100.2, 99.8)] }).status, "PENDING");
  assert.equal(resolveCounterfactual({ ...base, nowMs: T0 + 1 * MIN, candles: [] }).status, "PENDING"); // cedo demais
  assert.equal(resolveCounterfactual({ ...base, nowMs: T0 + 70 * MIN, candles: [] }).status, "NO_DATA");
  // velas que só começam 40 min depois: o começo da janela se perdeu
  assert.equal(resolveCounterfactual({ ...base, nowMs: T0 + 70 * MIN, candles: [c(40, 105, 90)] }).status, "NO_DATA");
});

check("desfecho: proposta incoerente (stop do lado errado) = NO_DATA", () => {
  assert.equal(resolveCounterfactual({ ...base, stopPrice: 101, nowMs: T0 + 30 * MIN, candles: [c(1, 102, 99)] }).status, "NO_DATA");
  assert.equal(resolveCounterfactual({ ...base, entryPrice: NaN, nowMs: T0 + 30 * MIN, candles: [c(1, 102, 99)] }).status, "NO_DATA");
});

check("placar: acerta quem apoiou e deu alvo, ou foi contra e deu stop; ignora o resto", () => {
  const rows = [
    { stances: { A: true, B: false }, outcome: "TARGET" as const }, // A acertou, B errou (vetou ganho)
    { stances: { A: true, B: false }, outcome: "STOP" as const }, // A errou (apoiou perda), B acertou
    { stances: { A: false, B: false }, outcome: "STOP" as const }, // os dois acertaram
    { stances: { A: true, B: true }, outcome: "EXPIRED" as const }, // não conta
    { stances: { A: true, B: true }, outcome: "PENDING" as const }, // não conta
  ];
  const [first, second] = scoreAgents(rows);
  const a = scoreAgents(rows).find((x) => x.agent === "A")!;
  const b = scoreAgents(rows).find((x) => x.agent === "B")!;
  assert.deepEqual([a.n, a.hits, a.backedAndLost, a.vetoedAndWouldHaveWon], [3, 2, 1, 0]);
  assert.deepEqual([b.n, b.hits, b.backedAndLost, b.vetoedAndWouldHaveWon], [3, 2, 0, 1]);
  assert.equal(a.hitPct, 66.7);
  assert.ok(first && second);
});

check("intervalo de confiança: com amostra pequena é largo (não vende ruído como habilidade)", () => {
  assert.equal(wilsonInterval(0, 0), null);
  const pequeno = wilsonInterval(6, 10)!; // 60% de 10
  assert.ok(pequeno.high - pequeno.low > 40, JSON.stringify(pequeno));
  const grande = wilsonInterval(600, 1000)!;
  assert.ok(grande.high - grande.low < 8, JSON.stringify(grande));
  assert.ok(grande.low < 60 && grande.high > 60);
});

console.log(`\n${passed} testes passaram.`);
