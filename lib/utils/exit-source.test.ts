import { describe, expect, it } from "vitest";

import { allocateLoss, maxSingleOrgStock, pickExitSource } from "./exit-source";

const smpr = (stock: number) => ({ id: "smpr", name: "SMPR", stock });
const seiren = (stock: number) => ({ id: "seiren", name: "SEIREN", stock });

describe("pickExitSource", () => {
  it("puise chez la societe qui en a le moins", () => {
    expect(pickExitSource([smpr(4), seiren(12)], 1)?.id).toBe("smpr");
    expect(pickExitSource([smpr(30), seiren(12)], 1)?.id).toBe("seiren");
  });

  it("ignore une societe a zero plutot que de la designer", () => {
    expect(pickExitSource([smpr(0), seiren(12)], 1)?.id).toBe("seiren");
  });

  it("renvoie null quand plus personne n'en a", () => {
    expect(pickExitSource([smpr(0), seiren(0)], 1)).toBeNull();
    expect(pickExitSource([], 1)).toBeNull();
  });

  it("ecarte la plus petite quand elle ne couvre pas la quantite", () => {
    // Une sortie ne se decoupe pas : 8 unites viennent de SEIREN, meme si SMPR
    // en detient moins.
    expect(pickExitSource([smpr(4), seiren(12)], 8)?.id).toBe("seiren");
  });

  it("designe la mieux fournie quand aucune ne couvre", () => {
    const picked = pickExitSource([smpr(4), seiren(6)], 20);
    expect(picked?.id).toBe("seiren");
    expect(picked?.stock).toBe(6);
  });

  it("tranche une egalite par le nom, pour ne pas changer d'avis", () => {
    const a = pickExitSource([smpr(5), seiren(5)], 1);
    const b = pickExitSource([seiren(5), smpr(5)], 1);
    expect(a?.id).toBe(b?.id);
    expect(a?.id).toBe("seiren");
  });
});

describe("maxSingleOrgStock", () => {
  it("retient le plus gros stock, jamais le cumul", () => {
    expect(maxSingleOrgStock([smpr(4), seiren(12)])).toBe(12);
    expect(maxSingleOrgStock([])).toBe(0);
  });
});

describe("allocateLoss", () => {
  it("prend d'abord chez la société la moins fournie", () => {
    expect(allocateLoss([smpr(4), seiren(12)], 3)).toEqual([
      { id: "smpr", name: "SMPR", quantity: 3 },
    ]);
  });

  it("déborde sur la suivante quand la première ne suffit pas", () => {
    // Une perte constate un accident : deux échelles cassées peuvent être une
    // de chaque société. Refuser de répartir obligerait à saisir deux fois.
    expect(allocateLoss([smpr(4), seiren(12)], 6)).toEqual([
      { id: "smpr", name: "SMPR", quantity: 4 },
      { id: "seiren", name: "SEIREN", quantity: 2 },
    ]);
  });

  it("vide tout le monde quand on perd la totalité", () => {
    const all = allocateLoss([smpr(4), seiren(12)], 16);
    expect(all.reduce((s, a) => s + a.quantity, 0)).toBe(16);
    expect(all).toHaveLength(2);
  });

  it("ignore une société à zéro", () => {
    expect(allocateLoss([smpr(0), seiren(5)], 2)).toEqual([
      { id: "seiren", name: "SEIREN", quantity: 2 },
    ]);
  });

  it("n'écrit rien plutôt qu'à moitié quand la quantité dépasse le stock", () => {
    expect(allocateLoss([smpr(4), seiren(2)], 10)).toEqual([]);
    expect(allocateLoss([], 1)).toEqual([]);
    expect(allocateLoss([smpr(4)], 0)).toEqual([]);
  });
});
