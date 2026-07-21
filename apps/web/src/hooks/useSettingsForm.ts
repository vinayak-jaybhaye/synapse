import { useState, useCallback, useEffect, useRef } from "react";

export interface UnsavedChanges {
  [key: string]: unknown;
}

function isShallowEqual<T extends Record<string, unknown>>(objA: T, objB: T): boolean {
  if (Object.is(objA, objB)) return true;
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !Object.is(objA[key], objB[key])) {
      return false;
    }
  }
  return true;
}

export function useSettingsForm<T extends UnsavedChanges>(initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);

  const prevInitialDataRef = useRef<T>(initialData);

  useEffect(() => {
    if (!isShallowEqual(prevInitialDataRef.current, initialData)) {
      prevInitialDataRef.current = initialData;
      setData(initialData);
      setIsDirty(false);
    }
  }, [initialData]);

  const handleChange = useCallback((key: keyof T, value: unknown) => {
    setData((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setIsDirty(true);
  }, []);

  const reset = useCallback(() => {
    setData(prevInitialDataRef.current);
    setIsDirty(false);
  }, []);

  return {
    data,
    isDirty,
    handleChange,
    reset,
  };
}
