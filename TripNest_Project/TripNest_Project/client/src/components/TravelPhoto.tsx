import { useState } from 'react';

// #explain_notes: Local, licensed photos keep the preview independent of a stock-photo server.
export default function TravelPhoto({
  name,
  alt,
  className = '',
  priority = false,
}: {
  name: 'lake-como' | 'barcelona' | 'hotel-pool';
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className={`travel-photo photo-fallback ${className}`}
      role="img"
      aria-label={alt}
    >
      <span>Discover somewhere new.</span>
    </div>
  ) : (
    <img
      className={`travel-photo ${className}`}
      src={`/images/${name}.jpg`}
      alt={alt}
      width={name === 'lake-como' ? 1600 : 1000}
      height={1000}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
