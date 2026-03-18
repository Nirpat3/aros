// ── Onboarding — Blank Slate Tenant Setup ───────────────────────
// New tenants start with zero connectors, zero credentials, zero data.

import type { OnboardingState, OnboardingStep } from './types.js';
import { STEP_ORDER } from './types.js';

export type { OnboardingState, OnboardingStep } from './types.js';
export { STEP_ORDER } from './types.js';

// ── Init ────────────────────────────────────────────────────────

/** Create a blank tenant — no connectors, no credentials, no data. */
export function initTenant(tenantId: string): OnboardingState {
  return {
    tenantId,
    step: 'welcome',
    completedSteps: [],
    connectors: {
      azureDb: false,
      rapidRmsApi: false,
    },
  };
}

// ── Step Management ─────────────────────────────────────────────

/** Mark current step complete and advance to the next. */
export function advanceStep(
  state: OnboardingState,
  completedStep: OnboardingStep,
): OnboardingState {
  const completedSteps = state.completedSteps.includes(completedStep)
    ? state.completedSteps
    : [...state.completedSteps, completedStep];

  const currentIndex = STEP_ORDER.indexOf(completedStep);
  const nextStep = currentIndex < STEP_ORDER.length - 1
    ? STEP_ORDER[currentIndex + 1]
    : 'complete';

  return { ...state, step: nextStep, completedSteps };
}

/** Check if onboarding is fully complete. */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.step === 'complete';
}
