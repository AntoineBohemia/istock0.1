"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine, Clock, Undo2 } from "lucide-react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MOVEMENT_TYPE_LABELS,
  isPositiveMovement,
  type StockMovement,
} from "@/lib/supabase/queries/stock-movements";
import { InsetGroup } from "./mobile-stack-screen";

export interface HistoryEntry {
  /** Identifiant local (session) ou identifiant du mouvement (plus tot) */
  key: string;
  movementType: string;
  productName: string;
  quantity: number;
  /** Technicien destinataire, quand il y en a un */
  who?: string;
  at: string | null;
  /** Seuls les mouvements de la session peuvent etre annules */
  undoable: boolean;
}

function formatTime(at: string | null): string {
  if (!at) return "";
  return new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Ligne d'historique, annulable au glissement.
 *
 * L'annulation etait un lien « annuler » de onze pixels colle au bord droit.
 * Sur iOS on efface en glissant la ligne : la cible devient toute la ligne,
 * le geste est reversible tant qu'on n'a pas lache, et le mot rouge n'occupe
 * l'ecran que pendant qu'on le decouvre.
 */
function HistoryRow({
  entry,
  reverting,
  onUndo,
}: {
  entry: HistoryEntry;
  reverting: boolean;
  onUndo: () => void;
}) {
  const positive = isPositiveMovement(entry.movementType);
  const x = useMotionValue(0);
  // L'action se devoile a mesure du glissement : rien n'apparait d'un coup,
  // on voit venir ce qui va se passer.
  const revealOpacity = useTransform(x, [-90, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -90 || info.velocity.x < -500) {
      navigator.vibrate?.(10);
      onUndo();
    }
  };

  return (
    <div className="relative overflow-hidden">
      {entry.undoable && (
        <motion.div
          style={{ opacity: revealOpacity }}
          className="absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1.5 bg-critique text-white"
        >
          <Undo2 className="size-4" />
          <span className="text-sm font-semibold">Annuler</span>
        </motion.div>
      )}

      <motion.div
        drag={entry.undoable && !reverting ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.8, right: 0 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "relative flex items-center gap-3 bg-white dark:bg-card px-4 py-3",
          reverting && "opacity-40"
        )}
      >
        {/* Le sens du mouvement, avant meme de lire */}
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            positive ? "bg-standard-bg" : "bg-critique-bg"
          )}
        >
          {positive ? (
            <ArrowDownToLine className="size-4 text-standard" />
          ) : (
            <ArrowUpFromLine className="size-4 text-critique" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-tight">{entry.productName}</span>
          <span className="block truncate text-sm text-muted-foreground leading-tight">
            {MOVEMENT_TYPE_LABELS[entry.movementType as keyof typeof MOVEMENT_TYPE_LABELS] ??
              entry.movementType}
            {entry.who && ` · ${entry.who}`}
            {entry.at && ` · ${formatTime(entry.at)}`}
          </span>
        </span>

        <span
          className={cn(
            "shrink-0 font-heading text-lg font-bold tabular-nums",
            positive ? "text-standard" : "text-critique"
          )}
        >
          {positive ? "+" : "−"}
          {entry.quantity}
        </span>
      </motion.div>
    </div>
  );
}

/**
 * Historique du jour.
 *
 * Reste une feuille et non un ecran pousse : on vient consulter puis on
 * repart, ce n'est pas une etape du parcours. Sur iOS la feuille dit
 * exactement cela — une parenthese que l'on referme.
 */
export function MobileHistorySheet({
  open,
  onOpenChange,
  session,
  older,
  isLoading,
  revertingKeys,
  onUndo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: HistoryEntry[];
  older: HistoryEntry[];
  isLoading: boolean;
  revertingKeys: Set<string>;
  onUndo: (key: string) => void;
}) {
  const all = [...session, ...older];
  // Bilan de la journee : le detail ne dit pas si le stock a monte ou baisse.
  const totalIn = all.filter((e) => isPositiveMovement(e.movementType)).length;
  const totalOut = all.length - totalIn;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[88vh] flex-col">
        <div className="shrink-0 px-4 pt-2 pb-3">
          <DrawerTitle className="font-heading text-2xl font-bold leading-tight">
            Aujourd&apos;hui
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {all.length === 0
              ? "Aucun mouvement pour l'instant"
              : `${all.length} mouvement${all.length > 1 ? "s" : ""} · ${totalIn} entrée${totalIn > 1 ? "s" : ""}, ${totalOut} sortie${totalOut > 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isLoading && all.length === 0 ? (
            <InsetGroup>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-8 shrink-0" />
                </div>
              ))}
            </InsetGroup>
          ) : all.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Clock className="size-12 text-muted-foreground/20" />
              <p className="text-base font-medium">Rien enregistré aujourd&apos;hui</p>
              <p className="text-sm text-muted-foreground">
                Les entrées et sorties de la journée apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              {session.length > 0 && (
                <InsetGroup
                  header="À l'instant"
                  footer="Glissez une ligne vers la gauche pour l'annuler."
                >
                  {session.map((entry) => (
                    <HistoryRow
                      key={entry.key}
                      entry={entry}
                      reverting={revertingKeys.has(entry.key)}
                      onUndo={() => onUndo(entry.key)}
                    />
                  ))}
                </InsetGroup>
              )}

              {older.length > 0 && (
                <InsetGroup header={session.length > 0 ? "Plus tôt" : undefined}>
                  {older.map((entry) => (
                    <HistoryRow key={entry.key} entry={entry} reverting={false} onUndo={() => {}} />
                  ))}
                </InsetGroup>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Adaptateur : un mouvement charge depuis la base devient une ligne d'historique. */
export function movementToHistoryEntry(m: StockMovement): HistoryEntry {
  return {
    key: m.id,
    movementType: m.movement_type,
    productName: m.product?.name ?? "—",
    quantity: m.quantity,
    who: m.technician ? `${m.technician.first_name} ${m.technician.last_name}` : undefined,
    at: m.created_at,
    undoable: false,
  };
}
