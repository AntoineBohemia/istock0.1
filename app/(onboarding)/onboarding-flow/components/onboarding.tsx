"use client";

import { WelcomeStep } from "./welcome-step";
import { OrganizationStep } from "./organization-step";
import { CategoriesStep } from "./categories-step";
import { ProductsStep } from "./products-step";
import { FirstTechnicianStep } from "./first-technician-step";
import { StockTutorialStep } from "./stock-tutorial-step";
import { CompletionStep } from "./completion-step";
import { useOnboardingStore, ONBOARDING_STEPS } from "../store";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const stepComponents = {
  welcome: WelcomeStep,
  organization: OrganizationStep,
  categories: CategoriesStep,
  products: ProductsStep,
  "first-technician": FirstTechnicianStep,
  "stock-tutorial": StockTutorialStep,
  completion: CompletionStep,
};

export default function Onboarding() {
  const { currentStep, getProgress } = useOnboardingStore();
  const currentStepKey = ONBOARDING_STEPS[currentStep];
  const CurrentStepComponent = stepComponents[currentStepKey];
  const progress = getProgress();

  // Don't show progress on welcome and completion
  const showProgress = currentStep > 0 && currentStep < ONBOARDING_STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
      {showProgress && (
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Etape {currentStep} sur {ONBOARDING_STEPS.length - 2}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {ONBOARDING_STEPS.slice(1, -1).map((step, index) => (
              <div
                key={step}
                className={cn(
                  "flex items-center justify-center",
                  index + 1 <= currentStep
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    index + 1 < currentStep
                      ? "bg-primary"
                      : index + 1 === currentStep
                      ? "bg-primary ring-4 ring-primary/20"
                      : "bg-muted-foreground/30"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <CurrentStepComponent />
    </div>
  );
}
