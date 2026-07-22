import { describe, it, expect } from "vitest";
import { formatPhone, phoneHref } from "./phone";

describe("formatPhone", () => {
  it("groupe un numero national par deux", () => {
    expect(formatPhone("0612345678")).toBe("06 12 34 56 78");
  });

  it("normalise une saisie ponctuee", () => {
    expect(formatPhone("06.12.34.56.78")).toBe("06 12 34 56 78");
    expect(formatPhone("06-12-34-56-78")).toBe("06 12 34 56 78");
    expect(formatPhone("06 12 34 56 78")).toBe("06 12 34 56 78");
  });

  it("met en forme l'indicatif francais", () => {
    expect(formatPhone("+33612345678")).toBe("+33 6 12 34 56 78");
    expect(formatPhone("+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
  });

  // Mieux vaut rendre un numero etranger tel quel que le decouper de travers.
  it("laisse intact ce qui n'entre dans aucun format connu", () => {
    expect(formatPhone("+1 555 0100")).toBe("+1 555 0100");
    expect(formatPhone("poste 42")).toBe("poste 42");
  });

  it("rend une chaine vide sur une valeur absente", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
    expect(formatPhone("")).toBe("");
  });
});

describe("phoneHref", () => {
  // Le composeur n'accepte ni espaces ni ponctuation.
  it("ne garde que les chiffres et le plus", () => {
    expect(phoneHref("06 12 34 56 78")).toBe("0612345678");
    expect(phoneHref("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(phoneHref("06.12.34.56.78")).toBe("0612345678");
  });

  it("rend une chaine vide sur une valeur absente", () => {
    expect(phoneHref(null)).toBe("");
  });
});
