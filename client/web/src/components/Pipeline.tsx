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
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'refine',
    name: 'Refine',
    description: 'Off-chain computation (6s max)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'audit',
    name: 'Audit',
    description: 'Validators verify',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'accumulate',
    name: 'Accumulate',
    description: 'On-chain state update',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
];

export function Pipeline({ activeStage }: PipelineProps) {
  const activeIndex = stages.findIndex((s) => s.id === activeStage);

  return (
    <div className="w-full py-4">
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
                    'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300',
                    isComplete && 'bg-green-100 ring-2 ring-green-500 text-green-700',
                    isActive && 'bg-pink-100 ring-2 ring-[#E6007A] text-[#E6007A] shadow-lg',
                    isPending && 'bg-gray-100 ring-2 ring-gray-200 text-gray-400'
                  )}
                >
                  {isComplete ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stage.icon
                  )}
                </div>
                <span
                  className={cn(
                    'mt-3 text-sm font-medium',
                    isComplete && 'text-green-700',
                    isActive && 'text-[#E6007A]',
                    isPending && 'text-gray-400'
                  )}
                >
                  {stage.name}
                </span>
                <span className="text-xs text-gray-400 text-center mt-1 max-w-24">
                  {stage.description}
                </span>
              </div>

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div className="flex-1 h-0.5 mx-3 mt-[-2.5rem]">
                  <div
                    className={cn(
                      'h-full transition-all duration-500 rounded-full',
                      isComplete || (isActive && index < activeIndex)
                        ? 'bg-green-500'
                        : 'bg-gray-200'
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
