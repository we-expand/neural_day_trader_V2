/**
 * Item (c) do redesenho do cérebro — pergunta "a meta de ~10 trades/dia é
 * realista?" (ver NEXT_SESSION.md). NÃO é busca de edge nova — reusa só o
 * dado JÁ MEDIDO em `2026-08-05-taxa-base/results/taxa_base.json` (mesmo
 * motor de produção, mesmos presets sem alteração, custo real). Mede o que
 * "amplitude" (item 1 do plano de 5 frentes: mais setups × mais ativos, sem
 * afrouxar critério) daria de frequência agregada de portfólio SE o usuário
 * ligasse mais de 1 preset/ativo ao mesmo tempo — hoje o produto só permite
 * 1 preset por vez (ver SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md).
 *
 * Duas leituras, por timeframe:
 *   A) "todos os presets simultâneos" — soma trades/dia de TODOS os 45
 *      combos preset×ativo daquele timeframe (o que rodar tudo ligado daria).
 *   B) "só combos historicamente positivos" — mesma soma, mas só dos combos
 *      com netResultPercent > 0 e amostra mínima de 5 trades. AVISO: isto é
 *      seleção pós-hoc sobre o MESMO histórico usado pra medir (sem holdout,
 *      sem DSR) — não é "portfólio validado", é o teto otimista de quanto
 *      dá pra reunir só com o que já parece bom. Reportado como limite
 *      superior otimista, não como recomendação de portfólio.
 *
 * Uso: npx tsx research/experiments/2026-08-16-portfolio-amplitude/scripts/aggregate.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..', '2026-08-05-taxa-base', 'results', 'taxa_base.json');
const RESULTS_DIR = join(HERE, '..', 'results');

interface Row {
  presetName: string; symbol: string; timeframe: string;
  trades: number; tradesPerDay: number; netResultPercent: number; ok: boolean;
}

const rows: Row[] = JSON.parse(readFileSync(SOURCE, 'utf8')).filter((r: Row) => r.ok);
const timeframes = [...new Set(rows.map(r => r.timeframe))];
const presets = [...new Set(rows.map(r => r.presetName))];

const lines: string[] = [];
lines.push('# Amplitude de portfólio (item c) — quanto de frequência a cesta completa daria');
lines.push('');
lines.push('Reusa `2026-08-05-taxa-base/results/taxa_base.json` (mesmo motor de produção,');
lines.push('mesmos presets, sem alteração, custo real) — não é busca de edge nova, é soma');
lines.push('de trades/dia entre combos já medidos, simulando o que "amplitude" (item 1 do');
lines.push('plano de 5 frentes) daria SE o produto permitisse múltiplos presets/ativos');
lines.push('simultâneos (hoje só permite 1 preset por vez).');
lines.push('');
lines.push('## A) Um preset por vez, soma nos 9 símbolos da cesta — o que dá pra ligar HOJE');
lines.push('');
lines.push('| Preset | TF | Trades/dia (soma 9 símbolos) | Líq total % (soma) |');
lines.push('|---|---|---:|---:|');
for (const tf of timeframes) {
  for (const p of presets) {
    const rs = rows.filter(r => r.timeframe === tf && r.presetName === p);
    if (rs.length === 0) continue;
    const sumTPD = rs.reduce((a, r) => a + r.tradesPerDay, 0);
    const sumNet = rs.reduce((a, r) => a + r.netResultPercent, 0);
    lines.push(`| ${p} | ${tf} | ${sumTPD.toFixed(2)} | ${sumNet.toFixed(1)}% |`);
  }
}

lines.push('');
lines.push('## B) Todos os 5 presets simultâneos (multi-setup hipotético, item 1 não implementado)');
lines.push('');
lines.push('| TF | Combos | Trades/dia (soma) | Líq total % (soma) | Combos negativos |');
lines.push('|---|---:|---:|---:|---:|');
for (const tf of timeframes) {
  const rs = rows.filter(r => r.timeframe === tf);
  const sumTPD = rs.reduce((a, r) => a + r.tradesPerDay, 0);
  const sumNet = rs.reduce((a, r) => a + r.netResultPercent, 0);
  const nNeg = rs.filter(r => r.netResultPercent < 0).length;
  lines.push(`| ${tf} | ${rs.length} | ${sumTPD.toFixed(2)} | ${sumNet.toFixed(1)}% | ${nNeg}/${rs.length} |`);
}

lines.push('');
lines.push('## C) Teto otimista: só combos historicamente positivos (seleção pós-hoc, SEM holdout — não é recomendação de portfólio)');
lines.push('');
lines.push('| TF | Combos positivos (n≥5 trades) | Trades/dia (soma) | Líq total % (soma) |');
lines.push('|---|---:|---:|---:|');
for (const tf of timeframes) {
  const rs = rows.filter(r => r.timeframe === tf && r.netResultPercent > 0 && r.trades >= 5);
  const total = rows.filter(r => r.timeframe === tf).length;
  const sumTPD = rs.reduce((a, r) => a + r.tradesPerDay, 0);
  const sumNet = rs.reduce((a, r) => a + r.netResultPercent, 0);
  lines.push(`| ${tf} | ${rs.length}/${total} | ${sumTPD.toFixed(2)} | ${sumNet.toFixed(1)}% |`);
}

writeFileSync(join(RESULTS_DIR, 'portfolio_amplitude.md'), lines.join('\n') + '\n');
console.log('Gravado: results/portfolio_amplitude.md');
