"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InterviewConclusionPage } from "@/src/components/interview/interview-conclusion-page";
import { useAppStore } from "@/src/components/providers/app-store-provider";

export default function AttemptConclusionPage({
  params,
}: {
  params: Promise<{ roleId: string; attemptId: string }>;
}) {
  const { hydrated, store } = useAppStore();
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (hydrated && !store.profile) {
      router.replace("/");
    }
  }, [hydrated, router, store.profile]);

  if (!hydrated || !store.profile) {
    return null;
  }

  return <InterviewConclusionPage roleId={resolvedParams.roleId} attemptId={resolvedParams.attemptId} />;
}
