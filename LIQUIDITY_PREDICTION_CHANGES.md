# MODIFICAÇÕES NECESSÁRIAS - LIQUIDITY PREDICTION

## 1. REMOVER "AO VIVO" (linha 771-777)

**ANTES:**
```tsx
<div className="flex flex-col items-end hidden md:flex">
  <span className="text-xs text-neutral-500 uppercase tracking-wider">Status</span>
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
    <span className="text-xs font-mono text-green-400">AO VIVO</span>
  </div>
</div>
```

**DEPOIS:**
```tsx
<div className="flex items-center gap-2">
  <button 
    onClick={() => setAiEnabled(!aiEnabled)}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${aiEnabled ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30' : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30'}`}
  >
    <Brain className="w-4 h-4" />
    <span>AI {aiEnabled ? 'ON' : 'OFF'}</span>
    {aiEnabled && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
  </button>
</div>
```

## 2. COMPLETAR MATRIZ DE CORRELAÇÃO (linha 886-928)

**ADICIONAR CORRELAÇÕES DINÂMICAS PARA TODOS OS ATIVOS**

Substituir as correlações hardcoded por dinâmicas baseadas no ativo selecionado.

## 3. ADICIONAR "FORÇA RELATIVA" AO LADO DA MATRIZ

Criar um novo painel ao lado da Matriz de Correlação que mostra força relativa dos ativos relacionados.

---

**STATUS:** Pendente implementação manual
