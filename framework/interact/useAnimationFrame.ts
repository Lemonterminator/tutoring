import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** Calls onFrame(dt in seconds) every frame while running and while the element is on screen. */
export function useAnimationFrame(target: RefObject<Element>, onFrame: (dt: number) => void, running: boolean): void {
  const latest = useRef(onFrame);
  latest.current = onFrame;

  useEffect(() => {
    const element = target.current;
    if (!running || !element || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      latest.current(dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return stop;
    }
    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    observer.observe(element);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [running, target]);
}
