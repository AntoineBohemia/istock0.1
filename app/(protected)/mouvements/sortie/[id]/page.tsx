import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import ReverseMovementButton from "../../reverse-movement-button";
import {
  Upload01,
  Download01,
  Package,
  User01,
  UserX01,
  Image01,
  ArrowRight,
  Building01,
  Tool01,
} from "@untitled-ui/icons-react";
import { generateMeta, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/supabase/queries/stock-movements";
import { MovementTypePill } from "@/components/movement-type-pill";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * Cette page recoit tous les mouvements sauf les entrees — y compris
 * l'outillage. Sans configuration dediee, une assignation ou un retour d'outil
 * retombait sur exit_anonymous et s'affichait « Erreur stock », avec un titre
 * « Sortie de stock » et un signe negatif — alors qu'un retour REMET du stock.
 *
 * Chaque type porte donc son propre libelle, son titre et son sens.
 */
const MOVEMENT_CONFIG: Record<
  string,
  {
    title: string;
    variant: "info" | "secondary" | "destructive" | "success";
    icon: React.ReactNode;
    /** true si le mouvement remet du stock */
    isPositive: boolean;
  }
> = {
  exit_technician: {
    title: "Sortie de stock",
    variant: "info",
    icon: <User01 className="size-4" />,
    isPositive: false,
  },
  exit_anonymous: {
    title: "Sortie de stock",
    variant: "secondary",
    icon: <UserX01 className="size-4" />,
    isPositive: false,
  },
  exit_loss: {
    title: "Sortie de stock",
    variant: "secondary",
    icon: <UserX01 className="size-4" />,
    isPositive: false,
  },
  assign_equipment: {
    title: "Assignation d'outil",
    variant: "info",
    icon: <Tool01 className="size-4" />,
    isPositive: false,
  },
  unassign_equipment: {
    title: "Retour d'outil",
    variant: "success",
    icon: <Tool01 className="size-4" />,
    isPositive: true,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return generateMeta({
    title: "Détail de la sortie",
    description: "Détails du mouvement de sortie de stock",
    canonical: `/orders/outcome/${id}`,
  });
}

async function getMovement(id: string) {
  const supabase = await createClient();

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .select(
      `
      *,
      product:products(id, name, sku, image_url, price, stock_current),
      technician:technicians(id, first_name, last_name, email, city),
      organization:organizations(id, name)
    `
    )
    .eq("id", id)
    .neq("movement_type", "entry")
    .single();

  if (error || !movement) {
    return null;
  }

  // Ce mouvement a-t-il deja ete annule ?
  // Somme des corrections deja passees : une correction peut etre partielle,
  // le solde restant depend donc du cumul, pas de leur simple existence.
  const { data: reversals } = await supabase
    .from("stock_movements")
    .select("quantity")
    .eq("reverses_movement_id", id);
  const alreadyReversed = (reversals ?? []).reduce((s, r) => s + r.quantity, 0);

  const product = Array.isArray(movement.product) ? movement.product[0] : movement.product;
  const technician = Array.isArray(movement.technician)
    ? movement.technician[0]
    : movement.technician;
  const orgRaw = (movement as Record<string, unknown>).organization;
  const organization = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { name: string } | null;

  // Qui a saisi la sortie — un membre de l'organisation, jamais le technicien
  // destinataire : le premier decide, le second recoit.
  let author: { display_name: string | null; email: string | null } | null = null;
  const createdBy = (movement as Record<string, unknown>).created_by as string | null;
  if (createdBy) {
    const { data } = await supabase
      .from("organization_members_view")
      .select("display_name, email")
      .eq("user_id", createdBy)
      .limit(1)
      .maybeSingle();
    author = data ?? null;
  }

  return { ...movement, product, technician, organization, author, alreadyReversed };
}

export default async function OutcomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movement = await getMovement(id);

  if (!movement) {
    notFound();
  }

  const exitDate = new Date(movement.created_at ?? 0);
  const exitType = movement.movement_type as string;
  const config = MOVEMENT_CONFIG[exitType] ?? MOVEMENT_CONFIG.exit_anonymous;
  // Une sortie n'enregistre pas de prix : on valorise au tarif actuel du
  // produit, ce qui reste une estimation — le libelle le dit.
  const unitPrice = movement.product?.price || 0;
  const netQuantity = movement.quantity - movement.alreadyReversed;
  const totalValue = unitPrice * netQuantity;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton label="Retour aux mouvements" className="shrink-0 -ml-2" />
          <div>
            <div className="flex items-center gap-2.5">
              {config.isPositive ? (
                <Download01 className="size-5 text-standard shrink-0" />
              ) : (
                <Upload01 className="size-5 text-critique shrink-0" />
              )}
              <h1 className="font-heading text-2xl font-bold tracking-tight">{config.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {exitDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              à{" "}
              {exitDate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <ReverseMovementButton
          movementId={movement.id}
          kind="sortie"
          productName={movement.product?.name ?? "ce produit"}
          quantity={movement.quantity}
          alreadyReversed={movement.alreadyReversed}
          disabledReason={
            // L'outillage a ses propres operations d'assignation et de retour :
            // la fonction en base les refuse. Le bouton doit le dire avant le
            // clic, pas apres.
            exitType === "assign_equipment" || exitType === "unassign_equipment"
              ? "Les mouvements d'outillage se corrigent depuis la fiche de l'outil"
              : movement.reverses_movement_id
                ? "Ce mouvement est une correction"
                : movement.alreadyReversed >= movement.quantity
                  ? "Ce mouvement a déjà été entièrement corrigé"
                  : null
          }
        />
      </div>

      {/* Effet reel du mouvement — voir la fiche d'entree pour le detail du
           raisonnement : le grand chiffre porte la quantite nette. */}
      <div className="rounded-xl border bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={cn(
                "font-heading text-5xl font-bold tabular-nums leading-none block",
                config.isPositive ? "text-standard" : "text-critique"
              )}
            >
              {config.isPositive ? "+" : "−"}
              {netQuantity}
            </span>
            <p className="text-sm text-muted-foreground mt-2">
              {config.isPositive
                ? `unité${netQuantity > 1 ? "s" : ""} remise${netQuantity > 1 ? "s" : ""} en stock`
                : `unité${netQuantity > 1 ? "s" : ""} retirée${netQuantity > 1 ? "s" : ""} du stock`}
            </p>
          </div>
          <MovementTypePill type={exitType} className="text-sm shrink-0" />
        </div>

        {movement.alreadyReversed > 0 && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {movement.quantity} saisie{movement.quantity > 1 ? "s" : ""} à l&apos;origine,{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {movement.alreadyReversed}
            </span>{" "}
            corrigée{movement.alreadyReversed > 1 ? "s" : ""} depuis
          </p>
        )}
      </div>

      {/* Détails */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
            Détails du mouvement
          </p>
        </div>
        <div className="divide-y text-sm">
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Type de mouvement</span>
            <span className="font-medium flex items-center gap-1.5">
              {config.icon}
              {MOVEMENT_TYPE_LABELS[exitType as MovementType] ?? exitType}
            </span>
          </div>
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Quantité</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                config.isPositive ? "text-standard" : "text-critique"
              )}
            >
              {config.isPositive ? "+" : "−"}
              {netQuantity} unité{netQuantity > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Prix unitaire</span>
            <span className="font-semibold tabular-nums">
              {unitPrice
                ? unitPrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                : "—"}
            </span>
          </div>
          {/* Societe : la liste a une colonne « Societe », la fiche l'ignorait */}
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Building01 className="size-3.5" />
              Société
            </span>
            <span className="font-medium">{movement.organization?.name || "Non spécifiée"}</span>
          </div>
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Valeur estimée</span>
            <span className="font-semibold tabular-nums text-critique">
              {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </span>
          </div>
          {/* Le motif, quand il a été saisi. « Erreur de stock » nomme la
              nature du mouvement, jamais sa cause : sans cette ligne, une
              sortie de deux unités ne s'explique plus six mois après. */}
          {movement.note && (
            <div className="flex justify-between gap-6 px-5 py-2.5">
              <span className="shrink-0 text-muted-foreground">Motif</span>
              <span className="text-right font-medium whitespace-pre-line">{movement.note}</span>
            </div>
          )}
          {/* Qui a saisi la sortie — pas le technicien qui la reçoit. Le
              destinataire est plus bas ; ici, c'est l'auteur du geste. */}
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User01 className="size-3.5" />
              Réalisé par
            </span>
            <span className="font-medium">
              {movement.author?.display_name || movement.author?.email || "Non enregistré"}
            </span>
          </div>
        </div>
      </div>

      {/* Technicien */}
      {movement.technician && exitType === "exit_technician" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
              <User01 className="size-3.5" />
              Technicien
            </p>
          </div>
          <Link
            href={`/techniciens/${movement.technician.id}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 group"
          >
            <Avatar className="size-10 shrink-0">
              <AvatarFallback>
                {movement.technician.first_name[0]}
                {movement.technician.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {movement.technician.first_name} {movement.technician.last_name}
              </p>
              <p className="text-sm text-muted-foreground truncate">{movement.technician.email}</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </Link>
        </div>
      )}

      {/* Produit concerné */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
            <Package className="size-3.5" />
            Produit sorti
          </p>
        </div>
        {movement.product && (
          <Link
            href={`/produits/${movement.product.id}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 group"
          >
            <figure className="flex size-14 items-center justify-center rounded-lg border bg-muted shrink-0">
              {movement.product.image_url ? (
                <Image
                  src={movement.product.image_url}
                  width={56}
                  height={56}
                  alt={movement.product.name}
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                <Image01 className="size-6 text-muted-foreground" />
              )}
            </figure>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{movement.product.name}</p>
              {movement.product.sku && (
                <p className="text-xs text-muted-foreground font-mono">{movement.product.sku}</p>
              )}
            </div>
            {/* Stock actuel : deja charge par la requete, il n'etait affiche
                nulle part. C'est pourtant le contexte du mouvement. */}
            <div className="text-right shrink-0">
              <p className="font-heading text-lg font-bold tabular-nums leading-none">
                {movement.product.stock_current ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">en stock</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
