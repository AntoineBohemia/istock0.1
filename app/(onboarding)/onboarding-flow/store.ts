import { create } from "zustand";

export type OnboardingStep =
  | "welcome"
  | "organization"
  | "categories"
  | "products"
  | "first-technician"
  | "stock-tutorial"
  | "completion";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "organization",
  "categories",
  "products",
  "first-technician",
  "stock-tutorial",
  "completion",
];

export interface OrganizationData {
  name: string;
  sectors: string[];
}

export interface CategoryData {
  id?: string;
  name: string;
  parentId?: string;
}

export interface ProductData {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  stockMin: number;
  stockMax: number;
  stockInitial: number;
  price: number;
}

export interface TechnicianData {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
}

export interface OnboardingData {
  organization: OrganizationData;
  categories: CategoryData[];
  products: ProductData[];
  technician: TechnicianData;
  createdOrganizationId?: string;
  createdCategoryIds: string[];
  createdProductIds: string[];
  createdTechnicianId?: string;
}

interface OnboardingStore {
  currentStep: number;
  data: OnboardingData;
  completedSteps: OnboardingStep[];
  isLoading: boolean;
  error: string | null;
  setCurrentStep: (step: number) => void;
  updateOrganization: (org: Partial<OrganizationData>) => void;
  addCategory: (category: CategoryData) => void;
  removeCategory: (index: number) => void;
  updateCategory: (index: number, category: Partial<CategoryData>) => void;
  setCategoryId: (index: number, id: string) => void;
  addProduct: (product: ProductData) => void;
  removeProduct: (index: number) => void;
  updateProduct: (index: number, product: Partial<ProductData>) => void;
  setProductId: (index: number, id: string) => void;
  updateTechnician: (technician: Partial<TechnicianData>) => void;
  setCreatedOrganizationId: (id: string) => void;
  setCreatedTechnicianId: (id: string) => void;
  markStepCompleted: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getCurrentStepKey: () => OnboardingStep;
  getProgress: () => number;
}

const initialData: OnboardingData = {
  organization: {
    name: "",
    sectors: [],
  },
  categories: [],
  products: [],
  technician: {
    firstName: "",
    lastName: "",
    email: "",
    city: "",
  },
  createdCategoryIds: [],
  createdProductIds: [],
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  currentStep: 0,
  data: initialData,
  completedSteps: [],
  isLoading: false,
  error: null,

  setCurrentStep: (step) => set({ currentStep: step }),

  updateOrganization: (org) =>
    set((state) => ({
      data: {
        ...state.data,
        organization: { ...state.data.organization, ...org },
      },
    })),

  addCategory: (category) =>
    set((state) => ({
      data: {
        ...state.data,
        categories: [...state.data.categories, category],
      },
    })),

  removeCategory: (index) =>
    set((state) => ({
      data: {
        ...state.data,
        categories: state.data.categories.filter((_, i) => i !== index),
        createdCategoryIds: state.data.createdCategoryIds.filter((_, i) => i !== index),
      },
    })),

  updateCategory: (index, category) =>
    set((state) => ({
      data: {
        ...state.data,
        categories: state.data.categories.map((c, i) =>
          i === index ? { ...c, ...category } : c
        ),
      },
    })),

  setCategoryId: (index, id) =>
    set((state) => {
      const newIds = [...state.data.createdCategoryIds];
      newIds[index] = id;
      const newCategories = [...state.data.categories];
      if (newCategories[index]) {
        newCategories[index] = { ...newCategories[index], id };
      }
      return {
        data: {
          ...state.data,
          categories: newCategories,
          createdCategoryIds: newIds,
        },
      };
    }),

  addProduct: (product) =>
    set((state) => ({
      data: {
        ...state.data,
        products: [...state.data.products, product],
      },
    })),

  removeProduct: (index) =>
    set((state) => ({
      data: {
        ...state.data,
        products: state.data.products.filter((_, i) => i !== index),
        createdProductIds: state.data.createdProductIds.filter((_, i) => i !== index),
      },
    })),

  updateProduct: (index, product) =>
    set((state) => ({
      data: {
        ...state.data,
        products: state.data.products.map((p, i) =>
          i === index ? { ...p, ...product } : p
        ),
      },
    })),

  setProductId: (index, id) =>
    set((state) => {
      const newIds = [...state.data.createdProductIds];
      newIds[index] = id;
      const newProducts = [...state.data.products];
      if (newProducts[index]) {
        newProducts[index] = { ...newProducts[index], id };
      }
      return {
        data: {
          ...state.data,
          products: newProducts,
          createdProductIds: newIds,
        },
      };
    }),

  updateTechnician: (technician) =>
    set((state) => ({
      data: {
        ...state.data,
        technician: { ...state.data.technician, ...technician },
      },
    })),

  setCreatedOrganizationId: (id) =>
    set((state) => ({
      data: { ...state.data, createdOrganizationId: id },
    })),

  setCreatedTechnicianId: (id) =>
    set((state) => ({
      data: { ...state.data, createdTechnicianId: id },
    })),

  markStepCompleted: (step) =>
    set((state) => ({
      completedSteps: state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step],
    })),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1),
    })),

  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(0, state.currentStep - 1),
    })),

  skipStep: () => {
    const state = get();
    const currentStepKey = ONBOARDING_STEPS[state.currentStep];
    set({
      currentStep: Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1),
      completedSteps: state.completedSteps.includes(currentStepKey)
        ? state.completedSteps
        : [...state.completedSteps, currentStepKey],
    });
  },

  reset: () => set({ currentStep: 0, data: initialData, completedSteps: [], error: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  getCurrentStepKey: () => {
    const state = get();
    return ONBOARDING_STEPS[state.currentStep];
  },

  getProgress: () => {
    const state = get();
    return Math.round((state.currentStep / (ONBOARDING_STEPS.length - 1)) * 100);
  },
}));
