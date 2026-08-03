#!/usr/bin/env node
/**
 * 🔍 AUDITORIA DE CONTRACT_SPECS AUSENTES/DESALINHADOS
 *
 * Achado real (2026-08-03): SPX500 (nome unificado em assetDatabase.ts) não
 * bate com nenhuma chave de src/config/infinoxContractSpecs.ts (lá é
 * 'US500') — getContractSpec() cai no fallback genérico (tickSize 0.00001,
 * formato forex de 5 casas), gerando P&L ~20x maior que o real pra um índice.
 * Mesma classe de bug já encontrada e corrigida pra ~29 símbolos cripto nesta
 * sessão — este script varre TODO o catálogo (não só cripto) pra achar todo
 * símbolo que sofre do mesmo problema, em vez de descobrir um por um testando
 * na mão (pedido explícito do Cleber: "não dá pra ter que entrar em ativo por
 * ativo pra ver que está errado").
 *
 * Replica em JS puro a mesma lógica de normalização + fuzzy match de
 * getContractSpec() (src/config/contractSpecs.ts) sem precisar de bundler/
 * ts-node — mesmo padrão de scripts/audit-broker-symbols.mjs (parsing por
 * regex do arquivo fonte, não import real).
 *
 * Uso:
 *   node scripts/audit-contract-specs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function extractAssets() {
  const dbPath = path.join(ROOT, 'src/app/config/assetDatabase.ts');
  const content = fs.readFileSync(dbPath, 'utf8');
  const assets = [];
  const re = /\{\s*symbol:\s*'([^']+)',\s*name:\s*'([^']*)',\s*category:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    assets.push({ symbol: m[1], name: m[2], category: m[3] });
  }
  return assets;
}

function extractSpecKeys() {
  const specPath = path.join(ROOT, 'src/config/infinoxContractSpecs.ts');
  const content = fs.readFileSync(specPath, 'utf8');
  // Só as chaves de nível 1 do objeto CONTRACT_SPECS (aspas simples no início
  // da linha, com recuo de 2 espaços) — evita capturar strings dentro de
  // comentários ou de outros objetos auxiliares (CRYPTO_STANDARD etc.).
  return [...content.matchAll(/^\s{2}'([A-Z0-9]+)':\s*\{/gm)].map(m => m[1]);
}

function normalize(symbol) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Réplica exata da lógica de getContractSpec (src/config/contractSpecs.ts):
// 1. busca exata; 2. fuzzy (normalizedSymbol.includes(key) || key.includes(normalizedSymbol)).
function resolveSpec(symbol, specKeys) {
  const normalized = normalize(symbol);
  if (specKeys.includes(normalized)) return { match: normalized, kind: 'exact' };
  const fuzzy = specKeys.find((key) => normalized.includes(key) || key.includes(normalized));
  if (fuzzy) return { match: fuzzy, kind: 'fuzzy' };
  return { match: null, kind: 'fallback_generico' };
}

function main() {
  const assets = extractAssets();
  const specKeys = extractSpecKeys();

  console.error(`${assets.length} ativos em assetDatabase.ts, ${specKeys.length} chaves em CONTRACT_SPECS.\n`);

  const broken = [];
  const fuzzyMatches = [];

  for (const asset of assets) {
    const result = resolveSpec(asset.symbol, specKeys);
    if (result.kind === 'fallback_generico') {
      broken.push(asset);
    } else if (result.kind === 'fuzzy') {
      fuzzyMatches.push({ ...asset, matchedKey: result.match });
    }
  }

  console.log(`═══ SEM SPEC NENHUMA — cai no fallback genérico forex (${broken.length}) ═══`);
  console.log('(P&L sempre errado nestes: tickSize 0.00001 aplicado a qualquer escala de preço)\n');
  const byCategory = {};
  for (const a of broken) {
    byCategory[a.category] = byCategory[a.category] || [];
    byCategory[a.category].push(a);
  }
  for (const [category, list] of Object.entries(byCategory).sort()) {
    console.log(`  ${category} (${list.length}):`);
    for (const a of list) console.log(`    ${a.symbol.padEnd(14)} ${a.name}`);
  }

  console.log(`\n═══ MATCH POR FUZZY — pode estar pegando spec do ativo errado (${fuzzyMatches.length}) ═══`);
  console.log('(vale conferir manualmente se o fuzzy match faz sentido)\n');
  for (const a of fuzzyMatches) {
    console.log(`    ${a.symbol.padEnd(14)} -> '${a.matchedKey}'  (${a.category}, ${a.name})`);
  }

  console.log(`\nResumo: ${broken.length} sem spec, ${fuzzyMatches.length} via fuzzy, ${assets.length - broken.length - fuzzyMatches.length} com match exato.`);
}

main();
