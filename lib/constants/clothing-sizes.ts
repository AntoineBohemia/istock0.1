/**
 * Tailles de vetement des techniciens.
 *
 * Deux systemes distincts : le haut se note en lettres, le bas en pointures
 * francaises. Definis ici plutot que recopies dans chaque formulaire — c'est
 * ce genre de duplication qui laisse un ecran diverger des autres.
 */
export const CLOTHING_SIZES_TOP = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

export const CLOTHING_SIZES_BOTTOM = [
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
  "56",
  "58",
  "60",
] as const;
