"use client";

import { HomePage } from "@/src/components/home/home-page";
import { OnboardingFlow } from "@/src/components/onboarding/onboarding-flow";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Card } from "@/src/components/ui/card";

export default function RootPage() {
  const { hydrated, store } = useAppStore();

  if (!hydrated) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <Card>
          <p className="text-paper-softInk">Loading your workspace...</p>
        </Card>
      </main>
    );
  }

  if (!store.profile) {
    return <OnboardingFlow />;
  }

  return <HomePage />;
}
