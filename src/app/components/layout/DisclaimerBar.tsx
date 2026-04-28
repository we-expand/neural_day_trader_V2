import React from 'react';

export function DisclaimerBar() {
  return (
    <div className="bg-black/95 border-t border-white/5 py-1 px-4 flex justify-center items-center text-[9px] text-slate-600 font-mono uppercase tracking-wider select-none shrink-0 z-40">
      <span>
        Aviso Legal: Ferramenta de análise estatística. Não constitui aconselhamento financeiro.
      </span>
    </div>
  );
}
