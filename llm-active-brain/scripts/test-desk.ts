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
  type MacdLike,
  type StochLike,
} from "../src/deskReadings.js";

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

console.log(`\n${passed} testes passaram.`);
