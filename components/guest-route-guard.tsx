"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export const GUEST_BLOCKED_PREFIXES = ["/actions", "/parametres"] as const;
export const GUEST_REDIRECT_TO = "/techniciens";

export function shouldBlockGuestRoute(
  role: string | undefined,
  pathname: string
): boolean {
  if (role !== "guest") return false;
  return GUEST_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function GuestRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentOrganization, isLoading } = useOrganizationStore();

  useEffect(() => {
    if (isLoading) return;
    if (!currentOrganization) return;
    if (shouldBlockGuestRoute(currentOrganization.role, pathname)) {
      router.replace(GUEST_REDIRECT_TO);
    }
  }, [pathname, currentOrganization, isLoading, router]);

  return <>{children}</>;
}
