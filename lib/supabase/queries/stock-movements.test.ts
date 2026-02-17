import { describe, it, expect } from "vitest";
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_COLORS,
  type MovementType,
} from "./stock-movements";

const ALL_TYPES: MovementType[] = [
  "entry",
  "exit_technician",
  "exit_anonymous",
  "exit_loss",
];

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
    expect(MOVEMENT_TYPE_LABELS.exit_anonymous).toBe("Sortie anonyme");
    expect(MOVEMENT_TYPE_LABELS.exit_loss).toBe("Perte/Casse");
  });
});

describe("MOVEMENT_TYPE_COLORS", () => {
  it("has a color for every movement type", () => {
    for (const type of ALL_TYPES) {
      expect(MOVEMENT_TYPE_COLORS[type]).toBeDefined();
      expect(typeof MOVEMENT_TYPE_COLORS[type]).toBe("string");
    }
  });

  it("returns correct badge variants", () => {
    expect(MOVEMENT_TYPE_COLORS.entry).toBe("success");
    expect(MOVEMENT_TYPE_COLORS.exit_technician).toBe("info");
    expect(MOVEMENT_TYPE_COLORS.exit_anonymous).toBe("secondary");
    expect(MOVEMENT_TYPE_COLORS.exit_loss).toBe("destructive");
  });
});
