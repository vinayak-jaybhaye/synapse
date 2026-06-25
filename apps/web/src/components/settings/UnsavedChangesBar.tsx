import React from "react";

interface UnsavedChangesBarProps {
  show: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export default function UnsavedChangesBar({ show, onSave, onDiscard, isSaving }: UnsavedChangesBarProps) {
  if (!show) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 animate-slideUp">
      <div className="bg-bg-tertiary border border-border-custom shadow-xl rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary pl-2">
          Careful — you have unsaved changes!
        </span>
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm font-medium text-text-primary hover:underline disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
