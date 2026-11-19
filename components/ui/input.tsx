import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted-text transition-colors duration-150 focus-visible:border-pink-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-pink-200 disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-text text-sm font-medium", className)} {...props} />;
}
