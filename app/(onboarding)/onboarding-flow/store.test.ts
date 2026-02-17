import { describe, it, expect, beforeEach } from "vitest";
import {
  useOnboardingStore,
  ONBOARDING_STEPS,
  type CategoryData,
  type ProductData,
} from "./store";

const mockCategory: CategoryData = { name: "Peintures" };
const mockProduct: ProductData = {
  name: "Peinture Blanche",
  sku: "PB-001",
  categoryId: "cat-1",
  stockMin: 5,
  stockMax: 50,
  stockInitial: 20,
  price: 15.99,
};

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  // ─── Navigation ─────────────────────────────────────────────────
  describe("navigation", () => {
    it("starts at step 0", () => {
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("nextStep increments by 1", () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it("nextStep clamps at last step", () => {
      const maxIndex = ONBOARDING_STEPS.length - 1;
      for (let i = 0; i < ONBOARDING_STEPS.length + 5; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(maxIndex);
    });

    it("prevStep decrements by 1", () => {
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it("prevStep clamps at 0", () => {
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("skipStep increments and marks step as completed", () => {
      useOnboardingStore.getState().skipStep();
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(1);
      expect(state.completedSteps).toContain("welcome");
    });

    it("getCurrentStepKey returns the correct key", () => {
      expect(useOnboardingStore.getState().getCurrentStepKey()).toBe("welcome");
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().getCurrentStepKey()).toBe("organization");
    });

    it("getProgress returns correct percentage", () => {
      expect(useOnboardingStore.getState().getProgress()).toBe(0);
      // Move to step 3 of 7 (index 3 / 6 * 100 = 50)
      useOnboardingStore.getState().nextStep(); // 1
      useOnboardingStore.getState().nextStep(); // 2
      useOnboardingStore.getState().nextStep(); // 3
      expect(useOnboardingStore.getState().getProgress()).toBe(50);
    });
  });

  // ─── Categories CRUD ──────────────────────────────────────────────
  describe("categories", () => {
    it("addCategory appends to the list", () => {
      useOnboardingStore.getState().addCategory(mockCategory);
      expect(useOnboardingStore.getState().data.categories).toHaveLength(1);
      expect(useOnboardingStore.getState().data.categories[0].name).toBe("Peintures");
    });

    it("removeCategory removes the item and parallel array entry", () => {
      const store = useOnboardingStore.getState();
      store.addCategory({ name: "A" });
      store.addCategory({ name: "B" });
      useOnboardingStore.getState().setCategoryId(0, "id-a");
      useOnboardingStore.getState().setCategoryId(1, "id-b");
      useOnboardingStore.getState().removeCategory(0);

      const state = useOnboardingStore.getState();
      expect(state.data.categories).toHaveLength(1);
      expect(state.data.categories[0].name).toBe("B");
      expect(state.data.createdCategoryIds).toHaveLength(1);
      expect(state.data.createdCategoryIds[0]).toBe("id-b");
    });

    it("updateCategory updates a specific index", () => {
      useOnboardingStore.getState().addCategory({ name: "Old" });
      useOnboardingStore.getState().updateCategory(0, { name: "New" });
      expect(useOnboardingStore.getState().data.categories[0].name).toBe("New");
    });

    it("setCategoryId updates both arrays", () => {
      useOnboardingStore.getState().addCategory({ name: "Test" });
      useOnboardingStore.getState().setCategoryId(0, "cat-123");

      const state = useOnboardingStore.getState();
      expect(state.data.categories[0].id).toBe("cat-123");
      expect(state.data.createdCategoryIds[0]).toBe("cat-123");
    });
  });

  // ─── Products CRUD ────────────────────────────────────────────────
  describe("products", () => {
    it("addProduct appends to the list", () => {
      useOnboardingStore.getState().addProduct(mockProduct);
      expect(useOnboardingStore.getState().data.products).toHaveLength(1);
    });

    it("removeProduct removes the item and parallel array entry", () => {
      useOnboardingStore.getState().addProduct({ ...mockProduct, name: "A" });
      useOnboardingStore.getState().addProduct({ ...mockProduct, name: "B" });
      useOnboardingStore.getState().setProductId(0, "pid-a");
      useOnboardingStore.getState().setProductId(1, "pid-b");
      useOnboardingStore.getState().removeProduct(0);

      const state = useOnboardingStore.getState();
      expect(state.data.products).toHaveLength(1);
      expect(state.data.products[0].name).toBe("B");
      expect(state.data.createdProductIds[0]).toBe("pid-b");
    });

    it("updateProduct updates a specific index", () => {
      useOnboardingStore.getState().addProduct(mockProduct);
      useOnboardingStore.getState().updateProduct(0, { name: "Updated" });
      expect(useOnboardingStore.getState().data.products[0].name).toBe("Updated");
    });

    it("setProductId updates both arrays", () => {
      useOnboardingStore.getState().addProduct(mockProduct);
      useOnboardingStore.getState().setProductId(0, "prod-456");

      const state = useOnboardingStore.getState();
      expect(state.data.products[0].id).toBe("prod-456");
      expect(state.data.createdProductIds[0]).toBe("prod-456");
    });
  });

  // ─── Technician ───────────────────────────────────────────────────
  describe("technician", () => {
    it("updateTechnician merges partial data", () => {
      useOnboardingStore.getState().updateTechnician({ firstName: "Jean" });
      useOnboardingStore.getState().updateTechnician({ lastName: "Dupont" });

      const tech = useOnboardingStore.getState().data.technician;
      expect(tech.firstName).toBe("Jean");
      expect(tech.lastName).toBe("Dupont");
    });

    it("setCreatedTechnicianId stores the id", () => {
      useOnboardingStore.getState().setCreatedTechnicianId("tech-789");
      expect(useOnboardingStore.getState().data.createdTechnicianId).toBe("tech-789");
    });
  });

  // ─── markStepCompleted ────────────────────────────────────────────
  describe("markStepCompleted", () => {
    it("adds a step to completedSteps", () => {
      useOnboardingStore.getState().markStepCompleted("welcome");
      expect(useOnboardingStore.getState().completedSteps).toContain("welcome");
    });

    it("is idempotent (no duplicates)", () => {
      useOnboardingStore.getState().markStepCompleted("welcome");
      useOnboardingStore.getState().markStepCompleted("welcome");
      expect(
        useOnboardingStore.getState().completedSteps.filter((s) => s === "welcome")
      ).toHaveLength(1);
    });
  });

  // ─── reset ────────────────────────────────────────────────────────
  describe("reset", () => {
    it("restores initial state", () => {
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().addCategory(mockCategory);
      useOnboardingStore.getState().markStepCompleted("welcome");
      useOnboardingStore.getState().setError("some error");

      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(0);
      expect(state.data.categories).toHaveLength(0);
      expect(state.completedSteps).toHaveLength(0);
      expect(state.error).toBeNull();
    });
  });
});
