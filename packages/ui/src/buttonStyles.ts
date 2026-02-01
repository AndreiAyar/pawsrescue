export type ButtonVariant =
  | "main"
  | "secondary"
  | "mint"
  | "peach"
  | "butter"
  | "ink";

export type ButtonSize = "sm" | "md";

export type ButtonShape = "square" | "pill";

export const buttonVariantStyles: Record<
  ButtonVariant,
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
  mint: {
    outer: "bg-emerald-50 border-emerald-300",
    inner: "bg-white border-emerald-300 text-emerald-900",
  },
  peach: {
    outer: "bg-orange-500 border-orange-600",
    inner: "bg-[color:var(--peach)] border-orange-600 text-amber-900",
  },
  butter: {
    outer: "bg-amber-300 border-amber-400",
    inner: "bg-[color:var(--butter)] border-amber-400 text-amber-900",
  },
  ink: {
    outer: "bg-slate-900 border-slate-900",
    inner: "bg-slate-100 border-slate-900 text-slate-900",
  },
};

export const buttonSizeStyles: Record<
  ButtonSize,
  { outer: string; inner: string }
> = {
  sm: {
    outer: "text-xs",
    inner: "px-3 py-1.5",
  },
  md: {
    outer: "text-sm",
    inner: "px-6 py-2",
  },
};

export const buttonShapeStyles: Record<
  ButtonShape,
  { outer: string; inner: string }
> = {
  square: {
    outer: "rounded-sm",
    inner: "rounded-sm",
  },
  pill: {
    outer: "rounded-full",
    inner: "rounded-full",
  },
};
