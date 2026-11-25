import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to provide smooth, draggable, track-clickable custom scrollbar
 * with 7px width, fixed thumb height (default 80px), and automatic overflow detection.
 */
export default function useCustomScrollbar({ thumbHeight = 65, deps = [] } = {}) {
  const [thumbOffset, setThumbOffset] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  const updateThumb = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 1) {
      setHasOverflow(false);
      setThumbOffset(0);
      return;
    }

    setHasOverflow(true);

    const track = trackRef.current;
    const trackHeight = track ? track.clientHeight : clientHeight;
    const maxTravel = Math.max(0, trackHeight - thumbHeight);

    if (maxTravel > 0 && maxScroll > 0) {
      const offset = (scrollTop / maxScroll) * maxTravel;
      setThumbOffset(Math.max(0, Math.min(maxTravel, offset)));
    } else {
      setThumbOffset(0);
    }
  }, [thumbHeight]);

  const handleScroll = () => {
    if (!isDraggingRef.current) {
      updateThumb();
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartOffsetRef.current = thumbOffset;

    const handlePointerMove = (moveEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      moveEvent.preventDefault();

      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const track = trackRef.current;
      const container = containerRef.current;
      const trackHeight = track ? track.clientHeight : container.clientHeight;
      const maxTravel = Math.max(0, trackHeight - thumbHeight);
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxTravel <= 0 || maxScroll <= 0) return;

      const nextOffset = Math.max(0, Math.min(maxTravel, dragStartOffsetRef.current + deltaY));
      setThumbOffset(nextOffset);
      container.scrollTop = (nextOffset / maxTravel) * maxScroll;
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      updateThumb();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleTrackClick = (e) => {
    if (thumbRef.current && (e.target === thumbRef.current || thumbRef.current.contains(e.target))) {
      return;
    }
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const trackHeight = track.clientHeight;
    const maxTravel = Math.max(0, trackHeight - thumbHeight);
    const maxScroll = container.scrollHeight - container.clientHeight;

    if (maxTravel <= 0 || maxScroll <= 0) return;

    const targetOffset = Math.max(0, Math.min(maxTravel, clickY - thumbHeight / 2));
    setThumbOffset(targetOffset);
    container.scrollTop = (targetOffset / maxTravel) * maxScroll;
  };

  useEffect(() => {
    updateThumb();

    const container = containerRef.current;
    let resizeObserver = null;
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateThumb();
      });
      resizeObserver.observe(container);
      if (container.firstElementChild) {
        resizeObserver.observe(container.firstElementChild);
      }
    }

    const timer = setTimeout(updateThumb, 50);

    window.addEventListener("resize", updateThumb);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateThumb);
      if (resizeObserver) resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateThumb, ...deps]);

  return {
    containerRef,
    trackRef,
    thumbRef,
    thumbOffset,
    hasOverflow,
    isDragging,
    handleScroll,
    handlePointerDown,
    handleTrackClick,
    recalculate: updateThumb,
  };
}
