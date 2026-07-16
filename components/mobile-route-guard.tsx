"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";

/** Routes allowed on mobile — all others redirect to /actions */
const MOBILE_ALLOWED = ["/actions", "/parametres", "/invite"];

export function MobileRouteGuard() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isMobile) return;
    const allowed = MOBILE_ALLOWED.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (!allowed) {
      router.replace("/actions");
    }
  }, [isMobile, pathname, router]);

  return null;
}
