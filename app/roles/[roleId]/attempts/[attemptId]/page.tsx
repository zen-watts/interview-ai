"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InterviewAttemptPage } from "@/src/components/interview/interview-attempt-page";
import { useAppStore } from "@/src/components/providers/app-store-provider";

export default function AttemptPage({
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

  return <InterviewAttemptPage roleId={resolvedParams.roleId} attemptId={resolvedParams.attemptId} />;
}
