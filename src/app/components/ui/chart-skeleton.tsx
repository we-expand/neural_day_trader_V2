import React from 'react';
import { Skeleton } from './skeleton';

export function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col space-y-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 animate-pulse">
      {/* Header Area */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-zinc-800" />
          <Skeleton className="h-8 w-48 bg-zinc-800" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 bg-zinc-800" />
          <Skeleton className="h-8 w-20 bg-zinc-800" />
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 w-full relative">
        {/* Y-Axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-[1px] bg-zinc-800/50" />
          ))}
        </div>
        
        {/* Fake Bars/Candles */}
        <div className="absolute inset-0 flex items-end justify-around px-2 pb-4 pt-10">
          {[...Array(12)].map((_, i) => (
            <Skeleton 
              key={i} 
              className="w-8 bg-zinc-800 rounded-sm" 
              style={{ height: `${Math.random() * 60 + 20}%` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 bg-zinc-800" />
        <Skeleton className="h-6 w-16 bg-zinc-800" />
        <Skeleton className="h-6 w-16 bg-zinc-800" />
      </div>
    </div>
  );
}
