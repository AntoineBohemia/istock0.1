import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import ReverseMovementButton from "../../reverse-movement-button";
import {
  Download01,
  Package,
  Truck01,
  Building01,
  Image01,
  ArrowRight,
  File06,
} from "@untitled-ui/icons-react";
import { generateMeta } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { MovementTypePill } from "@/components/movement-type-pill";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return generateMeta({
    title: "Détail de l'entrée",
    description: "Détails du mouvement d'entrée de stock",
    canonical: `/orders/income/${id}`,
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
      supplier:suppliers(id, name, website_url),
      organization:organizations(id, name)
    `
    )
    .eq("id", id)
    .eq("movement_type", "entry")
    .single();

  if (error || !movement) {
    return null;
  }

  // Ce mouvement a-t-il deja ete annule, ou est-il lui-meme une correction ?
  // Somme des corrections deja passees : une correction peut etre partielle,
  // le solde restant depend donc du cumul, pas de leur simple existence.
  const { data: reversals } = await supabase
    .from("stock_movements")
    .select("quantity")
    .eq("reverses_movement_id", id);
  const alreadyReversed = (reversals ?? []).reduce((s, r) => s + r.quantity, 0);

  const product = Array.isArray(movement.product) ? movement.product[0] : movement.product;
  const orgRaw = (movement as Record<string, unknown>).organization;
  const organization = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { name: string } | null;
  return { ...movement, product, organization, alreadyReversed } as typeof movement & {
    product: typeof product;
    organization: typeof organization;
    invoice_reference: string | null;
    alreadyReversed: number;
  };
}

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movement = await getMovement(id);

  if (!movement) {
    notFound();
  }

  const entryDate = new Date(movement.created_at ?? 0);
  const unitPrice = movement.unit_price ?? movement.product?.price ?? 0;
  // Quantite nette : une entree corrigee ne vaut plus sa quantite d'origine.
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
              <Download01 className="size-5 text-standard shrink-0" />
              <h1 className="font-heading text-2xl font-bold tracking-tight">Entrée de stock</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {entryDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              à{" "}
              {entryDate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <ReverseMovementButton
          movementId={movement.id}
          kind="entrée"
          productName={movement.product?.name ?? "ce produit"}
          quantity={movement.quantity}
          alreadyReversed={movement.alreadyReversed}
          disabledReason={
            movement.reverses_movement_id
              ? "Ce mouvement est une correction"
              : movement.alreadyReversed >= movement.quantity
                ? "Ce mouvement a déjà été entièrement corrigé"
                : null
          }
        />
      </div>

      {/* Effet reel du mouvement.
           Le grand chiffre porte la quantite NETTE, pas celle saisie : sur une
           entree corrigee, afficher « +40 » alors que le stock n'a bouge que de
           4 donnait deux verites contradictoires sur le meme ecran.
           Couleurs issues du systeme (standard / critique) comme la liste, et
           non des teintes Tailwind brutes qui ne suivent pas le theme. */}
      <div className="rounded-xl border bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-heading text-5xl font-bold tabular-nums leading-none block text-standard">
              +{netQuantity}
            </span>
            <p className="text-sm text-muted-foreground mt-2">
              unité{netQuantity > 1 ? "s" : ""} ajoutée{netQuantity > 1 ? "s" : ""} au stock
            </p>
          </div>
          <MovementTypePill type="entry" className="text-sm shrink-0" />
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
            <span className="text-muted-foreground">Quantité</span>
            <span className="font-semibold tabular-nums text-standard">
              +{netQuantity} unité{netQuantity > 1 ? "s" : ""}
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
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Valeur totale</span>
            <span className="font-semibold tabular-nums text-standard">
              {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
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
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Truck01 className="size-3.5" />
              Fournisseur
            </span>
            <span className="font-medium">{movement.supplier?.name || "Non spécifié"}</span>
          </div>
          {/* Le numero saisi a l'entree, tel quel. Il n'y a plus de facture a
              rattacher : ce champ est la seule trace du document d'achat. */}
          {movement.invoice_reference && (
            <div className="flex justify-between px-5 py-2.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <File06 className="size-3.5" />
                N&deg; de facture
              </span>
              <span className="font-medium">{movement.invoice_reference}</span>
            </div>
          )}
        </div>
      </div>

      {/* Produit concerné */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
            <Package className="size-3.5" />
            Produit réapprovisionné
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
