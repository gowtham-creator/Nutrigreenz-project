"use client";

import { useCallback, useRef, useState } from "react";

export interface DragSwipeOptions {
  /** Fired when the user drags right→left past the threshold ("next"). */
  onSwipeLeft?: () => void;
  /** Fired when the user drags left→right past the threshold ("previous"). */
  onSwipeRight?: () => void;
  /** Min horizontal travel (px) that counts as a committed swipe. Default 48. */
  threshold?: number;
  /** When false, gesture handling is disabled and offset stays 0. Default true. */
  enabled?: boolean;
  /**
   * Clamp the live follow-the-finger offset to ±this many px so the drag never
   * runs away past a soft edge. `undefined` = unclamped (offset === raw dx).
   */
  maxOffset?: number;
}

export interface DragSwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  /** Swallows the synthetic click that follows a committed swipe (so a CTA
   *  inside the draggable area doesn't fire when you meant to swipe). */
  onClickCapture: (e: React.MouseEvent) => void;
}

export interface DragSwipeState {
  /** Live horizontal offset (px) while dragging; 0 when idle. */
  offset: number;
  /** True while a horizontal drag is in progress (use to suppress transitions). */
  dragging: boolean;
  /** Spread onto the draggable element. Also add `touch-action: pan-y`. */
  handlers: DragSwipeHandlers;
}

/**
 * useDragSwipe — a small, reusable pointer/touch horizontal-swipe primitive.
 *
 * It unifies mouse + touch via Pointer Events, only "locks" onto the gesture
 * once horizontal intent beats vertical (so the page still scrolls vertically),
 * reports a live `offset` for follow-the-finger feedback, and calls
 * `onSwipeLeft`/`onSwipeRight` when a drag clears the threshold on release.
 *
 * It is deliberately layout-agnostic: the consumer decides what to do with
 * `offset` (translate a track, nudge a crossfade stack, …) and how to snap.
 * Momentum-free by design — release simply commits or springs back, and the
 * consumer animates the snap with its own CSS transition.
 */
export function useDragSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
  enabled = true,
  maxOffset,
}: DragSwipeOptions): DragSwipeState {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  // null = undecided, true = horizontal drag, false = vertical (yield to scroll)
  const locked = useRef<boolean | null>(null);
  const justSwiped = useRef(false);

  const reset = useCallback(() => {
    pointerId.current = null;
    locked.current = null;
    setDragging(false);
    setOffset(0);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      justSwiped.current = false;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      locked.current = null;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || pointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (locked.current === null) {
        // Wait for a clear direction before committing, so a vertical scroll
        // gesture is never hijacked.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          locked.current = true;
          setDragging(true);
          try {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          } catch {
            /* capture is best-effort */
          }
        } else {
          locked.current = false; // vertical — hand back to the page
        }
      }

      if (locked.current === true) {
        const clamped =
          maxOffset === undefined ? dx : Math.max(-maxOffset, Math.min(maxOffset, dx));
        setOffset(clamped);
      }
    },
    [enabled, maxOffset],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      if (locked.current === true && Math.abs(dx) > threshold) {
        justSwiped.current = true;
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      }
      reset();
    },
    [onSwipeLeft, onSwipeRight, threshold, reset],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      reset();
    },
    [reset],
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (justSwiped.current) {
      e.preventDefault();
      e.stopPropagation();
      justSwiped.current = false;
    }
  }, []);

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
