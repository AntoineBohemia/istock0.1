"use client";

import { useMemo } from "react";
import { useVehicles } from "@/hooks/queries";
import { useOrganizationStore } from "@/lib/stores/organization-store";

interface TechnicianVehicleSelectProps {
  /** Technicien en cours d'edition (absent a la creation) */
  technicianId?: string;
  /** Identifiant du vehicule choisi, "" si aucun */
  value: string;
  onChange: (vehicleId: string) => void;
  disabled?: boolean;
}

/**
 * Choix du vehicule d'un technicien.
 *
 * Les formulaires demandaient auparavant de SAISIR plaque, marque et modele,
 * dans des colonnes que plus aucun ecran ne lisait. On affecte desormais un
 * vehicule existant : la table vehicles est la source de verite.
 */
export default function TechnicianVehicleSelect({
  technicianId,
  value,
  onChange,
  disabled,
}: TechnicianVehicleSelectProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: vehicles = [], isLoading } = useVehicles(currentOrganization?.id);

  // Un vehicule deja pris par quelqu'un d'autre ne doit pas etre proposable :
  // l'affecter le retirerait silencieusement a son titulaire.
  const selectable = useMemo(
    () => vehicles.filter((v) => !v.technician_id || v.technician_id === technicianId),
    [vehicles, technicianId]
  );

  const assignedElsewhere = vehicles.length - selectable.length;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Véhicule</label>
      <select
        value={value}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px] disabled:opacity-50"
      >
        <option value="">Aucun véhicule</option>
        {selectable.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} — {v.license_plate}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground mt-1">
        {selectable.length === 0
          ? "Aucun véhicule disponible. Créez-en un depuis Véhicules."
          : assignedElsewhere > 0
            ? `${assignedElsewhere} véhicule${assignedElsewhere > 1 ? "s" : ""} déjà affecté${assignedElsewhere > 1 ? "s" : ""} à un autre technicien.`
            : "Seuls les véhicules libres sont proposés."}
      </p>
    </div>
  );
}
