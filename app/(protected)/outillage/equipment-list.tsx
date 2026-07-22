"use client";

import { useMemo, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { Wrench, AlertTriangle, Archive, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HeroNumber } from "@/components/ui/hero-number";

import { EquipmentProduct } from "@/lib/supabase/queries/equipment";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useEquipmentProducts } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

import CreateEquipmentDialog from "./create-equipment-dialog";
import EditEquipmentDialog from "./edit-equipment-dialog";
import EquipmentManageModal from "./equipment-manage-modal";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// ── Alert detection — surfaces CD8 on main view ──

type AlertLevel = "none" | "warning" | "danger";

function getCardAlert(product: EquipmentProduct): AlertLevel {
  let worst: AlertLevel = "none";
  for (const a of product.assignments) {
    const days = Math.floor((Date.now() - new Date(a.assigned_at).getTime()) / 86_400_000);
    if (days >= 365) return "danger";
    if (days >= 180) worst = "warning";
  }
  return worst;
}

const alertDotClass: Record<AlertLevel, string> = {
  none: "",
  warning: "bg-attention",
  danger: "bg-destructive",
};

// ── Tri ──
// Le sélecteur de tri a été retiré de l'interface : la liste est triée par nom.

function sortEquipmentByName(items: EquipmentProduct[]): EquipmentProduct[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export default function EquipmentList() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();

  const [{ search, outil }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(""),
    // ?outil=<id> ouvre directement la fiche : la page Achats renvoie ici pour
    // un outil, sa fiche produit parlant de seuil et de reapprovisionnement.
    outil: parseAsString.withDefault(""),
  });

  // Vue « archives » : sans elle, archiver un outil etait sans retour.
  const [showArchived, setShowArchived] = useState(false);

  const {
    data: equipment = [],
    isLoading,
    isError,
    refetch,
  } = useEquipmentProducts({
    organizationId: currentOrganization?.id,
    search: search || undefined,
    archived: showArchived,
  });

  const [manageProduct, setManageProduct] = useState<EquipmentProduct | null>(null);
  const [editProduct, setEditProduct] = useState<EquipmentProduct | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // L'outil demande par l'URL peut ne pas etre encore charge : on attend la
  // liste plutot que d'ouvrir une fiche vide.
  const [openedFromUrl, setOpenedFromUrl] = useState("");
  if (outil && outil !== openedFromUrl) {
    const target = equipment.find((e) => e.id === outil);
    if (target) {
      setOpenedFromUrl(outil);
      setManageProduct(target);
    }
  }

  const sorted = useMemo(() => {
    const list = onlyAlerts ? equipment.filter((e) => getCardAlert(e) !== "none") : equipment;
    return sortEquipmentByName(list);
  }, [equipment, onlyAlerts]);

  // ── Fleet stats ──
  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let alertCount = 0;
    for (const e of equipment) {
      totalUnits += (e.stock_current ?? 0) + e.total_assigned;
      totalValue += (e.price ?? 0) * ((e.stock_current ?? 0) + e.total_assigned);
      if (getCardAlert(e) !== "none") alertCount++;
    }
    return { totalUnits, totalValue, alertCount };
  }, [equipment]);

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <QueryError message="Impossible de charger l'outillage." onRetry={() => refetch()} />;
  }

  const totalCount = equipment.length;

  return (
    <div className="space-y-4">
      {/* ── Recherche et totaux sur une seule ligne ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => setQueryStates({ search: v || null })}
          placeholder="Rechercher un outil..."
          className="bg-white dark:bg-card"
          wrapperClassName="flex-1"
        />

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] shrink-0",
            showArchived
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
          )}
        >
          <Archive className="size-3.5" />
          Archivés
        </button>

        {totalCount > 0 && (
          <div className="flex items-center gap-4 shrink-0">
            {/* En vue « Archivés », ce total ne compte pas le parc en service :
                l'annoncer comme « unités » tout court le ferait passer pour le
                stock courant, alors qu'il porte sur des fiches retirées. */}
            <span className="flex items-center gap-2 text-sm">
              {showArchived ? (
                <Archive className="size-4 text-muted-foreground" />
              ) : (
                <Wrench className="size-4 text-muted-foreground" />
              )}
              <span>
                <span className="font-semibold tabular-nums">{stats.totalUnits}</span>{" "}
                {showArchived ? "unités archivées" : "unités"}
                {stats.totalValue > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    {" · "}
                    {fmtPrice(stats.totalValue)}
                  </span>
                )}
              </span>
            </span>
            {stats.alertCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyAlerts((v) => !v)}
                title={
                  onlyAlerts ? "Afficher tous les outils" : "N'afficher que les outils en alerte"
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full h-9 px-3.5 text-[13px] font-semibold transition-all cursor-pointer select-none active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  onlyAlerts
                    ? "bg-attention text-white"
                    : "bg-attention/15 text-attention hover:bg-attention/25"
                )}
              >
                <AlertTriangle className="size-3.5" />
                {stats.alertCount} alerte{stats.alertCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      {totalCount === 0 && !search && showArchived ? (
        // Un état vide doit parler de l'endroit où l'on se trouve. Celui-ci
        // proposait « Ajoutez un outil » dans la vue des archives, ce qui
        // n'avait aucun rapport avec ce qu'on venait y chercher.
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Archive className="size-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun outil archivé</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Les outils retirés du catalogue apparaîtront ici, avec leur motif. Ils restent
              restaurables.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => setShowArchived(false)}>
              Revenir aux outils en service
            </Button>
          </div>
        </div>
      ) : totalCount === 0 && !search ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Wrench className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun outillage</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ajoutez vos outils et equipements pour suivre leur assignation aux techniciens.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Wrench className="mr-2 size-4" />
              Ajouter un outil
            </Button>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Aucun outil ne correspond à cette recherche.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map((item) => {
            const stock = item.stock_current ?? 0;
            const total = stock + item.total_assigned;
            const itemValue = (item.price ?? 0) * total;
            const alert = getCardAlert(item);
            const shown = item.assignments.slice(0, 4);
            const remaining = item.assignments.length - shown.length;

            // Un outil archivé n'est pas un outil en service : sa carte était
            // pourtant la même, au pixel près. On basculait sur « Archivés » et
            // la grille se contentait de changer de contenu — rien ne disait
            // qu'on regardait des fiches sorties du catalogue.
            const isArchived = item.archived_at !== null;

            return (
              <div
                key={item.id}
                className={cn(
                  "group rounded-xl border p-4 cursor-pointer transition-all active:scale-[0.99]",
                  isArchived
                    ? // Même fond et même trait que les autres : une fiche
                      // archivée reste une fiche, pas un brouillon. Ce qui la
                      // distingue est dit franchement — une pastille et un
                      // motif — plutôt que suggéré par de l'effacement.
                      "bg-card hover:border-foreground/30 hover:shadow-md"
                    : "bg-card hover:border-primary/40 hover:shadow-md"
                )}
                onClick={() => setManageProduct(item)}
              >
                {/* Identite : vignette + nom + reference et fournisseur.
                    La photo occupait toute la largeur en banniere, reléguant
                    les informations utiles sous la ligne de flottaison. */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <ProductIconDisplay
                      iconName={item.icon_name}
                      iconColor={item.icon_color}
                      imageUrl={item.image_url}
                      size="lg"
                    />
                    {/* L'alerte d'ancienneté ne concerne que les outils en
                        service : relancer un technicien sur une fiche retirée
                        du catalogue n'a pas de sens. */}
                    {alert !== "none" && !isArchived && (
                      <span
                        className={cn(
                          "absolute -top-1 -left-1 size-3 rounded-full ring-2 ring-card",
                          alertDotClass[alert]
                        )}
                        title={alert === "danger" ? "Assignation > 1 an" : "Assignation > 6 mois"}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[15px] font-semibold leading-tight transition-colors",
                        !isArchived && "group-hover:text-primary"
                      )}
                    >
                      {item.name}
                    </p>
                    {/* Reference et fournisseur : le fournisseur etait saisi au
                        formulaire sans jamais apparaitre sur la carte. */}
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {item.sku}
                      {item.supplier?.name && <span> · {item.supplier.name}</span>}
                    </p>
                  </div>

                  {/* La marque, franche : un aplat sombre, en capitales. Le
                      gris et le pointillé disaient « éteint » plutôt que
                      « retiré » — ils affadissaient la carte au lieu de la
                      qualifier. Un signe net coûte moins à lire et laisse le
                      reste de la carte vivre. */}
                  {isArchived && (
                    <span className="shrink-0 rounded-full bg-foreground px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-background">
                      Archivé
                    </span>
                  )}

                  {/* Modifier une fiche retirée du catalogue est un geste sans
                      objet : le seul qui vaille est de la restaurer, depuis la
                      fenêtre de l'outil. */}
                  {!isArchived && (
                    <button
                      type="button"
                      title="Modifier cet outil"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditProduct(item);
                      }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background transition-colors hover:bg-foreground hover:text-background cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* ── Carte archivée : la cause, à la place des chiffres ──
                    « 3 disponibles · 0 assigné » sur une fiche retirée du
                    catalogue ne répond à aucune question : ces unités ne sont
                    ni à sortir ni à prêter. Ce qu'on vient chercher ici, c'est
                    pourquoi l'outil a quitté le parc.

                    Un outil ne peut d'ailleurs pas être archivé tant qu'un
                    technicien le détient : la ligne « assigné » y vaut zéro par
                    construction. */}
                {isArchived ? (
                  <div className="mt-3">
                    {/* Le motif est le contenu de cette carte : c'est la seule
                        chose qu'on vient y lire. Il est donc posé sur sa propre
                        surface, tenue par un filet à gauche — la forme d'une
                        citation. Ce sont les mots de celui qui a archivé, ils
                        méritent mieux qu'une ligne de légende. */}
                    {item.archive_reason ? (
                      <p className="line-clamp-3 rounded-r-lg border-l-2 border-foreground/25 bg-foreground/[0.04] py-2 pl-2.5 pr-2 text-sm leading-snug">
                        {item.archive_reason}
                      </p>
                    ) : (
                      <p className="rounded-r-lg border-l-2 border-foreground/10 bg-foreground/[0.02] py-2 pl-2.5 pr-2 text-sm italic text-muted-foreground">
                        Aucun motif renseigné
                      </p>
                    )}

                    {/* Pied : quand, et combien s'il y en avait plusieurs.
                        Un outil s'archive à l'unité dans l'immense majorité des
                        cas — écrire « 1 exemplaire » partout ne ferait
                        qu'ajouter du bruit là où le nombre ne dit rien. Il
                        n'apparaît qu'à partir de deux. */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                        <Archive className="size-3 shrink-0" />
                        {new Date(item.archived_at!).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                      {stock > 1 && (
                        <span
                          className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground"
                          title="Exemplaires encore comptés sur cette fiche"
                        >
                          {stock} exemplaires
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="min-w-0">
                      {/* Chiffres cles, avec le prix unitaire desormais visible */}
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2.5">
                          <span className="flex items-baseline gap-1">
                            <span
                              className={cn(
                                "font-heading font-bold tabular-nums text-lg leading-none",
                                stock === 0
                                  ? "text-critique"
                                  : stock <= 2
                                    ? "text-attention"
                                    : "text-foreground"
                              )}
                            >
                              {stock}
                            </span>
                            <span className="text-[11px] text-muted-foreground">dispo.</span>
                          </span>
                          <span className="text-foreground/20">·</span>
                          <span className="flex items-baseline gap-1">
                            <span className="font-heading font-bold tabular-nums text-lg leading-none">
                              {item.total_assigned}
                            </span>
                            <span className="text-[11px] text-muted-foreground">assigné</span>
                          </span>
                        </div>
                        {item.price != null && item.price > 0 && (
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {fmtPrice(item.price)}/u
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Répartition stock / assigné */}
                    {total > 0 && (
                      <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            stock === 0 ? "bg-attention/60" : "bg-foreground/25"
                          )}
                          style={{ width: `${Math.round((item.total_assigned / total) * 100)}%` }}
                        />
                      </div>
                    )}

                    {/* Détenteurs — qui a l'outil, lisible sans ouvrir la carte */}
                    <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                      {shown.length > 0 ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="flex items-center -space-x-1.5 shrink-0">
                            {shown.map((a) => {
                              const tech = a.technician;
                              if (!tech) return null;
                              const initials = `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`;
                              return (
                                <Avatar
                                  key={a.id}
                                  className="size-7 border-2 border-card"
                                  title={`${tech.first_name} ${tech.last_name} (x${a.quantity})`}
                                >
                                  {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                                  <AvatarFallback className="text-[9px] font-semibold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {remaining > 0 && (
                              <div className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold">
                                +{remaining}
                              </div>
                            )}
                          </div>
                          {/* Un seul détenteur : on le nomme. Sinon, on compte. */}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.assignments.length === 1 && shown[0]?.technician
                              ? `${shown[0].technician.first_name} ${shown[0].technician.last_name.charAt(0)}.`
                              : `${item.assignments.length} techniciens`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Non assigne</span>
                      )}
                      {itemValue > 0 && (
                        <span className="text-xs font-medium tabular-nums">
                          {fmtPrice(itemValue)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      {totalCount > 0 && (
        <div className="px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={totalCount} className="text-sm" /> type
            {totalCount > 1 ? "s" : ""} d'outils
          </p>
        </div>
      )}

      {/* ── Modals ── */}
      {/* Le parametre d'URL est efface a la fermeture : sans cela, un retour
          arriere rouvrirait la fiche. */}
      {manageProduct && (
        <EquipmentManageModal
          product={manageProduct}
          open={!!manageProduct}
          onOpenChange={(open) => {
            if (open) return;
            setManageProduct(null);
            // Sans cela, un retour arriere rouvrirait la fiche indefiniment.
            if (outil) setQueryStates({ outil: null });
          }}
          onEdit={() => setEditProduct(manageProduct)}
        />
      )}

      {editProduct && (
        <EditEquipmentDialog
          product={editProduct}
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
        />
      )}

      <CreateEquipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
