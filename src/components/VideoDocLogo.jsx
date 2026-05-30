export default function VideoDocLogo({ size = 30 }) {
  const id = `vd-grad-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3f62ff" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="32" height="32" rx="7" fill={`url(#${id})`} />
      {/* Play triangle — left half */}
      <path d="M7 11.5 L7 20.5 L14.5 16 Z" fill="white" fillOpacity="0.95" />
      {/* Subtle divider */}
      <line x1="17" y1="8" x2="17" y2="24" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      {/* Document lines — right half */}
      <rect x="19" y="11.5" width="7" height="1.8" rx="0.9" fill="white" fillOpacity="0.9" />
      <rect x="19" y="15.1" width="7" height="1.8" rx="0.9" fill="white" fillOpacity="0.7" />
      <rect x="19" y="18.7" width="5" height="1.8" rx="0.9" fill="white" fillOpacity="0.5" />
    </svg>
  )
}
