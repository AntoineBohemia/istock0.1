"use client";

import React from "react";

import { toast } from "sonner";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, {
  DateClickArg,
  EventDragStopArg,
  EventResizeStopArg,
} from "@fullcalendar/interaction";
import useCalendarEventStore from "../useCalendarEventStore";
import { eventColors } from "../data";
import { EventClickArg } from "@fullcalendar/core";
import CalendarToolbar from "./calendar-toolbar";

export default function CalendarApp() {
  const calendarRef = React.useRef<FullCalendar>(null);
  const { events, setSelectedEvent, setOpenSheet } = useCalendarEventStore();

  const handleDateClick = (arg: DateClickArg) => {
    setOpenSheet(true);
  };

  const handleEventClick = (e: EventClickArg) => {
    const event = events.find((event) => event.id === e.event.id);
    if (event) setSelectedEvent(event);
    setOpenSheet(true);
  };

  const handleEventResizeStop = (e: EventResizeStopArg) => {
    toast.success("Event resize...");
  };

  const handleEventDragStop = (e: EventDragStopArg) => {
    toast.success("Event drag-drop...");
  };

  return (
    <>
      <CalendarToolbar calendarRef={calendarRef} />
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        editable={true}
        selectable={true}
        eventResizableFromStart={true}
        dateClick={(e) => handleDateClick(e)}
        eventResizeStop={handleEventResizeStop}
        eventDragStop={handleEventDragStop}
        eventClick={handleEventClick}
        events={[
          ...events.map((event) => ({
            ...event,
            classNames: eventColors[event.color ?? "blue"],
          })),
        ]}
        height="calc(100vh - 10rem)"
      />
    </>
  );
}
