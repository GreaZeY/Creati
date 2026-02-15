import Moveable from "react-moveable";
import type { OverlayItem } from "./VideoEditorModal";

interface MoveableControllerProps {
  moveableRef: React.RefObject<Moveable | null>;
  target: HTMLElement;
  container: HTMLElement | null;
  containerSize: { width: number; height: number };
  selectedId: string;
  onUpdate: (id: string, updates: Partial<OverlayItem>) => void;
}

export function MoveableController({
  moveableRef,
  target,
  container,
  containerSize,
  selectedId,
  onUpdate,
}: MoveableControllerProps) {
  return (
    <Moveable
      ref={moveableRef}
      target={target}
      container={container}
      draggable
      resizable
      rotatable
      throttleDrag={1}
      throttleResize={1}
      throttleRotate={1}
      renderDirections={["nw", "ne", "sw", "se"]}
      rotationPosition="top"
      origin={false}
      padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
      onDrag={({ target: t, left, top }) => {
        t.style.left = `${left}px`;
        t.style.top = `${top}px`;
      }}
      onDragEnd={({ target: t }) => {
        if (!containerSize.width) return;
        onUpdate(selectedId, {
          x: ((parseFloat(t.style.left) || 0) / containerSize.width) * 100,
          y: ((parseFloat(t.style.top) || 0) / containerSize.height) * 100,
        });
      }}
      onResize={({ target: t, width, height, drag }) => {
        t.style.width = `${width}px`;
        t.style.height = `${height}px`;
        t.style.left = `${drag.left}px`;
        t.style.top = `${drag.top}px`;
      }}
      onResizeEnd={({ target: t }) => {
        if (!containerSize.width) return;
        const left = parseFloat(t.style.left) || 0;
        const top = parseFloat(t.style.top) || 0;
        const w = parseFloat(t.style.width) || 0;
        const h = parseFloat(t.style.height) || 0;
        onUpdate(selectedId, {
          x: (left / containerSize.width) * 100,
          y: (top / containerSize.height) * 100,
          width: (w / containerSize.width) * 100,
          height: (h / containerSize.height) * 100,
        });
      }}
      onRotate={({ target: t, rotate }) => {
        t.style.transform = `rotate(${rotate}deg)`;
      }}
      onRotateEnd={({ target: t }) => {
        const match = t.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        if (match) {
          onUpdate(selectedId, { rotation: parseFloat(match[1]) });
        }
      }}
    />
  );
}
