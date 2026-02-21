import type { InputHTMLAttributes } from "react";

import { cn } from "@/src/lib/utils/cn";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  labels?: {
    min: string;
    max: string;
  };
}

export function Slider({ className, labels, ...rest }: SliderProps) {
  return (
    <div className="space-y-2">
      <input
        type="range"
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-border",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-paper-accent",
          className,
        )}
        {...rest}
      />
      {labels ? (
        <div className="flex justify-between font-sans text-xs text-paper-muted">
          <span>{labels.min}</span>
          <span>{labels.max}</span>
        </div>
      ) : null}
    </div>
  );
}
