import React from 'react';

interface TestViewProps {
  name: string;
  color?: string;
}

export function TestView({ name, color = 'emerald' }: TestViewProps) {
  const [count, setCount] = React.useState(0);
  
  React.useEffect(() => {
    console.log(`[TEST_VIEW] ✅ ${name} montado com sucesso`);
    return () => console.log(`[TEST_VIEW] 🔄 ${name} desmontado`);
  }, [name]);
  
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center bg-black p-8">
      <div className={`max-w-2xl w-full p-12 rounded-2xl border-2 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.emerald}`}>
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold">✅ {name}</h1>
          <p className="text-2xl opacity-75">Módulo carregado com sucesso!</p>
          
          <div className="pt-8">
            <button
              onClick={() => setCount(c => c + 1)}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-lg transition-all"
            >
              Cliques: {count}
            </button>
          </div>
          
          <div className="pt-4 text-sm opacity-50">
            <p>Se você está vendo isso, o módulo está funcionando corretamente.</p>
            <p className="mt-2">Timestamp: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
