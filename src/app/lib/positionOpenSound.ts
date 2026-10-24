// Som curto e discreto tocado quando a LLM (llm-active-brain) abre uma
// posicao nova de verdade -- gerado via Web Audio API (sem asset .mp3/.wav,
// nao precisa de arquivo extra no repo). Preferencia do usuario persiste em
// localStorage, mesmo padrao dos toggles de TradingContext.tsx.

const STORAGE_KEY = 'neural_position_open_sound_enabled';

export function isPositionOpenSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Default ligado -- feature nova, opt-out.
  return stored === null ? true : stored === 'true';
}

export function setPositionOpenSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

// Dois tons curtos ascendentes (tipo "ding-ding" de confirmacao), volume
// baixo -- pensado pra notificar sem assustar/atrapalhar quem esta com a
// tela aberta o dia inteiro.
export function playPositionOpenSound(): void {
  if (!isPositionOpenSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const notes: Array<{ freq: number; start: number; duration: number }> = [
      { freq: 880, start: 0, duration: 0.11 },
      { freq: 1320, start: 0.09, duration: 0.16 },
    ];

    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.freq;

      const startAt = now + note.start;
      const endAt = startAt + note.duration;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.16, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    }
  } catch (e) {
    console.warn('[positionOpenSound] Falha ao tocar som de posicao aberta (ignorado):', e);
  }
}
