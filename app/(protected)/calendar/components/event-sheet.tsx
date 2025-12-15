"use client";

import React, { useEffect } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import useCalendarEventStore from "../useCalendarEventStore";
import { DateTimePicker } from "./date-time-picker";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { eventColors } from "../data";

const FormSchema = z.object({
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  start: z.date(),
  end: z.date().optional(),
  color: z.string().min(1),
});

export default function EventSheet() {
  const {
    selectedEvent: event,
    openSheet,
    setOpenSheet,
  } = useCalendarEventStore();
  const [startDate, setStartDate] = React.useState<Date | string | undefined>();
  const [endDate, setEndDate] = React.useState<Date | string | undefined>();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const parseDate = (date: unknown): Date | undefined => {
    if (typeof date === "string" || typeof date === "number") {
      return new Date(date);
    }
    if (date instanceof Date) {
      return date;
    }
    return undefined;
  };

  // Adding and resetting event data
  useEffect(() => {
    if (event && openSheet) {
      // Insert event data into form
      form.reset({
        title: event.title,
        description: event.description,
        start: parseDate(event.start),
        end: parseDate(event.end),
        color: event.color,
      });

      setStartDate(event.start as Date);

      if (event.end) {
        setEndDate(event.end as Date);
      }
    } else {
      // If the window is closed, reset the form.
      form.reset({
        title: "",
        description: undefined,
        start: undefined,
        end: undefined,
      });

      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [form, event, openSheet]);

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast.success("Success!");
  }

  return (
    <Sheet open={openSheet} onOpenChange={setOpenSheet}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{event ? "Modifier" : "Ajouter un"} Chantier</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        date={parseDate(startDate)}
                        setDate={setStartDate}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        date={parseDate(endDate)}
                        setDate={setEndDate}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur</FormLabel>
                    <FormControl>
                      <Select
                        defaultValue={field.value}
                        onValueChange={(value) => form.setValue("color", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(eventColors).map((color, key) => {
                            return (
                              <SelectItem key={key} value={color}>
                                <div className="flex items-center gap-3 capitalize">
                                  <span
                                    className={cn(
                                      "inline-block size-4 rounded-full",
                                      eventColors[color]
                                    )}
                                  ></span>
                                  {color}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Enregistrer</Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
