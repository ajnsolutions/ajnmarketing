import type { AiDemoStep } from "./types";

const steps = [
  { number: 1, label: "Your Info" },
  { number: 2, label: "Analysis" },
  { number: 3, label: "Results" },
] as const;

export function ProgressIndicator({ currentStep }: { currentStep: AiDemoStep }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = currentStep > step.number;
          const isActive = currentStep === step.number;

          return (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isComplete
                      ? "bg-growth-500 text-white"
                      : isActive
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                        : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                  }`}
                >
                  {isComplete ? "✓" : step.number}
                </div>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isActive ? "text-brand-600" : isComplete ? "text-navy-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 flex-1 rounded-full ${
                    currentStep > step.number ? "bg-growth-500" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
