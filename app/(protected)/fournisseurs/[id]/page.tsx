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
  ReceiptText,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
import ProductIconDisplay from "@/components/product-icon-display";
import EditSupplierModal from "@/components/edit-supplier-modal";
import InvoiceList from "./invoice-list";
import { cn } from "@/lib/utils";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/**
 * Une donnee de contact : son intitule au-dessus, sa valeur en dessous.
 * Meme forme que la fiche vehicule — les fiches de l'application se lisent
 * toutes pareil.
 */
function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Un chiffre d'achat, secondaire au total. */
function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-xl font-bold tabular-nums leading-none mt-1.5",
          emphasis && "text-attention"
        )}
      >
        {value}
      </p>
    </div>
  );
}

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

  // Produits en alerte en tete : ce sont eux qui motivent une commande.
  // Les archives sont ecartes — un produit retire du catalogue n'a pas a
  // gonfler le nombre de produits lies ni a reclamer un reappro.
  const products = useMemo(() => {
    if (!supplier) return [];
    return supplier.products
      .filter((p) => !p.archived_at)
      .map((p) => {
        const score = calculateStockScore(p.stock_current ?? 0, p.stock_min);
        return { ...p, score, status: getStockBadgeVariant(score) };
      })
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "fr"));
  }, [supplier]);

  const alertProducts = products.filter((p) => (p.stock_current ?? 0) <= (p.stock_min ?? 0));
  const alertCount = alertProducts.length;

  // Commande par mail : le fournisseur a un email et des produits sous leur
  // seuil, mais rien ne permettait d'agir depuis sa fiche — il fallait ouvrir
  // chaque produit un par un. Meme forme de message que la fiche produit.
  const orderMailtoUrl =
    supplier?.email && alertCount > 0
      ? `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(
          "Demande de reapprovisionnement"
        )}&body=${encodeURIComponent(
          [
            "Bonjour,",
            "",
            "Nous souhaiterions passer commande pour les produits suivants :",
            "",
            ...alertProducts.map((p) => {
              const target = Math.max((p.stock_min ?? 0) * 2 - (p.stock_current ?? 0), 1);
              return `- ${p.name} : ${target} unite${target > 1 ? "s" : ""}`;
            }),
            "",
            "Merci de nous confirmer la disponibilite et les delais de livraison.",
            "",
            "Cordialement",
          ].join("\n")
        )}`
      : null;

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
      <div className="space-y-5">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="size-14 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="rounded-xl border bg-card divide-y">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-10 rounded-lg shrink-0" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
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

  const hasContact = !!(supplier.email || supplier.phone || supplier.website_url);

  return (
    <div className="space-y-5 pb-20">
      {/* ── Identite ──
          L'en-tete etait un titre nu suivi d'une ligne de liens gris de meme
          taille : le nom, le mail, le telephone et le site se lisaient au meme
          niveau. Chaque coordonnee porte maintenant son intitule, comme sur la
          fiche vehicule. */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {supplier.logo_url ? (
              <img
                src={supplier.logo_url}
                alt={supplier.name}
                className="size-full object-contain"
              />
            ) : (
              <Truck className="size-6 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <PageHeader
              backLabel="Retour aux fournisseurs"
              title={supplier.name}
              subtitle={
                <p className="text-sm text-muted-foreground mt-0.5">
                  {products.length} produit{products.length > 1 ? "s" : ""} au catalogue
                </p>
              }
              actions={
                <>
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
                </>
              }
            />
          </div>
        </div>

        {hasContact ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3">
            {supplier.email && (
              <Field icon={Mail} label="Email">
                <a href={`mailto:${supplier.email}`} className="hover:underline underline-offset-2">
                  {supplier.email}
                </a>
              </Field>
            )}
            {supplier.phone && (
              <Field icon={Phone} label="Téléphone">
                <a
                  href={`tel:${phoneHref(supplier.phone)}`}
                  className="hover:underline underline-offset-2 tabular-nums"
                >
                  {formatPhone(supplier.phone)}
                </a>
              </Field>
            )}
            {supplier.website_url && (
              <Field icon={Globe} label="Site web">
                <a
                  href={supplier.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline underline-offset-2"
                >
                  {supplier.website_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </Field>
            )}
          </dl>
        ) : (
          // Un fournisseur sans coordonnees ne se commande pas : le dire
          // plutot que de laisser un blanc qui ressemble a un chargement.
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Aucune coordonnée enregistrée.{" "}
              <button
                onClick={() => setEditOpen(true)}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                En ajouter
              </button>
            </p>
          </div>
        )}
      </div>

      {/* ── Achats ──
          Les quatre chiffres etaient de meme taille, dont une date rendue en
          `tabular-nums` comme s'il s'agissait d'un montant. Le total d'achat
          domine desormais, le reste le complete. */}
      <div className="rounded-xl border bg-card px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Acheté au total
            </p>
            <p className="font-heading text-4xl font-bold tabular-nums leading-none mt-2">
              {stats && stats.total_purchased > 0 ? fmtPrice(stats.total_purchased) : "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <Stat
              label="Dernier achat"
              value={
                /* Tant que les stats chargent, un tiret : afficher « Jamais »
                   affirmerait une absence d'achat qu'on ne connait pas encore. */
                !stats ? "—" : stats.last_purchase_at ? fmtDate(stats.last_purchase_at) : "Jamais"
              }
            />
            <Stat
              label="Factures"
              value={
                stats ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ReceiptText className="size-4 text-muted-foreground" />
                    {stats.invoice_count}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Stat label="À réapprovisionner" value={alertCount} emphasis={alertCount > 0} />
          </div>
        </div>
      </div>

      {/* ── Appel a commander ──
          La fiche listait des produits sous leur seuil sans permettre d'agir :
          il fallait ouvrir chaque produit pour ecrire au fournisseur. */}
      {alertCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-attention/30 bg-attention-bg/30 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <TriangleAlert className="size-5 text-attention shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-heading font-semibold text-sm">
                {alertCount} produit{alertCount > 1 ? "s" : ""} sous le seuil
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {alertProducts
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(", ")}
                {alertCount > 3 && ` et ${alertCount - 3} autre${alertCount - 3 > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {orderMailtoUrl ? (
            <Button size="sm" asChild className="shrink-0">
              <a href={orderMailtoUrl}>
                <ShoppingCart className="mr-2 size-3.5" />
                Commander
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
              className="shrink-0 bg-white dark:bg-card"
              title="Aucun email enregistré pour ce fournisseur"
            >
              <Mail className="mr-2 size-3.5" />
              Ajouter un email
            </Button>
          )}
        </div>
      )}

      {/* ── Produits ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-heading font-semibold text-sm">Produits</h2>
          {products.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {products.length} référence{products.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border bg-card">
            <Package className="size-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun produit lié à ce fournisseur.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {/* En-tete : sans lui, « 12 / 20 » se devine */}
            <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Produit</span>
              <span className="w-20 text-right shrink-0">Stock / min</span>
              <span className="w-[86px] text-right shrink-0">Statut</span>
            </div>

            {products.map((product) => {
              const current = product.stock_current ?? 0;
              const min = product.stock_min ?? 0;
              const inAlert = current <= min;

              // Jauge : la cible est deux fois le seuil, comme sur la fiche
              // produit. L'echelle couvre toujours le stock reel, sinon un
              // stock confortable saturerait la barre.
              const target = min > 0 ? Math.max(min * 2, current) : Math.max(current, 1);
              const fillPct = Math.min(100, Math.round((current / target) * 100));

              return (
                <Link
                  key={product.id}
                  href={`/produits/${product.id}`}
                  className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  {/* L'icone du produit : partout ailleurs dans l'application
                      un produit se reconnait a son visuel, cette liste seule
                      l'affichait en texte nu. */}
                  <ProductIconDisplay
                    iconName={product.icon_name}
                    iconColor={product.icon_color}
                    imageUrl={product.image_url}
                    size="md"
                    className="shrink-0"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {inAlert && <TriangleAlert className="size-3.5 text-attention shrink-0" />}
                      <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {product.name}
                      </span>
                    </span>
                    {/* Barre de niveau : le rapport stock/seuil se lit d'un
                        coup d'oeil, sans comparer deux nombres ligne a ligne. */}
                    <span className="mt-1.5 block h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          product.status === "critique"
                            ? "bg-critique"
                            : product.status === "attention"
                              ? "bg-attention"
                              : "bg-standard"
                        )}
                        style={{ width: `${fillPct}%` }}
                      />
                    </span>
                  </span>

                  {/* Stock sur son minimum : le chiffre seul ne dit pas s'il est bas.
                      Colonnes de largeur fixe pour que les valeurs et les pastilles
                      s'alignent verticalement d'une ligne a l'autre. */}
                  <span className="w-20 text-right tabular-nums shrink-0">
                    <span
                      className={cn("font-heading font-bold text-sm", inAlert && "text-attention")}
                    >
                      {current}
                    </span>
                    <span className="text-xs text-muted-foreground"> / {min}</span>
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

      {/* ── Factures ──
          Une facture appartient au fournisseur, pas au produit : elle couvre
          plusieurs entrees de stock. La table et le bucket existaient depuis
          juillet sans qu'aucun ecran ne permette d'en enregistrer une. */}
      <InvoiceList supplierId={id} supplierName={supplier.name} />

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
