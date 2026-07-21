#!/usr/bin/env node
/**
 * 🔍 AUDITORIA DE VARIAÇÃO DIÁRIA ZERADA
 *
 * Testa TODOS os ativos do catálogo canônico contra /mt5-prices e reporta
 * quais têm PREÇO real (price > 0) mas variação (changePercent) travada em
 * exatamente 0 — sintoma do candle D1 de referência falhando (rate-limit,
 * buraco na série, símbolo sem histórico), mesmo bug já documentado pra
 * VIX/UKOUSD/HKG33/BVSPX/CHINA50.
 *
 * Roda 2 passadas espaçadas: um zero pode ser transitório (rate-limit),
 * só reporta como suspeito o que ficou zerado nas DUAS passadas.
 *
 * Uso:
 *   node scripts/audit-zero-variation.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SUPABASE_PROJECT_ID = 'wyvdsxtcmizettljxtbg';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmRzeHRjbWl6ZXR0bGp4dGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1ODkzOTYsImV4cCI6MjA4MjE2NTM5Nn0.tYX5fBwz0LKa8Umak1MB9SBp_sIQ4Df_31H6GyI9eo4';
const MT5_PRICES_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/server/mt5-prices`;
const CHUNK_SIZE = 20;
const DELAY_BETWEEN_CHUNKS_MS = 2500;

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

async function runPass(symbols, passLabel) {
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const zeroed = new Set();
  const withData = new Set();

  for (let i = 0; i < chunks.length; i++) {
    console.error(`  [${passLabel}] lote ${i + 1}/${chunks.length}...`);
    const result = await postBatch(chunks[i]);
    const prices = Array.isArray(result?.prices) ? result.prices : [];
    for (const p of prices) {
      if (typeof p.price === 'number' && p.price > 0) {
        withData.add(p.symbol);
        if (p.changePercent === 0 && p.change === 0) {
          zeroed.add(p.symbol);
        }
      }
    }
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
    }
  }
  return { zeroed, withData };
}

async function main() {
  const argSymbols = process.argv[2];
  const symbols = argSymbols
    ? argSymbols.split(',').map(s => s.trim())
    : [...new Set(extractCanonicalSymbols())];

  console.error(`Auditando variação zerada em ${symbols.length} símbolo(s), 2 passadas...`);

  const pass1 = await runPass(symbols, 'passada 1');
  console.error(`  aguardando 20s antes da 2ª passada (evita julgar rate-limit transitório como bug)...`);
  await new Promise(resolve => setTimeout(resolve, 20000));
  const pass2 = await runPass(symbols, 'passada 2');

  const confirmedZero = [...pass1.zeroed].filter(s => pass2.zeroed.has(s));
  const onlyPass1 = [...pass1.zeroed].filter(s => !pass2.zeroed.has(s));
  const onlyPass2 = [...pass2.zeroed].filter(s => !pass1.zeroed.has(s));

  console.log('\n=== RELATÓRIO: VARIAÇÃO ZERADA ===');
  console.log(`Símbolos com preço real em pelo menos 1 passada: ${new Set([...pass1.withData, ...pass2.withData]).size}`);
  console.log(`\n🔴 ZERADO NAS DUAS PASSADAS (suspeito real, não é rate-limit pontual): ${confirmedZero.length}`);
  console.log(confirmedZero.sort().join(', ') || '(nenhum)');
  console.log(`\n🟡 zerado só na passada 1 (provável transitório): ${onlyPass1.length}`);
  console.log(onlyPass1.sort().join(', ') || '(nenhum)');
  console.log(`\n🟡 zerado só na passada 2 (provável transitório): ${onlyPass2.length}`);
  console.log(onlyPass2.sort().join(', ') || '(nenhum)');
}

main();
