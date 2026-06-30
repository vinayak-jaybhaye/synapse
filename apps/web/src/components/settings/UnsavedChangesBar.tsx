import React from "react";

interface UnsavedChangesBarProps {
  show: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export default function UnsavedChangesBar({
  show,
  onSave,
  onDiscard,
  isSaving,
}: UnsavedChangesBarProps) {
  if (!show) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <div className="bg-bg-tertiary border border-border-custom shadow-md rounded p-2 flex items-center justify-between text-xs">
        <span className="font-medium text-text-primary pl-2">
          Careful — you have unsaved changes!
        </span>
        <div className="flex gap-2 items-center">
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="px-3 py-1 text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <>
                <div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
