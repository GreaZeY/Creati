import React, { useState, useRef, useLayoutEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

interface TextTruncateProps {
  text?: string;
  className?: string;
  as?: React.ElementType;
  width?: string | number;
  disableInteractivity?: boolean;
}

export function TextTruncate({
  text,
  className,
  as: Component = "span",
  width,
  disableInteractivity = false,
}: TextTruncateProps) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const hasOverflow =
          textRef.current.scrollWidth > textRef.current.offsetWidth;
        setIsOverflowing(hasOverflow);
      }
    };

    // Initial check
    checkOverflow();

    // Re-check on window resize
    window.addEventListener("resize", checkOverflow);

    // Use ResizeObserver for more granular detection (e.g. container resize)
    const observer = new ResizeObserver(checkOverflow);
    if (textRef.current) {
      observer.observe(textRef.current);
    }

    return () => {
      window.removeEventListener("resize", checkOverflow);
      observer.disconnect();
    };
  }, [text]);

  if (!text) return null;

  const content = (
    <Component
      ref={textRef}
      className={cn("block whitespace-nowrap overflow-hidden", className)}
      style={{
        width: width,
        maskImage: isOverflowing
          ? "linear-gradient(to right, black 85%, transparent 100%)"
          : "none",
        WebkitMaskImage: isOverflowing
          ? "linear-gradient(to right, black 85%, transparent 100%)"
          : "none",
      }}
    >
      {text}
    </Component>
  );

  if (!isOverflowing) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          className={disableInteractivity ? "pointer-events-none" : undefined}
        >
          <p className="max-w-[300px] break-words text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
