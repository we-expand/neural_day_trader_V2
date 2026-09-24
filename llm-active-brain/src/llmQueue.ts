// 🔴 2026-09-23: fila/mutex do LLM (ver watcher.ts). O Ollama local roda com
// `-np 1` (1 slot) -- duas chamadas concorrentes se enfileiram la dentro e
// estouram timeout. Aqui a exclusao mutua e feita ANTES, no proprio motor:
// so um runAgent por vez (ciclo geral OU analise focada de gatilho). Gatilhos
// tem prioridade: um ciclo geral em andamento cede a vez entre iteracoes
// (ver agent.ts) em vez de segurar o slot por minutos.
export interface WatcherTrigger {
  symbol: string;
  trigger: string;
  direction: "UP" | "DOWN";
  price: number;
  at: number;
}

const queue = new Map<string, WatcherTrigger>(); // 1 por simbolo: o mais recente vence
let chain: Promise<unknown> = Promise.resolve();

export function enqueueTrigger(t: WatcherTrigger): void {
  queue.set(t.symbol, t);
}
export function hasPendingTrigger(): boolean {
  return queue.size > 0;
}
export function takeTrigger(): WatcherTrigger | undefined {
  const first = queue.values().next();
  if (first.done) return undefined;
  queue.delete(first.value.symbol);
  return first.value;
}

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
