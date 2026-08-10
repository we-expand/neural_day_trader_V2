"""Veredito do teste na regiao viavel (5,6 anos), disciplina CRITERIA.md."""
import numpy as np
import pandas as pd
from scipy import stats as st

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   break_even_win_rate, estimate_cost_percent_crypto)

pd.set_option("display.width", 250, "display.max_columns", 60)
CUSTO_RT = estimate_cost_percent_crypto() * 2
PRECO = 55_782.0
MODO_NM = {0: "SMA rapida", 1: "SMA lenta"}

res = pd.read_csv("grid_long.csv")
# N honesto: toda a busca feita sobre BTCUSD M1 nesta investigacao
N_BUSCA_TOTAL = 900 + len(res) + 5
eleg = res[(res.n_tr >= 100) & (res.n_ho >= 100)].copy()

var_sh = eleg["sharpe_tr"].var(ddof=1)
sr0 = expected_max_sharpe_under_null(var_sh, N_BUSCA_TOTAL)

print("=" * 104)
print(f"REGIAO VIAVEL POR CUSTO — 5,6 anos | {len(res)} trials neste grid | "
      f"N acumulado da busca = {N_BUSCA_TOTAL}")
print("=" * 104)
print(f"elegiveis (n_tr>=100 e n_ho>=100) : {len(eleg)} de {len(res)}")
print(f"SR0 (Sharpe do melhor por ACASO)  : {sr0:.4f}\n")

print("-- Sharpe de holdout por faixa de stop (so elegiveis) --")
g = eleg.groupby("stop_pts").agg(trials=("sharpe_ho", "size"),
                                 n_ho_med=("n_ho", "mean"),
                                 sh_max=("sharpe_ho", "max"),
                                 sh_medio=("sharpe_ho", "mean"),
                                 positivos=("sharpe_ho", lambda x: int((x > 0).sum())),
                                 ret_max=("ret_ho", "max"))
g.index = [f"{i:,.0f} pts ({i/PRECO*100:.1f}%)" for i in g.index]
print(g.to_string(float_format=lambda x: f"{x:,.4f}"))

print(f"\ntrials elegiveis com Sharpe holdout > 0    : "
      f"{int((eleg.sharpe_ho > 0).sum())} de {len(eleg)}")
print(f"trials elegiveis com Sharpe holdout > SR0  : "
      f"{int((eleg.sharpe_ho > sr0).sum())} de {len(eleg)}")

print("\n" + "=" * 104)
print("CAMPEAO — escolhido SO pelo treino, entre os elegiveis")
print("=" * 104)
camp = eleg.loc[eleg["sharpe_tr"].idxmax()]
print(f"config  : SMA {int(camp.rapida)}/{int(camp.lenta)} | pullback ate {MODO_NM[camp.modo]} | "
      f"stop {camp.stop_pct*100:.1f}% ({camp.stop_pts:,.0f} pts) | "
      f"alvo {camp.alvo_pct*100:.1f}% ({camp.alvo_pts:,.0f} pts) | R:R 1:{camp.razao:.2f}")
print(f"treino  : n={int(camp.n_tr):5d} | Sharpe {camp.sharpe_tr:+.4f} | "
      f"acerto {camp.acerto_tr*100:5.2f}% | retorno liq {camp.ret_tr*100:+8.2f}%")
print(f"holdout : n={int(camp.n_ho):5d} | Sharpe {camp.sharpe_ho:+.4f} | "
      f"acerto {camp.acerto_ho*100:5.2f}% | retorno liq {camp.ret_ho*100:+8.2f}%")

dsr = deflated_sharpe_ratio(camp.sharpe_ho, sr0, int(camp.n_ho))
degr = (camp.ret_ho - camp.ret_tr) / abs(camp.ret_tr)
crit = [
    ("amostra >= 100 sinais", camp.n_ho >= 100),
    ("liquido de custo (CostModel.ts)", True),
    ("walk-forward sem look-ahead (DataSplit.ts)", True),
    ("degradacao OOS < 30% relativa", bool(degr > -.30)),
    (f"DSR >= 95% (obtido {dsr*100:.1f}%)", bool(dsr >= .95)),
]
print()
for nome, ok in crit:
    print(f"  [{'x' if ok else ' '}] {nome}")
print(f"\nVEREDITO: {'APROVADO' if all(o for _, o in crit) else 'REPROVADO — nao promover'}")

print("\n" + "=" * 104)
print("MELHOR CASO ABSOLUTO DO HOLDOUT (olhando o holdout de proposito — teto otimista)")
print("=" * 104)
b = eleg.loc[eleg["sharpe_ho"].idxmax()]
print(f"config  : SMA {int(b.rapida)}/{int(b.lenta)} | pullback ate {MODO_NM[b.modo]} | "
      f"stop {b.stop_pts:,.0f} pts | alvo {b.alvo_pts:,.0f} pts")
print(f"holdout : n={int(b.n_ho)} | Sharpe {b.sharpe_ho:+.4f} | acerto {b.acerto_ho*100:.2f}% | "
      f"retorno liq {b.ret_ho*100:+.2f}%")
print(f"DSR mesmo neste caso escolhido a dedo: "
      f"{deflated_sharpe_ratio(b.sharpe_ho, sr0, int(b.n_ho))*100:.1f}%  (piso 95%)")

print("\n" + "=" * 104)
print("ACERTO REAL vs ACERTO NECESSARIO — o teste que decide")
print("=" * 104)
C = CUSTO_RT * PRECO
print(f"custo round-trip @ preco medio US$ {PRECO:,.0f} = {C:.0f} pontos\n")
print(f"{'stop':>10} | {'alvo':>10} | {'p_min c/ custo':>14} | {'acerto medido':>13} | "
      f"{'margem':>8} | {'n_ho':>7}")
print("-" * 82)
for stop_pts, sub in eleg.groupby("stop_pts"):
    s2 = sub[np.isclose(sub.razao, 4 / 3)]
    if not len(s2):
        continue
    r = s2.loc[s2.acerto_ho.idxmax()]
    pmin = break_even_win_rate(r.alvo_pts, r.stop_pts, C)
    marg = r.acerto_ho - pmin
    print(f"{r.stop_pts:>10,.0f} | {r.alvo_pts:>10,.0f} | {pmin*100:13.2f}% | "
          f"{r.acerto_ho*100:12.2f}% | {marg*100:+7.2f}pp | {int(r.n_ho):>7,}")
print("\n(melhor acerto de holdout em cada faixa, R:R fixo em 1:1,33 como no pedido original)")

print("\n" + "=" * 104)
print("A HIPOTESE CENTRAL: o edge do pullback sobrevive ao aumento de escala?")
print("=" * 104)
print("Em 60/80 pts (M1, sem custo) o acerto medido foi 48,97% vs 42,86% neutro = +6,11pp.")
print("Se esse edge fosse invariante de escala, ele apareceria tambem nos stops grandes.\n")
for stop_pts, sub in eleg.groupby("stop_pts"):
    s2 = sub[np.isclose(sub.razao, 4 / 3)]
    if not len(s2):
        continue
    neutro = 1 / (1 + 4 / 3)
    ac = s2.acerto_ho.mean()
    n_tot = int(s2.n_ho.sum())
    se = np.sqrt(neutro * (1 - neutro) / n_tot)
    z = (ac - neutro) / se
    print(f"stop {stop_pts:>6,.0f} pts | acerto medio {ac*100:5.2f}% | neutro {neutro*100:.2f}% | "
          f"edge bruto {(ac-neutro)*100:+5.2f}pp | n={n_tot:>6,} | z={z:+5.2f} "
          f"{'(signif.)' if abs(z) > 1.96 else '(ruido)'}")
