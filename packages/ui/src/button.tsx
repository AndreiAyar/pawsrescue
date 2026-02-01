"use client";

import { ReactNode } from "react";
import {
  buttonShapeStyles,
  buttonSizeStyles,
  buttonVariantStyles,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  buttonType: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  onClick?: () => void;
  interactive?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const Button = ({
  children,
  buttonType,
  size = "md",
  shape = "square",
  type = "button",
  onClick,
  interactive = true,
  href,
  className = "",
  innerClassName = "",
  ariaLabel,
  disabled = false,
}: ButtonProps) => {
  const baseDivClass = `cursor-pointer font-bold border-[1.5px] min-w-30 disabled:cursor-not-allowed disabled:opacity-70 ${buttonVariantStyles[buttonType].outer} ${buttonSizeStyles[size].outer} ${buttonShapeStyles[shape].outer} ${className}`;
  const baseSpanClass = `${buttonVariantStyles[buttonType].inner} ${buttonSizeStyles[size].inner} ${buttonShapeStyles[shape].inner} text-center border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] block -translate-y-0.5 transition-transform duration-100 ${innerClassName}`;

  if (interactive) {
    return (
      <button
        type={type}
        className={baseDivClass}
        onClick={onClick}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={baseSpanClass}>{children}</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      className={baseDivClass}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <span className={baseSpanClass}>{children}</span>
    </a>
  );
};
