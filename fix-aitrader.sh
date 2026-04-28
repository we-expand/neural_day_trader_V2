#!/bin/bash
# Script para corrigir o arquivo AITrader.tsx
# Remove as linhas corrompidas 457-459 e 513-529

SOURCE="/src/app/components/AITrader.tsx"
TEMP="/tmp/aitrader_fixed.tsx"
BACKUP="/src/app/components/AITrader.tsx.backup"

echo "🔧 Corrigindo AITrader.tsx..."

# Backup
cp "$SOURCE" "$BACKUP"
echo "✅ Backup criado: $BACKUP"

# Remover linhas corrompidas
# Linhas 1-456: OK
# Linhas 457-459: CORRUPTAS (remover)
# Linhas 460-512: OK  
# Linhas 513-529: DUPLICADAS (remover)
# Linhas 530+: OK

# Extrair partes boas
head -456 "$SOURCE" > "$TEMP"
tail -n +460 "$SOURCE" | head -53 >> "$TEMP" 
tail -n +530 "$SOURCE" >> "$TEMP"

# Substituir arquivo original
mv "$TEMP" "$SOURCE"

echo "✨ Arquivo corrigido!"
echo "📊 Nova contagem de linhas:"
wc -l "$SOURCE"
