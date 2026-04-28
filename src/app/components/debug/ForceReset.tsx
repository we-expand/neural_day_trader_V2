import React from 'react';

export const ForceStateReset = () => {
  const handleReset = () => {
     localStorage.clear();
     window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
        <button onClick={handleReset} className="bg-red-900/20 text-red-500 text-xs px-2 py-1 rounded border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors">
            DEBUG: HARD RESET
        </button>
    </div>
  );
};