"use client";

import { useEffect, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

const STORAGE_PREFIX = "istock:columns:";

/**
 * État `columnVisibility` d'un tableau TanStack, persisté en localStorage.
 *
 * - `tableId` : identifiant stable du tableau (clé de stockage).
 * - `defaults` : visibilité par défaut (colonnes masquées au premier affichage).
 *
 * Le choix mémorisé est lu à l'initialisation (côté client uniquement) puis
 * ré-écrit à chaque changement. Les tableaux consommateurs affichent un skeleton
 * tant que les données chargent, donc pas de décalage d'hydratation SSR.
 */
export function useColumnVisibility(tableId: string, defaults: VisibilityState = {}) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      // localStorage indisponible ou JSON invalide : valeurs par défaut
      return defaults;
    }
  });

  // Persister à chaque changement
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(columnVisibility));
    } catch {
      // ignore
    }
  }, [tableId, columnVisibility]);

  return [columnVisibility, setColumnVisibility] as const;
}
