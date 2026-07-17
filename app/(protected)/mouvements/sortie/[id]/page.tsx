import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Upload01,
  Package,
  User01,
  UserX01,
  Image01,
  ArrowRight,
} from "@untitled-ui/icons-react";
import { generateMeta } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const EXIT_TYPE_CONFIG: Record<
  string,
  { label: string; variant: "info" | "secondary" | "destructive"; icon: React.ReactNode }
> = {
  exit_technician: {
    label: "Sortie technicien",
    variant: "info",
    icon: <User01 className="size-4" />,
  },
  exit_anonymous: {
    label: "Erreur stock",
    variant: "secondary",
    icon: <UserX01 className="size-4" />,
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
      technician:technicians(id, first_name, last_name, email, city)
    `
    )
    .eq("id", id)
    .neq("movement_type", "entry")
    .single();

  if (error || !movement) {
    return null;
  }

  const product = Array.isArray(movement.product) ? movement.product[0] : movement.product;
  const technician = Array.isArray(movement.technician)
    ? movement.technician[0]
    : movement.technician;

  return { ...movement, product, technician };
}

export default async function OutcomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movement = await getMovement(id);

  if (!movement) {
    notFound();
  }

  const exitDate = new Date(movement.created_at ?? 0);
  const exitType = movement.movement_type as string;
  const config = EXIT_TYPE_CONFIG[exitType] || EXIT_TYPE_CONFIG.exit_anonymous;
  const unitPrice = movement.product?.price || 0;
  const totalValue = unitPrice * movement.quantity;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2" aria-label="Retour aux mouvements">
            <Link href="/mouvements">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <Upload01 className="size-5 text-red-600 shrink-0" />
              <h1 className="font-heading text-2xl font-bold tracking-tight">Sortie de stock</h1>
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
      </div>

      {/* Hero — quantité sortie */}
      <div className="rounded-xl border bg-card px-6 py-5 flex items-end justify-between gap-4">
        <div>
          <span className="font-heading text-5xl font-bold tabular-nums leading-none block text-red-600">
            -{movement.quantity}
          </span>
          <p className="text-sm text-muted-foreground mt-2">
            unité{movement.quantity > 1 ? "s" : ""} retirée{movement.quantity > 1 ? "s" : ""} du
            stock
          </p>
        </div>
        <Badge variant={config.variant} className="text-sm">
          {config.label}
        </Badge>
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
            <span className="text-muted-foreground">Type de sortie</span>
            <span className="font-medium flex items-center gap-1.5">
              {config.icon}
              {config.label}
            </span>
          </div>
          <div className="flex justify-between px-5 py-2.5">
            <span className="text-muted-foreground">Quantité</span>
            <span className="font-semibold tabular-nums text-red-600">
              -{movement.quantity} unités
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
            <span className="text-muted-foreground">Valeur sortie</span>
            <span className="font-semibold tabular-nums text-red-600">
              {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
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
            <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
