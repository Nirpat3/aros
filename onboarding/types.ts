// ── Onboarding Types ────────────────────────────────────────────

export interface OnboardingState {
  tenantId: string;
  step: "welcome" | "license" | "model" | "connectors" | "verify" | "complete";
  completedSteps: string[];
  connectors: {
    azureDb: boolean;
    rapidRmsApi: boolean;
  };
}

export type OnboardingStep = OnboardingState['step'];

export const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'license',
  'model',
  'connectors',
  'verify',
  'complete',
];
