"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerContent className={className} {...(props as any)}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp className={className} {...props} />;
}

function ResponsiveDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerTitle className={className} {...(props as any)} />;
  }

  return <DialogTitle className={className} {...props} />;
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerDescription className={className} {...(props as any)} />;
  }

  return <DialogDescription className={className} {...props} />;
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return <Comp className={className} {...props} />;
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp {...(props as any)} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
};
