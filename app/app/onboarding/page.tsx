import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { UserProvider } from '@/components/app';

export default function OnboardingPage() {
  return (
    <UserProvider>
      <OnboardingWizard />
    </UserProvider>
  );
}
