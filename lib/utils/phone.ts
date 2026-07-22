/**
 * Mise en forme d'un numero de telephone francais.
 *
 * Les numeros sont saisis comme ils viennent — colles, avec des points, des
 * tirets ou l'indicatif — et s'affichaient tels quels. Un « 0612345678 » se
 * lit mal et se compare mal a un « 06.12.34.56.78 » saisi le lendemain.
 * Ici tout converge vers la forme francaise, groupee par deux.
 *
 *   0612345678      -> 06 12 34 56 78
 *   06.12.34.56.78  -> 06 12 34 56 78
 *   +33612345678    -> +33 6 12 34 56 78
 *
 * Ce qui n'entre dans aucun format connu est rendu inchange : mieux vaut
 * afficher un numero etranger tel qu'il a ete saisi que le decouper de
 * travers.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // On ne garde que les chiffres et un eventuel « + » de tete pour raisonner
  // sur la structure, sans se laisser piéger par la ponctuation d'origine.
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  // Format national : 10 chiffres commencant par 0.
  if (!plus && digits.length === 10 && digits.startsWith("0")) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }

  // Format international francais : +33 puis 9 chiffres.
  if (plus && digits.startsWith("33") && digits.length === 11) {
    const national = digits.slice(2);
    return `+33 ${national[0]} ${national
      .slice(1)
      .replace(/(\d{2})(?=\d)/g, "$1 ")
      .trim()}`;
  }

  return trimmed;
}

/**
 * Numero utilisable dans un lien `tel:`.
 *
 * Le composeur du telephone n'accepte ni espaces ni ponctuation : le lien doit
 * porter le numero brut, meme quand l'ecran l'affiche espace.
 */
export function phoneHref(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}
