import { describe, it, expect } from "vitest";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "./stock-movements";

const ALL_TYPES: MovementType[] = ["entry", "exit_technician", "exit_anonymous", "exit_loss"];

describe("MOVEMENT_TYPE_LABELS", () => {
  it("has a label for every movement type", () => {
    for (const type of ALL_TYPES) {
      expect(MOVEMENT_TYPE_LABELS[type]).toBeDefined();
      expect(typeof MOVEMENT_TYPE_LABELS[type]).toBe("string");
    }
  });

  it("returns correct French labels", () => {
    expect(MOVEMENT_TYPE_LABELS.entry).toBe("Entrée");
    expect(MOVEMENT_TYPE_LABELS.exit_technician).toBe("Sortie technicien");
    // exit_loss n'est plus distingue d'exit_anonymous : meme libelle, meme
    // couleur, et le filtre de la page Mouvements ne le propose pas. Aucun
    // mouvement de ce type n'existe en base.
    expect(MOVEMENT_TYPE_LABELS.exit_anonymous).toBe("Erreur stock");
    expect(MOVEMENT_TYPE_LABELS.exit_loss).toBe("Erreur stock");
  });
});
