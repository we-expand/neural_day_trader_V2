// 🔴 2026-10-21 (Cleber): preferencias do usuario para as ferramentas de desenho do Grafico, em localStorage (mesmo padrao de accountMode.ts).
//   shiftStraighten (padrao LIGADO): com o Shift apertado ao terminar de tracar uma reta (ou ao soltar um ponto arrastado), a reta fica 100%
//   horizontal (2o ponto assume o mesmo preco do 1o).
const KEY_SHIFT_STRAIGHTEN = 'neural_shift_straighten_lines';

export function isShiftStraightenEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(KEY_SHIFT_STRAIGHTEN);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export function setShiftStraightenEnabled(enabled: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(KEY_SHIFT_STRAIGHTEN, String(enabled));
  } catch {
    // sem localStorage: fica no padrao (ligado)
  }
}
