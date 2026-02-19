import { create, StateCreator } from "zustand";
import { EventInput } from "@fullcalendar/core";

interface Store {
  events: EventInput[];
  selectedEvent: EventInput | null;
  openSheet: boolean;
  addEvent: (event: EventInput) => void;
  setOpenSheet: (value: boolean) => void;
  setSelectedEvent: (event: EventInput | null) => void;
}

const calendarEventStore: StateCreator<Store> = (set) => ({
  events: [],
  selectedEvent: null,
  openSheet: false,
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  setOpenSheet: (value) => {
    if (!value) {
      setTimeout(() => {
        set({ selectedEvent: null }); // If the sheet is closed, let's delete the selected event data from the statuses.
      }, 500);
    }

    set({ openSheet: value });
  },
  setSelectedEvent: (event) => set(() => ({ selectedEvent: event })),
});

const useCalendarEventStore = create(calendarEventStore);

export default useCalendarEventStore;
