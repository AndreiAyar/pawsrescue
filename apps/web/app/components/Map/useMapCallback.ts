"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// SDK listeners keep a stable callback while reading the latest committed props.
export function useMapCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });
  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
