import { create } from "zustand";

interface ScanDrawerStore {
  open: boolean;
  preselectedTechnicianId: string | null;
  setOpen: (open: boolean) => void;
  openForTechnician: (technicianId: string) => void;
  reset: () => void;
}

export const useScanDrawerStore = create<ScanDrawerStore>((set) => ({
  open: false,
  preselectedTechnicianId: null,
  setOpen: (open) => {
    if (!open) {
      set({ open: false, preselectedTechnicianId: null });
    } else {
      set({ open: true });
    }
  },
  openForTechnician: (technicianId) =>
    set({ open: true, preselectedTechnicianId: technicianId }),
  reset: () => set({ open: false, preselectedTechnicianId: null }),
}));
