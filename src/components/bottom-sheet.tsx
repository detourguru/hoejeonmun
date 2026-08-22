"use client";

import { ReactNode } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export const BottomSheet = ({
  open,
  onOpenChange,
  title,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="border-border bg-surface text-text">
      <div className="mx-auto w-full sm:max-w-sm">
        <DrawerHeader>
          <DrawerTitle className="text-text">{title}</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4 text-sm text-text">
          {children}
        </div>

        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </div>
    </DrawerContent>
  </Drawer>
);
