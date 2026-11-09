"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ImageLightboxProps = {
  src: string;
  alt: string;
  className?: string;
  buttonClassName?: string;
  closeLabel?: string;
  expandLabel?: string;
};

export function ImageLightbox({
  src,
  alt,
  className,
  buttonClassName,
  closeLabel = "Close image",
  expandLabel = "Enlarge image",
}: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={`group relative block cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${buttonClassName ?? ""}`}
        onClick={() => setIsOpen(true)}
        aria-label={`${expandLabel}: ${alt}`}
      >
        <img src={src} alt={alt} className={className} />
        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 shadow-lg backdrop-blur-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="m15 15 5 5m-5-5v4m0-4h4M9 9 4 4m5 5V5m0 4H5" />
          </svg>
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setIsOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl text-slate-900 shadow-xl transition hover:scale-105 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:right-8 sm:top-8"
              aria-label={closeLabel}
              autoFocus
            >
              &times;
            </button>
            <img
              src={src}
              alt={alt}
              className="max-h-[88vh] max-w-[92vw] rounded-2xl bg-white object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
