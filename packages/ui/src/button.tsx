"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  appName: string;
}

export const Button = ({ children, appName }: ButtonProps) => {
  return (
    <button
      type="button"
      className="cursor-pointer text-md font-bold rounded-sm m-2 border-[1.5px] w-30 border-amber-600 bg-amber-500"
      aria-label={`Button for ${appName}`}
      onClick={()=> alert(1)}
    >
      <span
      className="bg-white rounded-sm border-[1.5px] -mx-[1.5px] active:-translate-y-[0.080rem] hover:-translate-y-[0.210rem] border-amber-600 block -translate-y-0.5 transition-transform duration-100"
      aria-hidden="true"
      >
      {children}
      </span>
    </button>
  );
};
