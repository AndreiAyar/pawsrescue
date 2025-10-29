"use client";

import { ReactNode } from "react";


const ButtonTypesStyles = {
  main: {
    div: "bg-amber-600 border-amber-700",
    span: "bg-amber-500 border-amber-700",
  },
  secondary: {
    div: "bg-amber-500 border-amber-600",
    span: "bg-white border-amber-600",
  },
};

interface ButtonProps {
  children: ReactNode;
  className?: string;
  buttonType: "main" | "secondary";
  onClick?: () => void;
  interactive?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
}

export const Button = ({
  children,
  buttonType,
  type="button",
  onClick,
  interactive = true,
  href,
  className = "",
}: ButtonProps) => {
  const baseDivClass = `cursor-pointer text-sm font-bold rounded-sm m-2 inline-block border-[1.5px] min-w-30 ${ButtonTypesStyles[buttonType].div} ${className}`;
  const baseSpanClass = `${ButtonTypesStyles[buttonType].span} px-6 py-2 text-center rounded-sm border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] block -translate-y-0.5 transition-transform duration-100`;

  if (interactive) {
    return (
      <button
        type={type}
        className={baseDivClass}
        onClick={onClick}
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
    >
      <span className={baseSpanClass}>{children}</span>
    </a>
  );
};
