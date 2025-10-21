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
      className="cursor-pointer rounded-sm m-2 border-1 w-20 border-amber-600 bg-amber-500 "
      onClick={() => alert(`Hello from your ${appName} app!`)}
    >
      <span className="bg-white rounded-sm border-1 -mx-0.25 active:translate-y-0 hover:-translate-y-[0.210rem] border-amber-600 block -translate-y-0.5">
      {children}
      </span>

    </button>
  );
};
