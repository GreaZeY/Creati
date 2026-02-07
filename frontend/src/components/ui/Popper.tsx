import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface PopperProps {
  children: ReactNode;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClickAway?: () => void;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  offset?: { x: number; y: number };
}

export function Popper({
  children,
  anchorEl,
  open,
  onClickAway,
  placement = "bottom-start",
  offset = { x: 0, y: 4 },
}: PopperProps) {
  const popperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position based on anchor element
  useEffect(() => {
    if (!anchorEl || !open || !popperRef.current) return;

    const updatePosition = () => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const popperRect = popperRef.current?.getBoundingClientRect();
      if (!popperRect) return;

      let top = 0;
      let left = 0;

      // Calculate initial position based on placement
      switch (placement) {
        case "bottom-start":
          top = anchorRect.bottom + offset.y;
          left = anchorRect.left + offset.x;
          break;
        case "bottom-end":
          top = anchorRect.bottom + offset.y;
          left = anchorRect.right + offset.x - popperRect.width;
          break;
        case "top-start":
          top = anchorRect.top - offset.y - popperRect.height;
          left = anchorRect.left + offset.x;
          break;
        case "top-end":
          top = anchorRect.top - offset.y - popperRect.height;
          left = anchorRect.right + offset.x - popperRect.width;
          break;
      }

      // Viewport bounds
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8; // Minimum margin from viewport edge

      // Check and adjust horizontal overflow
      if (left + popperRect.width > viewportWidth - margin) {
        // Overflows right, shift left
        left = viewportWidth - popperRect.width - margin;
      }
      if (left < margin) {
        // Overflows left, shift right
        left = margin;
      }

      // Check and adjust vertical overflow
      if (top + popperRect.height > viewportHeight - margin) {
        // Overflows bottom, try flipping to top
        if (placement.startsWith("bottom")) {
          top = anchorRect.top - offset.y - popperRect.height;
        } else {
          // Already at top, just shift up
          top = viewportHeight - popperRect.height - margin;
        }
      }
      if (top < margin) {
        // Overflows top, try flipping to bottom
        if (placement.startsWith("top")) {
          top = anchorRect.bottom + offset.y;
        } else {
          // Already at bottom, just shift down
          top = margin;
        }
      }

      setPosition({ top, left });
    };

    // Small delay to ensure popper is rendered and has dimensions
    const timeoutId = setTimeout(updatePosition, 0);

    // Update on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorEl, open, placement, offset]);

  // Handle click away
  useEffect(() => {
    if (!open || !onClickAway) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on anchor or popper content
      if (anchorEl?.contains(target) || popperRef.current?.contains(target)) {
        return;
      }

      onClickAway();
    };

    // Use capture phase to ensure we catch the event first
    document.addEventListener("mousedown", handleClickAway, true);

    return () => {
      document.removeEventListener("mousedown", handleClickAway, true);
    };
  }, [open, onClickAway, anchorEl]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popperRef}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
