/**
 * Convertit une date de formulaire (« 2026-07-21 ») en horodatage d'entree.
 *
 * Un champ date ne porte pas d'heure : `new Date("2026-07-21")` vaut minuit.
 * Une saisie faite a 14 h se retrouvait donc classee avant toutes les
 * operations de la journee — enfouie sous une quinzaine de lignes dans la
 * liste des mouvements, triee du plus recent au plus ancien.
 *
 * Si la date choisie est aujourd'hui, on laisse la base horodater a l'instant
 * de la validation. Pour une date passee, minuit convient : l'heure exacte
 * n'est de toute facon plus connue.
 */
export function toEntryTimestamp(dateInput?: string | null): string | undefined {
  if (!dateInput) return undefined;

  const chosen = new Date(dateInput);
  if (Number.isNaN(chosen.getTime())) return undefined;

  const today = new Date();
  const isToday =
    chosen.getFullYear() === today.getFullYear() &&
    chosen.getMonth() === today.getMonth() &&
    chosen.getDate() === today.getDate();

  // undefined => la fonction en base applique now(), donc l'heure de validation
  return isToday ? undefined : chosen.toISOString();
}
