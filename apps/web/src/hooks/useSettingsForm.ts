import { useState, useCallback, useEffect } from 'react';

export interface UnsavedChanges {
  [key: string]: any;
}

export function useSettingsForm<T extends UnsavedChanges>(initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);

  // Reset local state when initial data changes (e.g. after save)
  const initialDataStr = JSON.stringify(initialData);
  useEffect(() => {
    setData(initialData);
    setIsDirty(false);
  }, [initialDataStr]);

  const handleChange = useCallback((key: keyof T, value: any) => {
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
