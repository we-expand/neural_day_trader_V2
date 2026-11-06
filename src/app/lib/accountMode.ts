// 🔴 2026-10-21 (Cleber: "a plataforma tem que ter as duas possibilidades"): modo de posicao da conta DEMO.
//   NETTING (padrao): ordem contraria no mesmo ativo FECHA/REDUZ a posicao aberta (como conta netting do MT5).
//   HEDGING: ordem contraria ABRE uma posicao oposta e as duas ficam abertas (permite o "headzinho": soltar a perdedora e deixar a ganhadora correr).
// Preferencia do usuario em localStorage (mesmo padrao de positionOpenSound.ts). Em LIVE quem decide e a conta da corretora.
export type AccountMode = 'NETTING' | 'HEDGING';

const STORAGE_KEY = 'neural_account_mode';

export function getAccountMode(): AccountMode {
  try {
    if (typeof window === 'undefined') return 'NETTING';
    return window.localStorage.getItem(STORAGE_KEY) === 'HEDGING' ? 'HEDGING' : 'NETTING';
  } catch {
    return 'NETTING';
  }
}

export function setAccountMode(mode: AccountMode): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // sem localStorage (janela privada/bloqueado): fica no padrao NETTING.
  }
}
