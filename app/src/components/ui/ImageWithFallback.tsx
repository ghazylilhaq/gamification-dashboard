import { useState } from 'react';

/**
 * Reward and box artwork is served from the campaign's COS bucket, which is
 * outside our control — links rot and the bucket is occasionally unreachable.
 * A failed image falls back to the reward's initials rather than a broken icon.
 */
export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackLabel,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        role="img"
        className={`flex items-center justify-center bg-surface-3 text-micro font-semibold text-ink-5 ${className}`}
      >
        {initials(fallbackLabel ?? alt)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-surface-3 object-contain ${className}`}
    />
  );
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
