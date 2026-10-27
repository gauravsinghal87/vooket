import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrackerStep {
  key: string;
  label: string;
}

export type TrackerState = 'done' | 'current' | 'todo';

export interface StatusTrackerStep extends TrackerStep {
  state: TrackerState;
}

interface StatusTrackerProps {
  steps: StatusTrackerStep[];
  tone?: 'brand' | 'food';
}

export function StatusTracker({ steps, tone = 'brand' }: StatusTrackerProps) {
  const food = tone === 'food';
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolled = useRef<number>(-1);

  useEffect(() => {
    const currentIndex = steps.findIndex((s) => s.state === 'current');
    if (currentIndex < 0 || currentIndex === lastScrolled.current) return;
    lastScrolled.current = currentIndex;

    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector<HTMLElement>(`[data-step-index="${currentIndex}"]`);
    if (!active) return;

    const delta =
      active.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left -
      scroller.clientWidth / 2 +
      active.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, scroller.scrollLeft + delta), behavior: 'auto' });
  }, [steps]);

  const doneCircle = food ? 'bg-food-600 text-white' : 'bg-brand-600 text-white';
  const currentCircle = food
    ? 'bg-food-600 text-white ring-4 ring-food-600/20'
    : 'border-2 border-brand-600 text-brand-700';
  const todoCircle = 'border-2 border-neutral-200 text-neutral-300';
  const connectorDone = food ? 'bg-food-500' : 'bg-brand-500';
  const connectorTodo = 'bg-neutral-200';
  const currentLabel = food ? 'text-food-700' : 'text-brand-700';

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar -mx-1 touch-pan-x overflow-x-auto overflow-y-hidden px-1 py-1"
    >
      <div className="flex min-w-max items-start md:min-w-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div
              key={step.key}
              data-step-index={i}
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={cn(
                'flex w-24 shrink-0 flex-col items-center',
                'md:w-auto md:shrink md:flex-1'
              )}
            >
              <div className="flex w-full items-center">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-0.5 flex-1 rounded-full',
                      steps[i - 1].state === 'done' ? connectorDone : connectorTodo
                    )}
                  />
                )}
                <span
                  className={cn(
                    'mx-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    step.state === 'done'
                      ? doneCircle
                      : step.state === 'current'
                        ? currentCircle
                        : todoCircle
                  )}
                >
                  {step.state === 'done' ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : step.state === 'current' && food ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    <span className="text-xs">{i + 1}</span>
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-0.5 flex-1 rounded-full',
                      step.state === 'done' ? connectorDone : connectorTodo
                    )}
                  />
                )}
              </div>

              <span
                className={cn(
                  'mt-1.5 block w-full px-0.5 text-center text-[10px] font-medium leading-tight',
                  step.state === 'current'
                    ? cn('font-bold', currentLabel)
                    : step.state === 'done'
                      ? 'text-neutral-600'
                      : 'text-neutral-400'
                )}
              >
                {step.label}
              </span>

              {step.state === 'current' && food && (
                <span className="mt-1 block max-w-full rounded-full bg-food-50 px-2 py-0.5 text-center text-[10px] font-bold leading-normal text-food-600">
                  Currently in progress
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function buildSteps<T extends string>(
  ordered: T[],
  current: T | null | undefined,
  cancelled = false
): StatusTrackerStep[] {
  const currentIndex = current ? ordered.indexOf(current) : -1;
  return ordered.map((key) => {
    const label = key.replace(/_/g, ' ');
    const idx = ordered.indexOf(key);
    let state: TrackerState = 'todo';
    if (cancelled) state = 'todo';
    else if (currentIndex >= 0 && idx < currentIndex) state = 'done';
    else if (currentIndex === idx) state = 'current';
    return { key, label, state };
  });
}