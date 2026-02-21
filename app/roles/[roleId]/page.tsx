"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { RoleDetailPage } from "@/src/components/roles/role-detail-page";

export default function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
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

  return <RoleDetailPage roleId={resolvedParams.roleId} />;
}
