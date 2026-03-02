import { create } from "zustand";

interface TaskDrawerStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useTaskDrawerStore = create<TaskDrawerStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
