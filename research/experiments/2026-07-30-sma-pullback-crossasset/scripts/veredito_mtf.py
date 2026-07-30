"""Analise M5/M15: taxa de acerto atingida, e o que ela significa."""
import numpy as np
import pandas as pd

from quant import deflated_sharpe_ratio, expected_max_sharpe_under_null
from mtf import CENARIOS_CUSTO

pd.set_option("display.width", 250, "display.max_columns", 60)
res = pd.read_csv("grid_mtf.csv")
N_BUSCA = 2705 + len(res)
eleg = res[(res.n_tr >= 100) & (res.n_ho >= 100)].copy()
MODO = {0: "SMA rapida", 1: "SMA lenta"}
C_PEDIDO = "0,60 pts (pedido)"
C_REAL = "15,82 pts medidos (0,0145%)"

print("=" * 108)
print(f"M5 + M15, segundo toque | {len(res)} trials | elegiveis {len(eleg)} | "
      f"N acumulado da busca = {N_BUSCA}")
print("=" * 108)

# ---------------------------------------------------------------- 1
print("\n1. A META DE 80% DE ACERTO — ATINGIDA")
print("-" * 108)
alto = eleg[eleg.acerto_ho >= 0.80].copy()
print(f"configuracoes com acerto de holdout >= 80%: {len(alto)} de {len(eleg)}")
if len(alto):
    alto["edge_pp"] = (alto.acerto_ho - alto.acerto_neutro) * 100
    top = alto.sort_values("acerto_ho", ascending=False).head(8)
    print(f"\n{'tf':>4} {'SMA':>9} {'toq':>4} {'stop':>8} {'alvo':>8} {'R:R':>6} "
          f"{'acerto':>8} {'neutro':>8} {'edge':>8} {'n':>7} {'US$ @0,60':>11} {'US$ @real':>11}")
    for _, r in top.iterrows():
        print(f"M{int(r.tf):<3} {int(r.rapida):>4}/{int(r.lenta):<4} {int(r.toques):>4} "
              f"{r.stop_pts:>8,.0f} {r.alvo_pts:>8,.0f} 1:{r.razao:<4.2f} "
              f"{r.acerto_ho*100:>7.2f}% {r.acerto_neutro*100:>7.2f}% "
              f"{r.edge_pp:>+7.2f}pp {int(r.n_ho):>7,} "
              f"{r[f'usd_ho|{C_PEDIDO}']:>+11.2f} {r[f'usd_ho|{C_REAL}']:>+11.2f}")
    pos_ped = int((alto[f"usd_ho|{C_PEDIDO}"] > 0).sum())
    pos_real = int((alto[f"usd_ho|{C_REAL}"] > 0).sum())
    print(f"\ndessas {len(alto)} com acerto >=80%:")
    print(f"  lucrativas com custo 0,60 pts  : {pos_ped}")
    print(f"  lucrativas com custo real      : {pos_real}")
    print(f"  edge medio sobre o neutro      : {alto.edge_pp.mean():+.2f}pp")

# ---------------------------------------------------------------- 2
print("\n\n2. POR QUE 80% NAO SIGNIFICA LUCRO — acerto vs neutro, por R:R")
print("-" * 108)
g = eleg.groupby("razao").agg(trials=("acerto_ho", "size"),
                              acerto=("acerto_ho", "mean"),
                              neutro=("acerto_neutro", "first"),
                              n_med=("n_ho", "mean"),
                              usd_real=(f"usd_ho|{C_REAL}", "mean"),
                              usd_ped=(f"usd_ho|{C_PEDIDO}", "mean"))
g["edge_pp"] = (g.acerto - g.neutro) * 100
g = g[["trials", "acerto", "neutro", "edge_pp", "n_med", "usd_ped", "usd_real"]]
g.index = [f"1:{i:.2f}" for i in g.index]
print(g.to_string(float_format=lambda x: f"{x:,.3f}"))
print("\nO acerto sobe de ~33% para ~82% so mudando o R:R — e acompanha o 'neutro'")
print("quase colado. O que a estrategia adiciona e a coluna 'edge_pp', nao o acerto.")

# ---------------------------------------------------------------- 3
print("\n\n3. O SEGUNDO TOQUE AJUDOU?")
print("-" * 108)
for tf in (5, 15):
    sub = eleg[eleg.tf == tf]
    print(f"\nM{tf}:")
    cmp = sub.groupby("toques").agg(trials=("acerto_ho", "size"),
                                    edge_pp=("acerto_ho", lambda x: np.nan),
                                    n_med=("n_ho", "mean"),
                                    sharpe=(f"sh_ho|{C_REAL}", "mean"),
                                    usd_real=(f"usd_ho|{C_REAL}", "mean"),
                                    usd_ped=(f"usd_ho|{C_PEDIDO}", "mean"))
    e = sub.assign(edge=(sub.acerto_ho - sub.acerto_neutro) * 100).groupby("toques").edge.mean()
    cmp["edge_pp"] = e
    print(cmp.to_string(float_format=lambda x: f"{x:,.3f}"))

# ---------------------------------------------------------------- 4
print("\n\n4. VEREDITO ESTATISTICO — DSR por cenario de custo")
print("-" * 108)
print(f"{'cenario de custo':>32} | {'SR0':>6} | {'melhor Sh_ho':>12} | {'>SR0':>5} | "
      f"{'DSR campeao':>12} | {'DSR melhor':>11}")
print("-" * 108)
guard = {}
for nome, _, _ in CENARIOS_CUSTO:
    sh_tr, sh_ho = f"sh_tr|{nome}", f"sh_ho|{nome}"
    sr0 = expected_max_sharpe_under_null(eleg[sh_tr].var(ddof=1), N_BUSCA)
    camp = eleg.loc[eleg[sh_tr].idxmax()]
    b = eleg.loc[eleg[sh_ho].idxmax()]
    dsr_c = deflated_sharpe_ratio(camp[sh_ho], sr0, int(camp.n_ho))
    dsr_b = deflated_sharpe_ratio(b[sh_ho], sr0, int(b.n_ho))
    guard[nome] = (sr0, camp, dsr_c, b, dsr_b)
    print(f"{nome:>32} | {sr0:6.3f} | {eleg[sh_ho].max():+12.4f} | "
          f"{int((eleg[sh_ho] > sr0).sum()):5d} | {dsr_c*100:11.1f}% | {dsr_b*100:10.1f}%")

print("\n-- campeao (escolhido SO pelo treino) no cenario de custo real --")
sr0, camp, dsr_c, b, dsr_b = guard[C_REAL]
print(f"   M{int(camp.tf)} | SMA {int(camp.rapida)}/{int(camp.lenta)} | "
      f"{int(camp.toques)}o toque | ref {MODO[camp.modo]} | "
      f"stop {camp.stop_pts:,.0f} pts | alvo {camp.alvo_pts:,.0f} pts")
print(f"   holdout: n={int(camp.n_ho)} | acerto {camp.acerto_ho*100:.2f}% "
      f"(neutro {camp.acerto_neutro*100:.2f}%) | Sharpe {camp[f'sh_ho|{C_REAL}']:+.4f} | "
      f"US$ {camp[f'usd_ho|{C_REAL}']:+,.2f}")
print(f"   DSR {dsr_c*100:.1f}%  {'PASSA' if dsr_c >= .95 else 'REPROVA (piso 95%)'}")

# ---------------------------------------------------------------- 5
print("\n\n5. MELHOR RESULTADO EM US$ (0,01 contrato), por cenario de custo")
print("-" * 108)
for nome, _, _ in CENARIOS_CUSTO:
    col = f"usd_ho|{nome}"
    b = eleg.loc[eleg[col].idxmax()]
    npos = int((eleg[col] > 0).sum())
    print(f"{nome:>32} | melhor US$ {b[col]:+9,.2f} | lucrativas: {npos:4d}/{len(eleg)} | "
          f"M{int(b.tf)} SMA {int(b.rapida)}/{int(b.lenta)} {int(b.toques)}o toque "
          f"R:R 1:{b.razao:.2f} acerto {b.acerto_ho*100:.1f}%")
