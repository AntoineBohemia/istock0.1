"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Globe,
  Mail,
  Package,
  Pencil,
  Phone,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSupplier, useSuppliersWithStats } from "@/hooks/queries/use-suppliers";
import { useDeleteSupplier } from "@/hooks/mutations";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { formatPhone, phoneHref } from "@/lib/utils/phone";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import { Skeleton } from "@/components/ui/skeleton";
import EditSupplierModal from "@/components/edit-supplier-modal";
import { cn } from "@/lib/utils";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  const { data: supplier, isLoading } = useSupplier(id);
  // Meme requete que la liste : le cache est partage, pas de second appel
  // quand on arrive depuis la page Fournisseurs.
  const { data: allStats = [] } = useSuppliersWithStats(orgId);
  const stats = allStats.find((s) => s.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteSupplier();

  // Produits en alerte en tete : ce sont eux qui motivent une commande
  const products = useMemo(() => {
    if (!supplier) return [];
    return [...supplier.products]
      .map((p) => {
        const score = calculateStockScore(p.stock_current ?? 0, p.stock_min);
        return { ...p, score, status: getStockBadgeVariant(score) };
      })
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "fr"));
  }, [supplier]);

  const alertCount = products.filter((p) => (p.stock_current ?? 0) <= (p.stock_min ?? 0)).length;

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Fournisseur supprimé");
        setDeleteOpen(false);
        router.push("/fournisseurs");
      },
      onError: (err) => {
        // Le garde-fou cote requete refuse la suppression si des produits
        // referencent encore ce fournisseur : on relaie le message tel quel.
        toast.error(err instanceof Error ? err.message : "Erreur");
        setDeleteOpen(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="rounded-xl border bg-card divide-y">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-36" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Truck className="size-14 text-muted-foreground/20 mb-4" />
        <h2 className="font-heading font-semibold text-lg">Fournisseur introuvable</h2>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/fournisseurs">
            <ChevronLeft className="size-4 mr-1" />
            Retour
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Retour — un lien, pas router.back() : en arrivant par une URL directe,
          l'historique renvoie hors de l'application. */}
      <Link
        href="/fournisseurs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-4" />
        Fournisseurs
      </Link>

      {/* En-tete */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {supplier.logo_url ? (
              <img src={supplier.logo_url} alt="" className="size-full object-contain" />
            ) : (
              <Truck className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {supplier.email && (
                <a
                  href={`mailto:${supplier.email}`}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <Mail className="size-3.5" />
                  {supplier.email}
                </a>
              )}
              {supplier.phone && (
                <a
                  href={`tel:${phoneHref(supplier.phone)}`}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <Phone className="size-3.5" />
                  {formatPhone(supplier.phone)}
                </a>
              )}
              {supplier.website_url && (
                <a
                  href={supplier.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <Globe className="size-3.5" />
                  Site web
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="bg-white dark:bg-card"
          >
            <Pencil className="mr-2 size-3.5" />
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="bg-white dark:bg-card text-muted-foreground hover:text-destructive"
            title="Supprimer ce fournisseur"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Chiffres d'achat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border bg-card p-4">
        <div>
          <p className="font-heading text-xl font-bold tabular-nums leading-none">
            {stats && stats.total_purchased > 0 ? fmtPrice(stats.total_purchased) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">acheté au total</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold tabular-nums leading-none">
            {/* Tant que les stats chargent, un tiret : afficher « Jamais »
                affirmerait une absence d'achat qu'on ne connait pas encore. */}
            {!stats ? "—" : stats.last_purchase_at ? fmtDate(stats.last_purchase_at) : "Jamais"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">dernier achat</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold tabular-nums leading-none">
            {products.length}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            produit{products.length > 1 ? "s" : ""} lié{products.length > 1 ? "s" : ""}
          </p>
        </div>
        <div>
          <p
            className={cn(
              "font-heading text-xl font-bold tabular-nums leading-none",
              alertCount > 0 && "text-attention"
            )}
          >
            {alertCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">à réapprovisionner</p>
        </div>
      </div>

      {/* Produits */}
      <div>
        <h2 className="font-heading font-semibold text-sm mb-2">Produits</h2>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border bg-card">
            <Package className="size-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun produit lié à ce fournisseur.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {/* En-tete : sans lui, « 12 / 20 » se devine */}
            <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-medium text-muted-foreground">
              <span className="flex-1">Produit</span>
              <span className="w-20 text-right shrink-0">Stock / min</span>
              <span className="w-[86px] text-right shrink-0">Statut</span>
            </div>
            {products.map((product) => {
              const inAlert = (product.stock_current ?? 0) <= (product.stock_min ?? 0);
              return (
                <Link
                  key={product.id}
                  href={`/produits/${product.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    {inAlert && <TriangleAlert className="size-3.5 text-attention shrink-0" />}
                    <span className="text-sm font-medium truncate">{product.name}</span>
                  </span>

                  {/* Stock sur son minimum : le chiffre seul ne dit pas s'il est bas.
                      Colonnes de largeur fixe pour que les valeurs et les pastilles
                      s'alignent verticalement d'une ligne a l'autre. */}
                  <span className="w-20 text-right tabular-nums shrink-0">
                    <span
                      className={cn("font-heading font-bold text-sm", inAlert && "text-attention")}
                    >
                      {product.stock_current ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / {product.stock_min ?? 0}
                    </span>
                  </span>

                  <span className="w-[86px] flex justify-end shrink-0">
                    <StatusPill status={product.status} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <EditSupplierModal supplier={supplier} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le fournisseur</AlertDialogTitle>
            <AlertDialogDescription>
              {products.length > 0 ? (
                <>
                  {supplier.name} est lié à {products.length} produit
                  {products.length > 1 ? "s" : ""}. La suppression sera refusée tant que ces
                  produits le référencent.
                </>
              ) : (
                <>Supprimer &quot;{supplier.name}&quot; ? Cette action est irréversible.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
