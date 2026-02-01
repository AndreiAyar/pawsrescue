import Link from "next/link";
import { ReactNode } from "react";
import {
  buttonShapeStyles,
  buttonSizeStyles,
  buttonVariantStyles,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  className?: string;
  innerClassName?: string;
  ariaLabel?: string;
}

export function LinkButton({
  href,
  children,
  variant,
  size = "md",
  shape = "square",
  className = "",
  innerClassName = "",
  ariaLabel,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`inline-flex border-[1.5px] font-bold ${buttonVariantStyles[variant].outer} ${buttonSizeStyles[size].outer} ${buttonShapeStyles[shape].outer} ${className}`}
    >
      <span
        className={`${buttonVariantStyles[variant].inner} ${buttonSizeStyles[size].inner} ${buttonShapeStyles[shape].inner} text-center border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] block -translate-y-0.5 transition-transform duration-100 ${innerClassName}`}
      >
        {children}
      </span>
    </Link>
  );
}
