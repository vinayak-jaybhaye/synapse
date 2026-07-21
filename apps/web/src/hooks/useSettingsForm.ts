import { useState, useCallback, useEffect, useRef } from "react";

export interface UnsavedChanges {
  [key: string]: unknown;
}

export function useSettingsForm<T extends UnsavedChanges>(initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);

  const prevInitialDataRef = useRef(initialData);

  useEffect(() => {
    if (prevInitialDataRef.current !== initialData) {
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
    setData(initialData);
    setIsDirty(false);
  }, [initialData]);

  return {
    data,
    isDirty,
    handleChange,
    reset,
  };
}
