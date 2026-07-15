import type { AiDemoUiPhase } from "./types";

const steps = [
  { id: "form", label: "Your info" },
  { id: "loading", label: "Analysis" },
  { id: "results", label: "Your demo" },
] as const;

export function ProgressIndicator({ phase }: { phase: AiDemoUiPhase }) {
  const currentIndex = steps.findIndex((step) => step.id === phase);

  return (
    <div className="mx-auto w-full max-w-xl">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = currentIndex > index;
          const isActive = currentIndex === index;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isComplete
                      ? "bg-growth-500 text-white"
                      : isActive
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                        : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isComplete ? "✓" : index + 1}
                </div>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isActive
                      ? "text-brand-600"
                      : isComplete
                        ? "text-navy-900"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 flex-1 rounded-full ${
                    currentIndex > index ? "bg-growth-500" : "bg-slate-200"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
