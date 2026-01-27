import Link from "next/link";
import { ReactNode } from "react";

type Variant = "main" | "secondary";

const variantStyles: Record<
  Variant,
  { outer: string; inner: string }
> = {
  main: {
    outer: "bg-amber-600 border-amber-700",
    inner: "bg-amber-500 border-amber-700 text-slate-900",
  },
  secondary: {
    outer: "bg-amber-500 border-amber-600",
    inner: "bg-white border-amber-600 text-slate-900",
  },
};

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant: Variant;
  className?: string;
  ariaLabel?: string;
}

export function LinkButton({
  href,
  children,
  variant,
  className = "",
  ariaLabel,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`inline-flex rounded-sm border-[1.5px] text-sm font-bold ${variantStyles[variant].outer} ${className}`}
    >
      <span
        className={`px-6 py-2 text-center rounded-sm border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] block -translate-y-0.5 transition-transform duration-100 ${variantStyles[variant].inner}`}
      >
        {children}
      </span>
    </Link>
  );
}
