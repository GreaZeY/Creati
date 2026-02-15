import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      onChange,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.(parseFloat(e.target.value));
      onChange?.(e);
    };

    const percentage = ((value - min) * 100) / (max - min);

    return (
      <div
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className,
        )}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          ref={ref}
          className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          {...props}
        />
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-md pointer-events-none"
          style={{
            left: `${percentage}%`,
            transform: `translateX(-${percentage}%)`,
          }}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
