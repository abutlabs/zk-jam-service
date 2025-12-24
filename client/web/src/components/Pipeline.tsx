'use client';

import { cn } from '@/lib/utils';

interface PipelineProps {
  activeStage?: 'submit' | 'refine' | 'audit' | 'accumulate' | 'complete';
}

const stages = [
  {
    id: 'submit',
    name: 'Submit',
    description: 'Work item submitted',
    icon: '📤',
  },
  {
    id: 'refine',
    name: 'Refine',
    description: 'Off-chain computation (6s max)',
    icon: '⚙️',
  },
  {
    id: 'audit',
    name: 'Audit',
    description: 'Validators verify',
    icon: '🔍',
  },
  {
    id: 'accumulate',
    name: 'Accumulate',
    description: 'On-chain state update',
    icon: '💾',
  },
];

export function Pipeline({ activeStage }: PipelineProps) {
  const activeIndex = stages.findIndex((s) => s.id === activeStage);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isActive = stage.id === activeStage;
          const isComplete = activeIndex > index || activeStage === 'complete';
          const isPending = activeIndex < index && activeStage !== 'complete';

          return (
            <div key={stage.id} className="flex items-center flex-1">
              {/* Stage circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-300',
                    isComplete && 'bg-green-500/20 ring-2 ring-green-500',
                    isActive && 'bg-purple-500/20 ring-2 ring-purple-500 animate-pulse',
                    isPending && 'bg-zinc-800 ring-2 ring-zinc-700'
                  )}
                >
                  {isComplete ? '✓' : stage.icon}
                </div>
                <span
                  className={cn(
                    'mt-2 text-sm font-medium',
                    isComplete && 'text-green-400',
                    isActive && 'text-purple-400',
                    isPending && 'text-zinc-500'
                  )}
                >
                  {stage.name}
                </span>
                <span className="text-xs text-zinc-500 text-center mt-1 max-w-24">
                  {stage.description}
                </span>
              </div>

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-2rem]">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      isComplete || (isActive && index < activeIndex)
                        ? 'bg-green-500'
                        : 'bg-zinc-700'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
