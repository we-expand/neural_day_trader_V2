"""Veredito com o custo real medido, por nivel de custo."""
import numpy as np
import pandas as pd

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   break_even_win_rate)
from recusto import CUSTOS

pd.set_option("display.width", 250, "display.max_columns", 60)
res = pd.read_csv("grid_recusto.csv")
PRECO = 55_782.0
N_BUSCA = 900 + 750 + len(res) + 5     # tudo que ja foi testado sobre este dado
eleg = res[(res.n_tr >= 100) & (res.n_ho >= 100)].copy()

print("=" * 104)
print(f"RE-TESTE COM CUSTO REAL — {len(res)} trials | elegiveis (n>=100): {len(eleg)}")
print(f"N acumulado de toda a busca sobre BTCUSD M1: {N_BUSCA}")
print("=" * 104)

print(f"\n{'nivel de custo':>38} | {'SR0':>6} | {'melhor Sh_ho':>12} | "
      f"{'>0':>5} | {'>SR0':>5} | {'melhor DSR':>10}")
print("-" * 104)
resumo = []
for nome in CUSTOS:
    sh_tr, sh_ho = f"sh_tr|{nome}", f"sh_ho|{nome}"
    var = eleg[sh_tr].var(ddof=1)
    sr0 = expected_max_sharpe_under_null(var, N_BUSCA)
    melhor = eleg[sh_ho].max()
    npos = int((eleg[sh_ho] > 0).sum())
    nsr0 = int((eleg[sh_ho] > sr0).sum())
    # DSR do campeao escolhido pelo TREINO (disciplina correta)
    camp = eleg.loc[eleg[sh_tr].idxmax()]
    dsr_c = deflated_sharpe_ratio(camp[sh_ho], sr0, int(camp.n_ho))
    # DSR do melhor do holdout (cherry-pick, teto otimista)
    b = eleg.loc[eleg[sh_ho].idxmax()]
    dsr_b = deflated_sharpe_ratio(b[sh_ho], sr0, int(b.n_ho))
    resumo.append((nome, sr0, camp, dsr_c, b, dsr_b))
    print(f"{nome:>38} | {sr0:6.3f} | {melhor:+12.4f} | {npos:5d} | {nsr0:5d} | {dsr_b*100:9.1f}%")

print("\n(‘>0’ e ‘>SR0’ = quantos dos elegiveis superam zero e o limiar do acaso;")
print(" ‘melhor DSR’ ja e o caso escolhido a dedo olhando o holdout — teto otimista)")

print("\n" + "=" * 104)
print("CENARIO REALISTA (0,0145% = spread medido da Pepperstone) — DETALHE")
print("=" * 104)
nome = "0,0145% (Pepperstone medio, medido)"
_, sr0, camp, dsr_c, b, dsr_b = [r for r in resumo if r[0] == nome][0]
MODO = {0: "SMA rapida", 1: "SMA lenta"}
print(f"SR0 (limiar do acaso, N={N_BUSCA}) = {sr0:.4f}\n")
print("-- campeao escolhido SO pelo treino (disciplina CRITERIA.md) --")
print(f"   SMA {int(camp.rapida)}/{int(camp.lenta)} | pullback {MODO[camp.modo]} | "
      f"stop {camp.stop_pts:,.0f} pts | alvo {camp.alvo_pts:,.0f} pts")
print(f"   treino  Sharpe {camp[f'sh_tr|{nome}']:+.4f} (n={int(camp.n_tr)})")
print(f"   holdout Sharpe {camp[f'sh_ho|{nome}']:+.4f} (n={int(camp.n_ho)}) | "
      f"retorno liq {camp[f'ret_ho|{nome}']*100:+.2f}% | acerto {camp.acerto_ho*100:.2f}%")
print(f"   DSR = {dsr_c*100:.1f}%  {'PASSA' if dsr_c >= .95 else 'REPROVA (piso 95%)'}")
print("\n-- melhor do holdout (cherry-pick proposital, teto otimista) --")
print(f"   SMA {int(b.rapida)}/{int(b.lenta)} | pullback {MODO[b.modo]} | "
      f"stop {b.stop_pts:,.0f} pts | alvo {b.alvo_pts:,.0f} pts")
print(f"   holdout Sharpe {b[f'sh_ho|{nome}']:+.4f} (n={int(b.n_ho)}) | "
      f"retorno liq {b[f'ret_ho|{nome}']*100:+.2f}%")
print(f"   DSR = {dsr_b*100:.1f}%  {'PASSA' if dsr_b >= .95 else 'REPROVA (piso 95%)'}")

print("\n-- Sharpe de holdout por faixa de stop, custo realista --")
g = eleg.groupby("stop_pts").agg(trials=(f"sh_ho|{nome}", "size"),
                                 sh_max=(f"sh_ho|{nome}", "max"),
                                 sh_medio=(f"sh_ho|{nome}", "mean"),
                                 positivos=(f"sh_ho|{nome}", lambda x: int((x > 0).sum())),
                                 n_ho_med=("n_ho", "mean"))
g.index = [f"{i:,.0f} pts ({i/PRECO*100:.2f}%)" for i in g.index]
print(g.to_string(float_format=lambda x: f"{x:,.4f}"))

print("\n" + "=" * 104)
print("GATE DE VIABILIDADE REFEITO — config original 60x80, custo real")
print("=" * 104)
print(f"{'custo round-trip':>38} | {'em pontos':>10} | {'p_min(80/60)':>13} | {'medido 48,97%':>14}")
print("-" * 88)
for nome_c, cst in CUSTOS.items():
    C = cst * 70_000
    p = break_even_win_rate(80, 60, C)
    txt = f"{p*100:12.1f}%" if p <= 1 else "  IMPOSSIVEL"
    print(f"{nome_c:>38} | {C:9.1f}  | {txt} | "
          f"{'INSUFICIENTE' if p > 0.4897 else 'suficiente':>14}")
print("\n(p_fair sem custo nenhum = 42,86%; a estrategia mede 48,97% em 6 meses)")
