import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Une modale fermee ne doit pas occuper de couche.
 *
 * Beaucoup d'ecrans rendent leurs modales secondaires en permanence, pilotees
 * par un booleen : `<StockEntryModal open={rebuyOpen} />` dans la fiche outil,
 * par exemple. Ces elements sont montes meme fermes — seul le portail, a
 * l'interieur, cesse de rendre.
 *
 * L'inscription a donc vecu un temps dans `DialogContent`, au-dessus du
 * portail : les modales fermees comptaient comme des couches et, s'inscrivant
 * en dernier, prenaient le premier plan. La fiche outil s'affichait floutee et
 * delavee alors que rien ne s'ouvrait par-dessus.
 */
function ScreenWithClosedChildDialog() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Fiche outil</DialogTitle>
      </DialogContent>
      {/* Fermee, mais bien presente dans l'arbre */}
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Entrée de stock</DialogTitle>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

describe("empilement des modales", () => {
  it("laisse au premier plan une modale dont la modale enfant est fermee", () => {
    render(<ScreenWithClosedChildDialog />);

    const card = screen.getByText("Fiche outil").closest('[data-slot="dialog-content"]');
    expect(card).not.toBeNull();
    expect(card!.getAttribute("data-behind")).toBeNull();
  });

  it("ne monte que la modale ouverte", () => {
    render(<ScreenWithClosedChildDialog />);

    expect(document.querySelectorAll('[data-slot="dialog-content"]')).toHaveLength(1);
  });
});
