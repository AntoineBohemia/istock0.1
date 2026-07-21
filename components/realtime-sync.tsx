"use client";

import { useRealtimeSync } from "@/hooks/use-realtime-sync";

/**
 * Monte l'abonnement temps reel pour toute la partie authentifiee.
 *
 * Un seul point de montage : le canal est partage par tous les ecrans, et
 * l'abonnement survit a la navigation. Le brancher ecran par ecran ouvrirait
 * et fermerait une connexion a chaque changement de page.
 */
export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
