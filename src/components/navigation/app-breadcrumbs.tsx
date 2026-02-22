"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";

interface Crumb {
  href: string;
  label: string;
}

/**
 * Shared breadcrumb navigation shown in the top-left of the app container.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname();
  const { hydrated, store } = useAppStore();

  const crumbs = useMemo<Crumb[]>(() => {
    const base: Crumb[] = [{ href: "/", label: "Role Dashboard" }];

    if (pathname === "/") {
      return base;
    }

    const segments = pathname.split("/").filter(Boolean);

    if (segments[0] !== "roles") {
      return base;
    }

    const roleId = segments[1];
    if (!roleId) {
      return base;
    }

    const role = store.roles.find((item) => item.id === roleId);
    base.push({
      href: `/roles/${roleId}`,
      label: role?.title || "Role",
    });

    if (segments[2] !== "attempts") {
      return base;
    }

    const attemptId = segments[3];
    if (!attemptId) {
      return base;
    }

    base.push({
      href: `/roles/${roleId}/attempts/${attemptId}`,
      label: "Interview session",
    });

    if (segments[4] === "conclusion") {
      base.push({
        href: `/roles/${roleId}/attempts/${attemptId}/conclusion`,
        label: "Analysis",
      });
    }

    return base;
  }, [pathname, store.roles]);

  const isAnalysisPage = pathname.endsWith("/conclusion");

  const isInterviewActive = pathname.includes("/attempts/") && !pathname.endsWith("/conclusion");

  if (!hydrated || !store.profile || isInterviewActive) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs uppercase tracking-[0.14em] text-paper-muted">Inner View</p>
      <nav
        aria-label="Breadcrumb"
        className="flex min-h-[1.25rem] items-center gap-1 text-xs text-paper-muted opacity-80"
      >
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;

          return (
            <div key={crumb.href} className="flex items-center gap-1">
              {index > 0 ? <span>/</span> : null}
            {isCurrent || (isAnalysisPage && crumb.label === "Interview session") ? (
              <span className="text-paper-softInk">{crumb.label}</span>
            ) : (
                <Link href={crumb.href} className="hover:text-paper-softInk">
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
