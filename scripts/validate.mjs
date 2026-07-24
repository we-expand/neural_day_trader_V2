#!/usr/bin/env node
/**
 * Gate de validação do motor de decisão — rode ANTES de todo commit que toque
 * indicadores, Market Score, estratégia ou risco:
 *
 *     npm run validate
 *
 * Por que isso existe: os validadores determinísticos deste projeto (indicadores
 * técnicos, motor SMC) sempre existiram, mas rodavam só quando alguém lembrava,
 * com um comando de esbuild diferente para cada um. Isso já quase deixou passar
 * regressão no motor mais de uma vez (ver CLAUDE.md, sessões de calibração do
 * Market Score). Um único comando, com saída clara e código de saída != 0 em
 * falha, torna esse passo automatizável e difícil de esquecer.
 *
 * O que NÃO está aqui, de propósito: o MarketScoreValidator (walk-forward contra
 * candle real). Ele depende de rede/conta MetaAPI e leva minutos — não pode ser
 * gate de commit. Continua sendo rodado à mão em sessões de calibração, e a nota
 * no fim da saída lembra disso.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUITES = [
  {
    name: 'Indicadores técnicos (RSI, EMA, MACD, Bollinger, ATR, cruzamentos)',
    entry: 'src/app/services/indicators/__validate__.ts',
  },
  {
    name: 'Motor SMC (Order Blocks, FVG, Liquidity Pools, BOS/CHoCH)',
    entry: 'src/app/services/smc/__validate__.ts',
  },
];

const workDir = mkdtempSync(join(tmpdir(), 'ndt-validate-'));
let failures = 0;

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: 'inherit', encoding: 'utf8' });
}

console.log('\n═══ Gate de validação do motor ═══\n');

// 1) Type-check. Pega quebra de contrato entre motor, estratégia e risco antes
//    de qualquer teste de comportamento rodar.
//    Usa o tsc LOCAL do projeto de propósito: `npx tsc` pode resolver pra uma
//    versão global antiga (o projeto rodou por meses com TS 4.9, que rejeitava
//    as próprias opções do tsconfig e reportava erro de configuração em vez de
//    checar tipos — type-check "limpo" que não checava nada).
//    Escopo: tsconfig.engine.json (só o caminho crítico de decisão/risco/execução).
//    O app inteiro carrega ~625 erros de tipo herdados; um gate que sempre falha é
//    um gate que se aprende a ignorar. Aqui o alvo é ZERO, e é mantido em zero.
process.stdout.write('▸ Type-check do motor (tsconfig.engine.json)... ');
try {
  execFileSync('./node_modules/.bin/tsc', ['-p', 'tsconfig.engine.json', '--noEmit'], { encoding: 'utf8', stdio: 'pipe' });
  console.log('OK\n');
} catch (err) {
  console.log('FALHOU\n');
  console.log(err.stdout || err.message);
  failures++;
}

// 2) Suites determinísticas: asserções sobre séries sintéticas com resultado
//    conhecido de antemão (preço constante -> ATR 0, subida pura -> RSI 100...).
for (const suite of SUITES) {
  console.log(`▸ ${suite.name}`);
  const out = join(workDir, `${suite.entry.replace(/[^a-z0-9]/gi, '_')}.mjs`);
  try {
    execFileSync(
      'npx',
      ['esbuild', suite.entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${out}`],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    run('node', [out]);
    console.log('');
  } catch (err) {
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.log(err.stderr);
    console.log('  ↑ FALHOU\n');
    failures++;
  }
}

rmSync(workDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`═══ ${failures} etapa(s) falharam — NÃO comite. ═══\n`);
  process.exit(1);
}

console.log('═══ Tudo passou. ═══');
console.log(
  'Lembrete: mudou peso/limiar do Market Score? Rode também o walk-forward\n' +
  '(MarketScoreValidator) contra candle real antes de aceitar a calibração —\n' +
  'ele não entra neste gate por depender de rede e levar minutos.\n',
);
