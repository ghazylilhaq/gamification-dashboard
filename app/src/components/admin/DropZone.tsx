import { useRef, useState, type DragEvent } from 'react';
import { Button } from '../ui/Button';

/**
 * Drop zone with a file-picker fallback.
 *
 * On phones drag-and-drop is not a real gesture, so there the picker is the
 * primary control and the drop affordance is hidden entirely.
 */
export function DropZone({
  onFiles,
  label,
  hint,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = [...e.dataTransfer.files].filter((f) => f.name.toLowerCase().endsWith('.csv'));
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-10 ${
        dragging ? 'border-allo-yellow bg-allo-yellow-tint/30' : 'border-line-1 bg-surface-2'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {/* One node, not a hidden desktop/mobile pair — duplicated copy gets
          announced twice by a screen reader. Dragging is desktop-only anyway. */}
      <p className="font-semibold text-ink-1">{dragging ? 'Drop to add these files' : label}</p>
      <p className="mx-auto mt-1 max-w-md text-micro leading-relaxed text-ink-4">{hint}</p>
      <div className="mt-4">
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Choose files
        </Button>
        <p className="mt-2 hidden text-micro text-ink-5 sm:block">or drag them here</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length > 0) onFiles(files);
          // Reset so re-selecting the same file still fires a change event.
          e.target.value = '';
        }}
      />
    </div>
  );
}
