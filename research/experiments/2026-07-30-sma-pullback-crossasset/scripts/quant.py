"""
Porte fiel para Python das ferramentas de research/ do Neural-Day-Trader:
  - CostModel.ts       -> estimate_cost_percent / break_even_win_rate
  - DeflatedSharpe.ts  -> sharpe_ratio / expected_max_sharpe_under_null / deflated_sharpe_ratio
  - DataSplit.ts       -> split_with_embargo

Mesmas formulas, mesmas constantes, mesmas simplificacoes declaradas.
"""
import numpy as np
from scipy.stats import norm

# --- CostModel.ts : COST_TABLE['CRYPTO'] -------------------------------------
# { spreadPoints: 0, commissionPercent: 0.08, slippagePoints: 0.05 }
# Para CRYPTO os campos ja sao percentuais diretos (fix da secao 11.13).
CRYPTO_SPREAD_PCT = 0.0 / 100
CRYPTO_SLIPPAGE_PCT = 0.05 / 100
CRYPTO_COMMISSION_PCT = 0.08 / 100


def estimate_cost_percent_crypto() -> float:
    """Custo de UMA perna, em fracao do nocional."""
    return CRYPTO_SPREAD_PCT + CRYPTO_SLIPPAGE_PCT + CRYPTO_COMMISSION_PCT


def round_trip_cost_points(price: float) -> float:
    """Custo round-trip (ida+volta) convertido em PONTOS de preco."""
    return estimate_cost_percent_crypto() * 2 * price


def break_even_win_rate(target_pts: float, stop_pts: float, rt_cost_pts: float) -> float:
    """CostModel.ts: p_min = (L + C) / (R + L)."""
    if target_pts <= 0 or stop_pts <= 0:
        return 1.0
    return (stop_pts + rt_cost_pts) / (target_pts + stop_pts)


# --- DeflatedSharpe.ts -------------------------------------------------------
EULER_MASCHERONI = 0.5772156649


def sharpe_ratio(returns: np.ndarray) -> float:
    """
    DeflatedSharpe.ts usa `stdDev > 0 ? mean/stdDev : 0`. Em ponto flutuante,
    uma serie de retornos identicos (ex.: 100% dos trades no stop) produz
    sd ~1e-18 em vez de 0 exato, gerando Sharpe da ordem de 1e15. Tolerancia
    relativa ao tamanho do retorno resolve, preservando a convencao do .ts.
    """
    n = len(returns)
    if n < 2:
        return 0.0
    sd = returns.std(ddof=1)
    escala = max(abs(returns.mean()), 1e-12)
    return float(returns.mean() / sd) if sd > escala * 1e-6 else 0.0


def expected_max_sharpe_under_null(sharpe_var_across_trials: float, n_trials: int) -> float:
    """Bailey & Lopez de Prado eq. 8 — Sharpe esperado do melhor de N trials sob H0."""
    if n_trials <= 1:
        return 0.0
    sd = np.sqrt(max(sharpe_var_across_trials, 0.0))
    return float(sd * ((1 - EULER_MASCHERONI) * norm.ppf(1 - 1 / n_trials)
                       + EULER_MASCHERONI * norm.ppf(1 - 1 / (n_trials * np.e))))


def deflated_sharpe_ratio(sharpe_hat: float, sr0: float, n_obs: int) -> float:
    """Simplificacao gaussiana (g3=0, g4=3) — liberal, como declarado no .ts."""
    if n_obs < 2 or not np.isfinite(sharpe_hat):
        return 0.0
    denom = np.sqrt(1 + (sharpe_hat ** 2) / 2)
    z = ((sharpe_hat - sr0) * np.sqrt(n_obs - 1)) / denom
    return float(norm.cdf(z))


# --- DataSplit.ts ------------------------------------------------------------
def split_with_embargo(n: int, num_windows: int = 3, train_pct: float = 0.7,
                       warmup_bars: int = 200):
    """
    Retorna [(train_ini, train_fim, hold_ini, hold_fim, primeiro_idx_valido), ...]
    em indices absolutos. `primeiro_idx_valido` = fim do warmup: trades cuja
    ENTRADA ocorra antes disso nao contam como observacao de holdout.
    """
    chunk = n // num_windows
    janelas = []
    for w in range(num_windows):
        ini = w * chunk
        fim = n if w == num_windows - 1 else (w + 1) * chunk
        split_at = ini + int((fim - ini) * train_pct)
        warm_start = max(ini, split_at - warmup_bars)
        janelas.append((ini, split_at, warm_start, fim, split_at))
    return janelas


if __name__ == "__main__":
    print("=" * 76)
    print("GATE DE VIABILIDADE POR CUSTO — CostModel.ts do proprio projeto")
    print("=" * 76)
    c1 = estimate_cost_percent_crypto()
    print(f"custo CRYPTO por perna : {c1*100:.3f}% do nocional")
    print(f"custo round-trip       : {c1*2*100:.3f}% do nocional\n")

    for preco in (60_000, 70_000, 84_000):
        C = round_trip_cost_points(preco)
        p = break_even_win_rate(80, 60, C)
        print(f"BTC @ US$ {preco:>6,}  ->  custo round-trip = {C:6.1f} pontos  |  "
              f"p_min(alvo 80 / stop 60) = {p*100:6.1f}%  "
              f"{'IMPOSSIVEL (>100%)' if p > 1 else ''}")

    print("\nSem custo, o p_min de 60x80 seria 42,86%. O backtest mediu 48,97%.")
    print("Com o custo real do CostModel, o alvo precisaria ser atingido em mais")
    print("de 100% das vezes — a configuracao original nao tem solucao possivel.")
