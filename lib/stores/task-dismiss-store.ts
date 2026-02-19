import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface TaskDismissStore {
  dismissedTasks: Record<string, number>;
  dismissTask: (type: string, entityId: string) => void;
  isTaskDismissed: (type: string, entityId: string) => boolean;
  clearExpired: () => void;
}

function makeKey(type: string, entityId: string): string {
  return `${type}:${entityId}`;
}

export const useTaskDismissStore = create<TaskDismissStore>()(
  persist(
    (set, get) => ({
      dismissedTasks: {},

      dismissTask: (type, entityId) =>
        set((state) => ({
          dismissedTasks: {
            ...state.dismissedTasks,
            [makeKey(type, entityId)]: Date.now(),
          },
        })),

      isTaskDismissed: (type, entityId) => {
        const timestamp = get().dismissedTasks[makeKey(type, entityId)];
        if (!timestamp) return false;
        return Date.now() - timestamp < TWENTY_FOUR_HOURS;
      },

      clearExpired: () =>
        set((state) => {
          const now = Date.now();
          const cleaned: Record<string, number> = {};
          for (const [key, timestamp] of Object.entries(state.dismissedTasks)) {
            if (now - timestamp < TWENTY_FOUR_HOURS) {
              cleaned[key] = timestamp;
            }
          }
          return { dismissedTasks: cleaned };
        }),
    }),
    {
      name: "task-dismissals",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
