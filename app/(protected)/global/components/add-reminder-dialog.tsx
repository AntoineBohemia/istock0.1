"use client";

import React from "react";

import { PlusCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/date-time-picker";

type Priority = "low" | "medium" | "high";

type Reminder = {
  id: number;
  priority: Priority;
  date: string;
  time: string;
  text: string;
  category: string;
};

export function AddReminderDialog() {
  const [date, setDate] = React.useState<Date>();
  const [reminders, setReminders] = React.useState<Reminder[]>([
    {
      id: 1,
      priority: "low",
      date: "Today",
      time: "12:30",
      text: "Create a design training for beginners.",
      category: "Design Education",
    },
    {
      id: 2,
      priority: "medium",
      date: "Today",
      time: "10:00",
      text: "Have a meeting with the new design team.",
      category: "Meeting",
    },
    {
      id: 3,
      priority: "high",
      date: "Tomorrow",
      time: "16:30",
      text: "Respond to customer support emails.",
      category: "Customer Support",
    },
  ]);

  const [open, setOpen] = React.useState(false);
  const [newReminder, setNewReminder] = React.useState<Omit<Reminder, "id">>({
    priority: "medium",
    date: "",
    time: "",
    text: "",
    category: "",
  });

  const handleAddReminder = () => {
    const reminder: Reminder = {
      ...newReminder,
      id: reminders.length + 1,
    };

    setReminders([...reminders, reminder]);
    setNewReminder({
      priority: "medium",
      date: "",
      time: "",
      text: "",
      category: "",
    });
    setOpen(false);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "low":
        return "text-gray-400";
      case "medium":
        return "text-orange-400";
      case "high":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusCircleIcon />
          Set Reminder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Reminder</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="text">Note</Label>
            <Input
              id="text"
              placeholder="Enter your reminder"
              value={newReminder.text}
              onChange={(e) =>
                setNewReminder({ ...newReminder, text: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="text">Date</Label>
            <DateTimePicker date={date} setDate={setDate} />
          </div>

          <div className="grid gap-3">
            <Label>Priority</Label>
            <RadioGroup
              value={newReminder.priority}
              onValueChange={(value) =>
                setNewReminder({ ...newReminder, priority: value as Priority })
              }
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="cursor-pointer">
                  Low
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="cursor-pointer">
                  Medium
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="cursor-pointer">
                  High
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={newReminder.category}
              onValueChange={(value) =>
                setNewReminder({ ...newReminder, category: value })
              }
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Design Education">
                  Design Education
                </SelectItem>
                <SelectItem value="Customer Support">
                  Customer Support
                </SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Work">Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAddReminder}>Add Reminder</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
