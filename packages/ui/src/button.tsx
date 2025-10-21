"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  appName: string;
  onClick: () => void;
}

const ButtonTypesStyles = {
  main: {
    div: "bg-amber-600, border-amber-700",
    span: "bg-amber-500",
  },
  secondary: {
    div: "bg-amber-500, border-amber-600",
    span: "bg-white",
  },
};

export const Button = ({ children, onClick }: ButtonProps) => {
  return (
    <button
      type="button"
      className={`cursor-pointer text-md font-bold rounded-sm m-2 border-[1.5px] w-30 ${ButtonTypesStyles.main.div}`}
      onClick={onClick}
    >
      <span className="bg-white rounded-sm border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] border-amber-600 block -translate-y-0.5 transition-transform duration-100">
        {children}
      </span>
    </button>
  );
};
