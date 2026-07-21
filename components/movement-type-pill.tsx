import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/supabase/queries/stock-movements";
import { cn } from "@/lib/utils";

/**
 * Couleur de chaque type de mouvement.
 *
 * Il existait trois definitions concurrentes : une constante jamais utilisee,
 * les classes ecrites dans la liste, et les variantes de Badge des fiches de
 * detail. Une sortie technicien s'affichait rouge dans la liste et bleue sur
 * sa fiche. Une seule source desormais.
 */
const PILL_CLASS: Record<MovementType, string> = {
  entry: "text-standard bg-standard-bg",
  exit_technician: "text-critique bg-critique-bg",
  exit_anonymous: "text-attention bg-attention-bg",
  exit_loss: "text-attention bg-attention-bg",
  assign_equipment: "text-primary bg-primary/10",
  unassign_equipment: "text-primary bg-primary/10",
};

export function MovementTypePill({
  type,
  className,
}: {
  type: MovementType | string;
  className?: string;
}) {
  const key = (type in PILL_CLASS ? type : "exit_anonymous") as MovementType;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-medium",
        PILL_CLASS[key],
        className
      )}
    >
      {MOVEMENT_TYPE_LABELS[key]}
    </span>
  );
}
