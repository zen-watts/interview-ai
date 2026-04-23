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
  const isInterviewSessionRoute = /^\/roles\/[^/]+\/attempts\/[^/]+$/.test(pathname);
  const isRoleDashboardRoute = pathname === "/";
  const isInterviewDashboardRoute = /^\/roles\/[^/]+$/.test(pathname);
  const showProfileLink = isRoleDashboardRoute || isInterviewDashboardRoute;

  const crumbs = useMemo<Crumb[]>(() => {
    const base: Crumb[] = [{ href: "/", label: "Roles" }];

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

    base.push({
      href: `/roles/${roleId}`,
      label: "Interview Dashboard",
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
  }, [pathname]);

  const isAnalysisPage = pathname.endsWith("/conclusion");

  if (!hydrated || !store.profile || isInterviewSessionRoute) {
    return null;
  }

  return (
    <div className="mb-4 flex min-h-[1.25rem] items-start justify-between gap-4">
      {pathname === "/" ? <div /> : (
        <nav
          aria-label="Breadcrumb"
          className="flex min-h-[1.25rem] items-center gap-1 text-sm text-paper-muted opacity-95"
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
      )}
      {showProfileLink ? (
        <Link
          href="/profile"
          className="font-sans text-xs uppercase tracking-[0.16em] text-paper-softInk hover:text-paper-ink"
        >
          Edit Profile
        </Link>
      ) : null}
    </div>
  );
}
