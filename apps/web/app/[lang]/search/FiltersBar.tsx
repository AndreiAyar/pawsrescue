"use client";

import { useEffect, useRef } from "react";
import { Button } from "@repo/ui/button";

type FiltersBarProps = {
  label: string;
  filters: string[];
};

export default function FiltersBar({ label, filters }: FiltersBarProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.innerWidth >= 640) {
      return;
    }
    const target = ref.current;
    if (!target) {
      return;
    }
    const timeout = setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section
      ref={ref}
      className="mt-6 mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
    >
      <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.4)]">
        {label}
      </span>
      {filters.map((item) => (
        <Button
          key={item}
          buttonType="butter"
          size="sm"
          shape="pill"
          className="m-0 min-w-0 font-semibold uppercase tracking-wide"
          innerClassName="text-[11px] leading-none"
        >
          {item}
        </Button>
      ))}
    </section>
  );
}
