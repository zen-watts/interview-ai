"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/src/lib/utils/cn";

export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showFrame = pathname === "/" || (pathname.startsWith("/roles/") && !pathname.endsWith("/attempts")) || pathname.endsWith("/conclusion");

  return <div className={cn(showFrame && "page-frame")}>{children}</div>;
}
