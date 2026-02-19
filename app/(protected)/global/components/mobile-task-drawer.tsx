"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ActionTaskList } from "./action-task-list";
import { useDashboardTasks } from "@/hooks/queries";

export function MobileTaskDrawer() {
  const [open, setOpen] = useState(false);
  const { data: tasks = [] } = useDashboardTasks();
  const taskCount = tasks.length;

  // Close drawer on navigation (user clicked an action link)
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname && open) {
      setOpen(false);
    }
    prevPathname.current = pathname;
  }, [pathname, open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* bottom-24 on <sm to stack above QR scan FAB (bottom-6, size-14) */}
        <Button
          size="icon"
          className="fixed bottom-24 right-6 z-40 size-14 rounded-full shadow-lg sm:bottom-6 lg:hidden"
        >
          <ClipboardList className="size-6" />
          {taskCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px]"
            >
              {taskCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>A faire</SheetTitle>
            {taskCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {taskCount}
              </Badge>
            )}
          </div>
          <SheetDescription>
            Actions recommandees pour votre stock
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <ActionTaskList />
        </div>
      </SheetContent>
    </Sheet>
  );
}
