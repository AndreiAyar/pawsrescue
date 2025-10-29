'use client';
import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  name:string;
  error?: string;
  children: ReactNode;
}

export const FormField = ({ label, name, error, children }: FormFieldProps) => {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center text-sm text-red-600 mt-1 font-[500]">
          <span className="mr-1">
            <svg
              className="w-4 h-4 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </span>
          {error}
        </p>
      )}
    </div>
  );
};
