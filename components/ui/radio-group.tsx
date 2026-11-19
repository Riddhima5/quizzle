"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export const RadioGroup = RadioGroupPrimitive.Root;

/** A radio rendered as a selectable card (white → pink-50 hover → pink-200 border selected). */
export function RadioCard({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "border-border bg-surface flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors duration-150 hover:bg-pink-50 data-[state=checked]:border-pink-400 data-[state=checked]:bg-pink-50",
        className,
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
