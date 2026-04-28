#!/usr/bin/env node

/**
 * 📊 ANÁLISE DE TAMANHO DO PROJETO
 * 
 * Identifica arquivos e componentes mais pesados
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const fileSizes = [];

// Função para obter tamanho de arquivo
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

// Função recursiva para escanear diretório
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const size = getFileSize(filePath);
      const relativePath = path.relative(srcDir, filePath);
      fileSizes.push({ path: relativePath, size });
    }
  });
}

// Formatar bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Executar análise
console.log('🔍 Analisando projeto...\n');
scanDirectory(srcDir);

// Ordenar por tamanho (maior primeiro)
fileSizes.sort((a, b) => b.size - a.size);

// Top 20 maiores arquivos
console.log('📦 TOP 20 ARQUIVOS MAIS PESADOS:\n');
console.log('─'.repeat(80));
fileSizes.slice(0, 20).forEach((file, index) => {
  const sizeStr = formatBytes(file.size).padStart(10);
  console.log(`${(index + 1).toString().padStart(2)}. ${sizeStr}  ${file.path}`);
});
console.log('─'.repeat(80));

// Estatísticas gerais
const totalSize = fileSizes.reduce((sum, file) => sum + file.size, 0);
const totalFiles = fileSizes.length;
const avgSize = totalSize / totalFiles;

console.log('\n📊 ESTATÍSTICAS GERAIS:\n');
console.log(`Total de arquivos: ${totalFiles}`);
console.log(`Tamanho total: ${formatBytes(totalSize)}`);
console.log(`Tamanho médio: ${formatBytes(avgSize)}`);

// Componentes por diretório
const dirSizes = {};
fileSizes.forEach(file => {
  const dir = file.path.split('/')[0] || 'root';
  if (!dirSizes[dir]) {
    dirSizes[dir] = { size: 0, count: 0 };
  }
  dirSizes[dir].size += file.size;
  dirSizes[dir].count += 1;
});

console.log('\n📁 TAMANHO POR DIRETÓRIO:\n');
console.log('─'.repeat(80));
Object.entries(dirSizes)
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 10)
  .forEach(([dir, data]) => {
    const sizeStr = formatBytes(data.size).padStart(10);
    const countStr = data.count.toString().padStart(3);
    console.log(`${sizeStr}  (${countStr} arquivos)  ${dir}/`);
  });
console.log('─'.repeat(80));

// Recomendações
console.log('\n💡 RECOMENDAÇÕES:\n');
const largeFiles = fileSizes.filter(f => f.size > 50000); // >50KB
if (largeFiles.length > 0) {
  console.log(`⚠️  ${largeFiles.length} arquivos maiores que 50KB encontrados`);
  console.log('   Considere aplicar lazy loading nestes componentes:');
  largeFiles.slice(0, 5).forEach(file => {
    console.log(`   - ${file.path}`);
  });
}

console.log('\n✅ Use lazy loading para componentes grandes');
console.log('✅ Divida componentes >100KB em partes menores');
console.log('✅ Remova imports não utilizados');
console.log('✅ Memoize componentes pesados com React.memo()');

console.log('\n📖 Para mais detalhes, leia: /OPTIMIZATION_GUIDE.md\n');
