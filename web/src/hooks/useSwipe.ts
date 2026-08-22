import { useRef, useState } from "react";

const THRESHOLD = 100;

export function useSwipe(onDecide: (liked: boolean) => void) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > THRESHOLD) {
      onDecide(dragX > 0);
    }
    setDragX(0);
  }

  const rotation = dragX / 18;
  const style: React.CSSProperties = {
    transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
    transition: dragging ? "none" : "transform 200ms ease",
  };

  return { style, dragX, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp } };
}
