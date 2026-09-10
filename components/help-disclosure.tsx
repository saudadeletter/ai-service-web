"use client";

import { useEffect, useRef } from "react";

export function HelpDisclosure({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const revealTarget = () => {
      if (window.location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start", behavior: "instant" });
      }
    };
    revealTarget();
    window.addEventListener("hashchange", revealTarget);
    return () => window.removeEventListener("hashchange", revealTarget);
  }, [id]);
  return (
    <details id={id} ref={ref} className="help-disclosure">
      <summary>
        {title}
        <span aria-hidden="true">＋</span>
      </summary>
      <div className="help-disclosure-body">{children}</div>
    </details>
  );
}
