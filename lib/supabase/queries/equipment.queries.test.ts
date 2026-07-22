import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { getEquipmentProducts, getAvailableEquipment } from "./equipment";

beforeEach(() => {
  vi.clearAllMocks();
});

// Le catalogue d'outillage suit la meme regle que celui des consommables : il
// est commun aux societes du compte. `products.organization_id` ne dit que qui
// a saisi la fiche, jamais qui peut la voir — le RLS s'en charge.
//
// Filtrer dessus coupait le catalogue en deux : sept outils correctement
// archives n'apparaissaient pas dans la vue « Archives », au seul motif
// qu'ils avaient ete crees depuis l'autre societe.
describe("getEquipmentProducts", () => {
  it("ne filtre pas les fiches par organizationId", async () => {
    mockClient._setResult({ data: [], error: null });

    await getEquipmentProducts({ organizationId: "org-1" });

    expect(mockClient.eq).not.toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("ne filtre pas davantage la vue des archives", async () => {
    mockClient._setResult({ data: [], error: null });

    await getEquipmentProducts({ organizationId: "org-1", archived: true });

    expect(mockClient.eq).not.toHaveBeenCalledWith("organization_id", "org-1");
    // La vue archives inverse bien le critere, sinon elle listerait les actifs.
    expect(mockClient.not).toHaveBeenCalledWith("archived_at", "is", null);
  });

  it("ne montre que l'outillage", async () => {
    mockClient._setResult({ data: [], error: null });

    await getEquipmentProducts({ organizationId: "org-1" });

    expect(mockClient.eq).toHaveBeenCalledWith("product_type", "equipment");
  });
});

describe("getAvailableEquipment", () => {
  it("ne filtre pas par societe : un outil reste assignable quelle que soit celle qui l'a saisi", async () => {
    mockClient._setResult({ data: [], error: null });

    await getAvailableEquipment("org-1");

    expect(mockClient.eq).not.toHaveBeenCalledWith("organization_id", "org-1");
  });
});
