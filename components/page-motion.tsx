"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || preference.matches || !element.animate) return;
    const animations: Animation[] = [];
    const enter = (target: Element, distance: number, duration: number) => {
      animations.push(
        target.animate(
          [
            { opacity: 0.35, transform: `translateY(${distance}px)` },
            { opacity: 1, transform: "none" },
          ],
          { duration, easing: "cubic-bezier(.22, 1, .36, 1)" },
        ),
      );
    };
    enter(element, 8, 280);
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  if (!preference.matches) enter(entry.target, 18, 480);
                  observer?.unobserve(entry.target);
                }
              });
            },
            { threshold: 0.12 },
          )
        : null;
    element.querySelectorAll("[data-reveal]").forEach((target) => {
      if (target.getBoundingClientRect().top >= window.innerHeight)
        observer?.observe(target);
    });
    const cancelAnimations = () => {
      if (preference.matches)
        animations.forEach((animation) => animation.cancel());
    };
    preference.addEventListener("change", cancelAnimations);
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", cancelAnimations);
    };
  }, [pathname]);

  return (
    <div className="page-content" ref={root}>
      {children}
    </div>
  );
}
