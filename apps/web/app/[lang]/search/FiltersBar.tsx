"use client";

import { useEffect, useRef } from "react";

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
        <button
          key={item}
          type="button"
          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100"
        >
          {item}
        </button>
      ))}
    </section>
  );
}
