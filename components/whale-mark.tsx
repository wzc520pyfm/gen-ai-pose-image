export function WhaleMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill="#2a211c" />
      <path
        fill="#f3e6d4"
        d="M8 28c2-8 10-14 18-13 2-4 8-6 13-3-1 2-1 4 0 6 3 1 5 4 5 8-4 1-7 4-8 8-6 2-14 1-20-3-2 2-5 3-8 2 1-2 1-4 0-5Z"
      />
      <circle cx="33" cy="22" r="1.3" fill="#9a3b28" />
      <path d="M14 20c2 1 3 3 2 5" stroke="#9a3b28" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
