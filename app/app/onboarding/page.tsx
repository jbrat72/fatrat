import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// UserProvider lives in the root layout — don't wrap a second instance here.
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
