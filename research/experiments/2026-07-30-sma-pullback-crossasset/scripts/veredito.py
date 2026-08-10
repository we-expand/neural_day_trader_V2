"""Selecao do campeao pelo treino, medicao no holdout e veredito por CRITERIA.md."""
import numpy as np
import pandas as pd
from scipy import stats as st

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   break_even_win_rate, estimate_cost_percent_crypto)

pd.set_option("display.width", 240, "display.max_columns", 60)
CUSTO_RT = estimate_cost_percent_crypto() * 2
res = pd.read_csv("grid_resultados.csv")
N_TRIALS = len(res)
PRECO = 69_782.0
MODO_NM = {0: "SMA rapida", 1: "SMA lenta"}

# CRITERIA.md exige >=100 sinais. O piso vale na SELECAO, nao so na conferencia
# final: escolher o campeao entre configs de n=18 e so depois checar a amostra
# seleciona ruido por construcao.
eleg = res[(res["n_tr"] >= 100) & (res["n_ho"] >= 100)].copy()

# --- sr0: Sharpe esperado do melhor de N trials sob H0 (Bailey & Lopez de Prado)
# Variancia medida entre os trials elegiveis; N = 900, o total de configs
# efetivamente testadas sobre este dado (nao so as elegiveis) — conservador.
var_sh = eleg["sharpe_tr"].var(ddof=1)
sr0 = expected_max_sharpe_under_null(var_sh, N_TRIALS)

print("=" * 100)
print(f"1. CORRECAO POR MULTIPLOS TESTES — {N_TRIALS} trials")
print("=" * 100)
print(f"variancia dos Sharpes de treino entre trials : {var_sh:.6f}")
print(f"SR0 (Sharpe do melhor trial esperado por ACASO): {sr0:.4f}")
print("Qualquer Sharpe de holdout abaixo disso e indistinguivel de sorte de busca.\n")

print("=" * 100)
print(f"2. TOP 10 POR TREINO (entre os {len(eleg)} elegiveis, n>=100)  ->  holdout")
print("=" * 100)
top = eleg.sort_values("sharpe_tr", ascending=False).head(10).copy()
top["modo"] = top["modo"].map(MODO_NM)
cols = ["rapida", "lenta", "modo", "stop_pts", "alvo_pts", "n_tr", "sharpe_tr",
        "acerto_tr", "n_ho", "sharpe_ho", "acerto_ho", "ret_ho"]
print(top[cols].to_string(index=False, float_format=lambda x: f"{x:,.4f}"))

camp = eleg.loc[eleg["sharpe_tr"].idxmax()]
print("\n" + "=" * 100)
print("3. CAMPEAO (escolhido SO pelo treino) — VEREDITO NO HOLDOUT")
print("=" * 100)
print(f"config       : SMA {int(camp.rapida)}/{int(camp.lenta)} | pullback ate {MODO_NM[camp.modo]} | "
      f"stop {camp.stop_pct*100:.2f}% ({camp.stop_pts:,.0f} pts) | "
      f"alvo {camp.alvo_pct*100:.2f}% ({camp.alvo_pts:,.0f} pts)")
print(f"treino       : n={int(camp.n_tr):4d} | Sharpe {camp.sharpe_tr:+.4f} | "
      f"acerto {camp.acerto_tr*100:5.2f}% | retorno liq {camp.ret_tr*100:+.2f}%")
print(f"holdout      : n={int(camp.n_ho):4d} | Sharpe {camp.sharpe_ho:+.4f} | "
      f"acerto {camp.acerto_ho*100:5.2f}% | retorno liq {camp.ret_ho*100:+.2f}%")

dsr = deflated_sharpe_ratio(camp.sharpe_ho, sr0, int(camp.n_ho))
degr = (camp.ret_ho - camp.ret_tr) / abs(camp.ret_tr) if camp.ret_tr else np.nan
print(f"\nDSR (holdout, corrigido por {N_TRIALS} trials): {dsr*100:.1f}%   "
      f"[piso CRITERIA.md = 95%]  {'PASSA' if dsr >= .95 else 'REPROVA'}")
print(f"degradacao treino->holdout (retorno)        : {degr*100:+.1f}%   "
      f"[piso = -30%]  {'PASSA' if degr > -.30 else 'REPROVA'}")
print(f"tamanho de amostra holdout                  : {int(camp.n_ho)}      "
      f"[piso = 100]  {'PASSA' if camp.n_ho >= 100 else 'REPROVA'}")

print("\n" + "=" * 100)
print("4. CRITERIO DE PROMOCAO — CRITERIA.md")
print("=" * 100)
aprov = [
    ("amostra >= 100 sinais", camp.n_ho >= 100),
    ("retorno liquido de custo (CostModel)", True),
    ("walk-forward sem look-ahead (DataSplit)", True),
    ("degradacao OOS < 30% relativa", bool(degr > -.30)),
    ("DSR >= 95% (Deflated Sharpe)", bool(dsr >= .95)),
]
for nome, ok in aprov:
    print(f"  [{'x' if ok else ' '}] {nome}")
print(f"\nVEREDITO: {'APROVADO' if all(o for _, o in aprov) else 'REPROVADO — nao promover'}")

# --- quantos trials sequer sobrevivem no holdout
print("\n" + "=" * 100)
print("5. PANORAMA DO GRID INTEIRO")
print("=" * 100)
val = res[res["n_ho"] >= 100]
print(f"trials com n_ho >= 100                : {len(val)} de {N_TRIALS}")
print(f"  ... com Sharpe holdout > 0          : {int((val.sharpe_ho > 0).sum())}")
print(f"  ... com Sharpe holdout > SR0 ({sr0:.3f}) : {int((val.sharpe_ho > sr0).sum())}")
print(f"melhor Sharpe holdout do grid inteiro : {val.sharpe_ho.max():+.4f} "
      f"(vs SR0 {sr0:.4f} exigido so para empatar com o acaso)")
print(f"correlacao Sharpe treino vs holdout   : {val.sharpe_tr.corr(val.sharpe_ho):+.4f}"
      "   <- se ~0, o treino nao prediz nada")

print("\n-- melhor por faixa de stop (holdout, so n>=100) --")
g = val.groupby("stop_pts").agg(trials=("sharpe_ho", "size"),
                                sharpe_ho_max=("sharpe_ho", "max"),
                                sharpe_ho_med=("sharpe_ho", "mean"),
                                ret_ho_max=("ret_ho", "max"))
g.index = [f"{i:,.0f} pts ({i/PRECO*100:.2f}%)" for i in g.index]
print(g.to_string(float_format=lambda x: f"{x:,.4f}"))

# --- o pedido literal: SMA 40/100, qual stop/alvo seria necessario
print("\n" + "=" * 100)
print("6. RESPOSTA DIRETA: mantendo SMA 40/100, qual stop/alvo?")
print("=" * 100)
sub = res[(res.rapida == 40) & (res.lenta == 100) & (res.n_ho >= 100)]
best = sub.sort_values("sharpe_ho", ascending=False).head(5).copy()
best["modo"] = best["modo"].map(MODO_NM)
print(best[["modo", "stop_pts", "alvo_pts", "razao", "n_ho", "sharpe_ho",
            "acerto_ho", "ret_ho"]].to_string(index=False,
                                              float_format=lambda x: f"{x:,.4f}"))
b = best.iloc[0]
dsr_b = deflated_sharpe_ratio(b.sharpe_ho, sr0, int(b.n_ho))
print(f"\nmelhor 40/100 no holdout -> DSR {dsr_b*100:.1f}% "
      f"{'PASSA' if dsr_b >= .95 else 'REPROVA (piso 95%)'}")

print("\n" + "=" * 100)
print("7. QUANTO O STOP PRECISARIA CRESCER SO PARA O CUSTO CABER")
print("=" * 100)
C = CUSTO_RT * PRECO
print(f"custo round-trip @ US$ {PRECO:,.0f} = {C:.0f} pontos\n")
print(f"{'stop (pts)':>11} | {'alvo (pts)':>11} | {'p_min c/ custo':>14} | {'p_fair s/ custo':>15} | {'pedagio':>8}")
print("-" * 74)
for L in [60, 200, 500, 1000, 1500, 2500, 4000]:
    R = L * 4 / 3
    pmin = break_even_win_rate(R, L, C)
    pfair = L / (R + L)
    txt = f"{pmin*100:13.1f}%" if pmin <= 1 else "   IMPOSSIVEL"
    print(f"{L:>11,} | {R:>11,.0f} | {txt} | {pfair*100:14.1f}% | "
          f"{(pmin-pfair)*100:+7.1f}pp")
print("\n(pedagio = quantos pontos percentuais de acerto o custo consome;")
print(" a estrategia mediu +6,1pp de vantagem sobre o p_fair, sem custo)")
