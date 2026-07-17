"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";

const MEMBER_ALLOWED_PREFIXES = ["/actions"] as const;
const MEMBER_REDIRECT_TO = "/actions";

export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentOrganization, isLoading } = useOrganizationStore();

  useEffect(() => {
    if (isLoading) return;
    if (!currentOrganization) return;
    if (currentOrganization.role !== "member") return;

    const allowed = MEMBER_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );

    if (!allowed) {
      router.replace(MEMBER_REDIRECT_TO);
    }
  }, [pathname, currentOrganization, isLoading, router]);

  return <>{children}</>;
}
