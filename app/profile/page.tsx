"use client";

import Link from "next/link";

import { ProfilePage } from "@/src/components/profile/profile-page";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default function ProfileRoute() {
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
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <Card className="space-y-3">
          <h1 className="text-3xl">Profile not found</h1>
          <p className="text-paper-softInk">Complete onboarding to create your profile.</p>
          <Link href="/">
            <Button>Go to role practice</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return <ProfilePage />;
}
