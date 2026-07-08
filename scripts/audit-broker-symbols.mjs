#!/usr/bin/env node
/**
 * 🔍 AUDITORIA DE SÍMBOLOS POR CORRETORA
 *
 * Testa TODOS os ativos do catálogo canônico (`src/app/config/assetDatabase.ts`)
 * direto contra a rota real `/mt5-prices` (que fala com a MetaAPI/corretora de
 * plataforma), em lotes, e imprime um relatório: quais símbolos funcionam com o
 * nome unificado, quais dão 404 (indisponível ou nome errado).
 *
 * Por que isso existe: antes desta ferramenta, cada bug de "ativo errado" era
 * caçado um a um, testando símbolo por símbolo manualmente com curl. Essa
 * investigação sempre vai se repetir (novos ativos adicionados, nova corretora
 * integrada, corretora muda nomenclatura) — rode este script em vez de testar
 * na mão, e atualize `src/app/config/brokerRegistry.ts` com o resultado:
 * - símbolo funciona com nome diferente do unificado -> `SYMBOL_OVERRIDES`
 * - símbolo dá 404 -> `UNAVAILABLE`
 *
 * Uso:
 *   node scripts/audit-broker-symbols.mjs
 *   node scripts/audit-broker-symbols.mjs XAUUSD,XPTUSD,COFUSD   # símbolos específicos
 *
 * Nota de segurança operacional: a conta MetaAPI é compartilhada entre todos os
 * usuários da plataforma. Este script já bate em lotes pequenos (40 símbolos)
 * com pausa entre eles — não reduza o tamanho do lote nem a pausa sem motivo,
 * chamadas em rajada já degradaram a conta compartilhada em sessões anteriores.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SUPABASE_PROJECT_ID = 'wyvdsxtcmizettljxtbg';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmRzeHRjbWl6ZXR0bGp4dGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1ODkzOTYsImV4cCI6MjA4MjE2NTM5Nn0.tYX5fBwz0LKa8Umak1MB9SBp_sIQ4Df_31H6GyI9eo4';
const MT5_PRICES_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/server/mt5-prices`;
const CHUNK_SIZE = 40;
const DELAY_BETWEEN_CHUNKS_MS = 1500;

function extractCanonicalSymbols() {
  const dbPath = path.join(ROOT, 'src/app/config/assetDatabase.ts');
  const content = fs.readFileSync(dbPath, 'utf8');
  return [...content.matchAll(/symbol:\s*'([^']+)'/g)].map(m => m[1]);
}

async function postBatch(symbols) {
  try {
    const res = await fetch(MT5_PRICES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbols }),
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const argSymbols = process.argv[2];
  const symbols = argSymbols
    ? argSymbols.split(',').map(s => s.trim())
    : [...new Set(extractCanonicalSymbols())];

  console.error(`Auditando ${symbols.length} símbolo(s) contra /mt5-prices em lotes de ${CHUNK_SIZE}...`);

  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const ok = [];
  const bad = [];

  for (let i = 0; i < chunks.length; i++) {
    console.error(`  lote ${i + 1}/${chunks.length}...`);
    const result = await postBatch(chunks[i]);
    const prices = Array.isArray(result?.prices) ? result.prices : [];
    const pricesBySymbol = new Map(prices.map(p => [p.symbol, p]));

    for (const symbol of chunks[i]) {
      const price = pricesBySymbol.get(symbol);
      if (price && typeof price.price === 'number' && price.price > 0) {
        ok.push(symbol);
      } else {
        bad.push(symbol);
      }
    }

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
    }
  }

  console.log('\n=== RELATÓRIO ===');
  console.log(`OK (nome unificado funciona direto): ${ok.length}`);
  console.log(`SEM RESPOSTA (404/indisponível ou precisa de nome diferente): ${bad.length}\n`);
  console.log('--- Símbolos SEM resposta (investigar manualmente com curl se precisar) ---');
  console.log(bad.join(', '));
  console.log('\nPróximo passo: pra cada um dos símbolos acima, ou (a) adicionar em');
  console.log('`UNAVAILABLE` no brokerRegistry.ts se a corretora genuinamente não oferece,');
  console.log('ou (b) descobrir o nome real (testar variações via curl) e adicionar em');
  console.log('`SYMBOL_OVERRIDES`.');
}

main();
