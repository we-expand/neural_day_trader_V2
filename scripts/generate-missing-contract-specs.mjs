#!/usr/bin/env node
/**
 * Gera as entradas de CONTRACT_SPECS que faltam (achado do audit-contract-
 * specs.mjs, 2026-08-03: 336 de 475 ativos do catálogo caem no fallback
 * genérico forex ou num fuzzy match perigoso — ex. ações batendo em specs de
 * forex/cripto só por coincidência de substring, como 'GE' -> 'GER40' ou 'F'
 * -> 'USDCHF'). Gera código TS pronto pra colar em
 * src/config/infinoxContractSpecs.ts, não edita o arquivo sozinho — revisão
 * manual antes de aplicar.
 *
 * Estratégia, em ordem de prioridade:
 * 1. Alias pra spec REAL já existente sob outro nome (ex. WHEUSD ==
 *    WHEATUSD, JP225 == JPN225) — zero número novo inventado.
 * 2. Padrão de categoria já estabelecido no próprio arquivo (STOCK_STANDARD,
 *    INDICES_US/EU, BOND_US, FOREX_EXOTIC, METAL_GOLD, COMMODITY_STANDARD)
 *    — aproximação de categoria, não tick calibrado por símbolo, sinalizado
 *    explicitamente no comentário de cada bloco gerado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function extractAssets() {
  const content = fs.readFileSync(path.join(ROOT, 'src/app/config/assetDatabase.ts'), 'utf8');
  const assets = [];
  const re = /\{\s*symbol:\s*'([^']+)',\s*name:\s*'([^']*)',\s*category:\s*'([^']*)',\s*subCategory:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    assets.push({ symbol: m[1], name: m[2], category: m[3], subCategory: m[4] });
  }
  return assets;
}

function extractSpecKeys() {
  const content = fs.readFileSync(path.join(ROOT, 'src/config/infinoxContractSpecs.ts'), 'utf8');
  return [...content.matchAll(/^\s{2}'([A-Z0-9]+)':\s*\{/gm)].map((m) => m[1]);
}

function normalize(symbol) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function resolveSpec(symbol, specKeys) {
  const normalized = normalize(symbol);
  if (specKeys.includes(normalized)) return 'exact';
  const fuzzy = specKeys.find((key) => normalized.includes(key) || key.includes(normalized));
  return fuzzy ? 'fuzzy' : 'fallback';
}

// Alias pra spec real já existente sob outro nome (achado do audit) — valores
// copiados literalmente da entrada original (não é seguro fazer spread de uma
// chave de dentro do próprio objeto que está sendo construído).
const REAL_ALIASES = {
  WHEUSD: { copyOf: 'WHEATUSD', spread: 'COMMODITY_STANDARD', category: 'COMMODITIES', description: 'Wheat' },
  SOYUSD: { copyOf: 'SOYBEANUSD', spread: 'COMMODITY_STANDARD', category: 'COMMODITIES', description: 'Soybeans' },
  COFUSD: { copyOf: 'COFFEEUSD', literal: "tickSize: 0.05, tickValue: 18.75, pointValue: 375, contractSize: 37500, currency: 'USD', minLotSize: 0.1", category: 'COMMODITIES', description: 'Coffee' },
  SUGUSD: { copyOf: 'SUGARUSD', literal: "tickSize: 0.01, tickValue: 11.20, pointValue: 1120, contractSize: 112000, currency: 'USD', minLotSize: 0.1", category: 'COMMODITIES', description: 'Sugar' },
  COTUSD: { copyOf: 'COTTONUSD', literal: "tickSize: 0.01, tickValue: 5, pointValue: 500, contractSize: 50000, currency: 'USD', minLotSize: 0.1", category: 'COMMODITIES', description: 'Cotton' },
  COCUSD: { copyOf: 'COCOAUSD', literal: "tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 10, currency: 'USD', minLotSize: 1", category: 'COMMODITIES', description: 'Cocoa' },
  JP225: { copyOf: 'JPN225', literal: "tickSize: 1, tickValue: 5, pointValue: 5, contractSize: 1, currency: 'JPY', minLotSize: 0.1", category: 'INDICES', description: 'Nikkei 225 (Japan)' },
  CHINA50: { copyOf: 'CN50', literal: "tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'CNY', minLotSize: 0.1", category: 'INDICES', description: 'FTSE China A50' },
};

const STOCK_SUBCATEGORY_CURRENCY = {
  'UK Stocks': { currency: 'GBP', category: 'STOCKS_UK' },
  'US Stocks': { currency: 'USD', category: 'STOCKS_US' },
  'French Stocks': { currency: 'EUR', category: 'STOCKS_EU' },
  'German Stocks': { currency: 'EUR', category: 'STOCKS_EU' },
  'Dutch Stocks': { currency: 'EUR', category: 'STOCKS_EU' },
  'Portuguese Stocks': { currency: 'EUR', category: 'STOCKS_EU' },
  'Spanish Stocks': { currency: 'EUR', category: 'STOCKS_EU' },
};

function main() {
  const assets = extractAssets();
  const specKeys = extractSpecKeys();
  const toFix = assets.filter((a) => resolveSpec(a.symbol, specKeys) !== 'exact');

  const lines = [];
  lines.push('  // ═══════════════════════════════════════════════════════════');
  lines.push(`  // ⚠️ BLOCO GERADO EM LOTE (2026-08-03) — ${toFix.length} símbolos que caíam`);
  lines.push('  // no fallback genérico forex OU num fuzzy match perigoso (ex. ações');
  lines.push("  // batendo em specs de forex/cripto por coincidência de substring —");
  lines.push("  // 'GE' -> 'GER40', 'F' -> 'USDCHF', 'LIN' -> 'LINKUSD', etc., achado real");
  lines.push('  // via scripts/audit-contract-specs.mjs). Onde a spec real já existia sob');
  lines.push('  // outro nome (comentado "alias real"), copiada 1:1 — zero número novo.');
  lines.push('  // Onde não existia, aplicado o padrão de CATEGORIA já usado neste arquivo');
  lines.push('  // pros ativos vizinhos (comentado "aprox. categoria") — não é tick real');
  lines.push('  // calibrado por símbolo, é melhor que o fallback forex quebrado que');
  lines.push('  // aplicava 5 casas decimais a preço de ação/índice/commodity.');
  lines.push('  // ═══════════════════════════════════════════════════════════');

  const missingAliasTargets = [];

  for (const asset of toFix) {
    const key = normalize(asset.symbol);
    const alias = REAL_ALIASES[asset.symbol];

    if (alias) {
      if (!specKeys.includes(alias.copyOf)) missingAliasTargets.push(alias.copyOf);
      const body = alias.spread ? `...${alias.spread}` : alias.literal;
      lines.push(`  '${key}': { ${body}, category: '${alias.category}', description: '${alias.description}' }, // = mesmos valores de '${alias.copyOf}' (nome diferente pro mesmo instrumento)`);
      continue;
    }

    if (asset.category === 'STOCKS') {
      const meta = STOCK_SUBCATEGORY_CURRENCY[asset.subCategory];
      if (meta) {
        lines.push(`  '${key}': { ...STOCK_STANDARD, currency: '${meta.currency}', category: '${meta.category}', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria`);
        continue;
      }
    }

    if (asset.category === 'INDICES') {
      lines.push(`  '${key}': { ...INDICES_US, category: 'INDICES', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria (INDICES_US genérico)`);
      continue;
    }

    if (asset.category === 'BONDS') {
      lines.push(`  '${key}': { ...BOND_US, category: 'BONDS', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria (BOND_US genérico)`);
      continue;
    }

    if (asset.category === 'FOREX') {
      lines.push(`  '${key}': { ...FOREX_EXOTIC, category: 'FOREX', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria (par exótico)`);
      continue;
    }

    if (asset.category === 'COMMODITIES') {
      if (asset.symbol.startsWith('XAU') || asset.symbol.startsWith('GAU') || asset.symbol === 'GOLDFT') {
        lines.push(`  '${key}': { ...METAL_GOLD, category: 'METALS', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria (variante de ouro)`);
      } else {
        lines.push(`  '${key}': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: '${asset.name.replace(/'/g, "\\'")}' }, // aprox. categoria (genérico, sem match melhor)`);
      }
      continue;
    }

    lines.push(`  // ⚠️ SEM REGRA: '${key}' (${asset.category}/${asset.subCategory}) — revisar manualmente`);
  }

  console.log(lines.join('\n'));
  console.error(`\n${toFix.length} entradas geradas. Aliases apontando pra chave que também precisa existir: ${[...new Set(missingAliasTargets)].join(', ') || '(nenhum)'}`);
}

main();
