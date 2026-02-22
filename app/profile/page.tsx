"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { HomePage } from "@/src/components/home/home-page";
import { ProfileModalContent } from "@/src/components/profile/profile-page";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Modal } from "@/src/components/ui/modal";

export default function ProfileRoute() {
  const { hydrated, store } = useAppStore();
  const router = useRouter();
  const [isResumePanelOpen, setIsResumePanelOpen] = useState(false);

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
            <Button>Go to role dashboard</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <>
      <HomePage />
      <Modal
        title="Profile"
        onClose={() => router.push("/")}
        widthClassName="max-w-3xl"
        showHeader={!isResumePanelOpen}
        showClose={!isResumePanelOpen}
      >
        <ProfileModalContent onResumePanelStateChange={setIsResumePanelOpen} />
      </Modal>
    </>
  );
}
