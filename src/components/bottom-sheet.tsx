"use client";

import { ReactNode } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

export const BottomSheet = ({
  open,
  onOpenChange,
  title,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: NonNullable<DrawerPrimitive.Root.Props["onOpenChange"]>;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="border-border bg-surface text-text">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col sm:max-w-sm">
        <DrawerHeader>
          <DrawerTitle className="text-text">{title}</DrawerTitle>
        </DrawerHeader>

        <div className="text-text flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 text-sm">
          {children}
        </div>

        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </div>
    </DrawerContent>
  </Drawer>
);
