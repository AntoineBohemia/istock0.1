import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import useCalendarEventStore from "./useCalendarEventStore";

describe("useCalendarEventStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store to initial state
    useCalendarEventStore.setState({
      selectedEvent: null,
      openSheet: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with empty events", () => {
    expect(useCalendarEventStore.getState().events).toEqual([]);
  });

  it("addEvent appends a new event", () => {
    useCalendarEventStore.getState().addEvent({
      id: "new-1",
      title: "New Event",
      start: new Date().toISOString(),
    });
    expect(useCalendarEventStore.getState().events.length).toBe(1);
  });

  it("setSelectedEvent updates the selected event", () => {
    const event = { id: "evt-1", title: "Test" };
    useCalendarEventStore.getState().setSelectedEvent(event);
    expect(useCalendarEventStore.getState().selectedEvent).toEqual(event);
  });

  it("setSelectedEvent(null) clears the selection", () => {
    useCalendarEventStore.getState().setSelectedEvent({ id: "1", title: "X" });
    useCalendarEventStore.getState().setSelectedEvent(null);
    expect(useCalendarEventStore.getState().selectedEvent).toBeNull();
  });

  it("setOpenSheet(true) opens the sheet", () => {
    useCalendarEventStore.getState().setOpenSheet(true);
    expect(useCalendarEventStore.getState().openSheet).toBe(true);
  });

  it("setOpenSheet(false) closes the sheet and clears selectedEvent after 500ms", () => {
    useCalendarEventStore.getState().setSelectedEvent({ id: "1", title: "X" });
    useCalendarEventStore.getState().setOpenSheet(false);

    // Sheet closes immediately
    expect(useCalendarEventStore.getState().openSheet).toBe(false);
    // selectedEvent still set (setTimeout hasn't fired)
    expect(useCalendarEventStore.getState().selectedEvent).not.toBeNull();

    // Advance timer by 500ms
    vi.advanceTimersByTime(500);
    expect(useCalendarEventStore.getState().selectedEvent).toBeNull();
  });
});
