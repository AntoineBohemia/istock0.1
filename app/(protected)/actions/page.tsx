"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";

import { toast } from "@/lib/toast";
import { useOrganizationStore } from "@/lib/stores/organization-store";

const ActionsMobileSheet = dynamic(() => import("./actions-mobile-sheet"), { ssr: false });

/** Où atterrit un owner/admin qui arrive sur /actions depuis un grand écran. */
const DESKTOP_FALLBACK = "/produits";

// ─── Composant principal ────────────────────────────────────
// Les Actions rapides sont un écran mobile uniquement.
// Sur desktop : owner/admin sont renvoyés vers l'inventaire,
// les membres (accès restreint à /actions) voient un rappel.
export default function ActionsPage() {
  const router = useRouter();
  const role = useOrganizationStore((s) => s.currentOrganization?.role);
  const isOrgLoading = useOrganizationStore((s) => s.isLoading);

  // Message de bienvenue si on arrive depuis l'acceptation d'une invitation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invited") === "true") {
      toast.success("Bienvenue ! Votre invitation a été acceptée.");
      window.history.replaceState({}, "", "/actions");
    }
  }, []);

  // Desktop + rôle non restreint → l'écran n'existe plus, on redirige
  useEffect(() => {
    if (isOrgLoading || !role || role === "member") return;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    router.replace(DESKTOP_FALLBACK);
  }, [isOrgLoading, role, router]);

  return (
    <>
      {/* ═══════ MOBILE ═══════ */}
      <div className="md:hidden">
        <ActionsMobileSheet />
      </div>

      {/* ═══════ DESKTOP ═══════ */}
      <div
        className="hidden md:flex items-center justify-center"
        style={{ height: "calc(100vh - 6rem)" }}
      >
        {role === "member" && (
          <div className="max-w-sm rounded-lg border bg-card px-8 py-10 text-center">
            <Smartphone className="size-10 mx-auto text-muted-foreground opacity-30" />
            <h2 className="font-heading text-xl font-semibold mt-5">Écran mobile</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Les entrées et sorties de stock se font depuis un téléphone. Ouvrez iStock sur votre
              mobile pour enregistrer un mouvement.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
