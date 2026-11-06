/**
 * Reforco SISTEMATICO no corredor de Fibonacci (pedido do Cleber, 15/10/2026: "se ela esta no corredor, o preco vai
 * ter que bater no degrau -- e hora de carregar").
 *
 * Roda no INICIO de cada ciclo, depois da checagem mecanica de stop/alvo e antes de o LLM decidir. Para cada posicao
 * aberta que esta a favor de um corredor em expansao (degrau livre a frente) e ja andou `MT5_EXPANSION_SPACING_PCT`
 * (padrao 0,15%) a favor do preco medio da posicao, chama o PROPRIO `increase_position` -- ou seja, TODAS as travas dele
 * continuam valendo: lucro real acima do spread, estocastico do timeframe do corredor validando (venda: %K<=%D), stop
 * travado em breakeven-ou-melhor a cada reforco, reforco nunca maior que o lote original, teto de risco por trade, teto de
 * exposicao correlacionada e maximo de MAX_PYRAMID_ADDS reforcos por posicao. Posicao sem stop registrado e recusada.
 *
 * Aviso mantido (nao e promessa): o backtest de 14/10 nao achou vantagem do degrau sobre o acaso (72-84% contra
 * 74-77%). Reforcar aumenta o tamanho exatamente nos ~20-25% das vezes em que o degrau NAO e atingido; o que limita esse
 * custo sao o stop em breakeven a cada reforco e o teto de reforcos. Desliga com MT5_EXPANSION_AUTO_REINFORCE=false.
 */
import { getFibLive } from "./fibLive.js";
import { listMt5OpenPositions, logBrainActivity } from "./neuralBridge.js";
import { executeTool, MAX_PYRAMID_ADDS, type ExecuteToolSession } from "./tools.js";

const num = (v: string | undefined, d: number) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

export async function autoReinforceInExpansion(session: ExecuteToolSession, cycle: number): Promise<string[]> {
  const notes: string[] = [];
  if (process.env.MT5_EXPANSION_LIVE === "false" || process.env.MT5_EXPANSION_AUTO_REINFORCE === "false") return notes;
  const spacing = num(process.env.MT5_EXPANSION_SPACING_PCT, 0.15) / 100;
  let positions;
  try {
    positions = await listMt5OpenPositions(session.sessionId);
  } catch {
    return notes;
  }
  for (const p of positions) {
    if (p.pyramid_adds_count >= MAX_PYRAMID_ADDS || p.stop_loss == null || p.broker_position_id) continue;
    try {
      const fib = await getFibLive(p.symbol);
      const cor = fib?.principal ?? null;
      const aFavor =
        !!cor && cor.emExpansao && !cor.redesenhar && !!cor.proximoDegrau &&
        ((cor.direcao === "BAIXA" && p.side === "SHORT") || (cor.direcao === "ALTA" && p.side === "LONG"));
      if (!cor || !aFavor) continue;
      // cotacao fresca (tambem marca o simbolo como cotado neste ciclo, exigencia do increase_position)
      const q = (await executeTool("get_mt5_quote", { symbol: p.symbol }, cycle, session)) as { price?: number; bid?: number; ask?: number; error?: string };
      const price = p.side === "LONG" ? q.ask : q.bid;
      if (!price || q.error) continue;
      const moved = p.side === "LONG" ? (price - p.entry_price) / p.entry_price : (p.entry_price - price) / p.entry_price;
      if (moved < spacing) continue;
      const reasoning = `REFORCO AUTOMATICO NO CORREDOR (regra do Cleber, 15/10): ${p.symbol} ${p.side} ja andou ${(moved * 100).toFixed(2)}% a favor (gatilho ${(spacing * 100).toFixed(2)}%) dentro do corredor ${cor.tf} de ${cor.direcao} com o proximo degrau ${(cor.proximoDegrau!.ratio * 100).toFixed(1)}% em ${cor.proximoDegrau!.price.toFixed(2)}. Invalidacao: voltar ao 0 do corredor.`;
      const r = (await executeTool("increase_position", { trade_id: p.id, reasoning }, cycle, session)) as { error?: string; add_amount_usd?: number; new_stop_loss?: number; reforcos_usados?: number };
      const note = r.error
        ? `${p.symbol} ${p.side}: reforco automatico NAO aplicado (${r.error.slice(0, 160)})`
        : `${p.symbol} ${p.side}: REFORCO AUTOMATICO aplicado (+$${r.add_amount_usd}, stop agora ${r.new_stop_loss}, reforco ${r.reforcos_usados}/${MAX_PYRAMID_ADDS})`;
      console.log(`[EXPANSAO-AUTO] ${note}`);
      notes.push(note);
      logBrainActivity({ sessionId: session.sessionId, userId: session.userId, cycle, type: "decision", message: `[EXPANSAO-AUTO] ${note}` });
    } catch (err) {
      console.warn(`[EXPANSAO-AUTO] ${p.symbol}: falhou, segue sem reforcar: ${err instanceof Error ? err.message : err}`);
    }
  }
  return notes;
}
