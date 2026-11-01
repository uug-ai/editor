import type { ReactNode } from 'react'

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PlayIcon() {
  return (
    <Icon>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </Icon>
  )
}

export function PauseIcon() {
  return (
    <Icon>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    </Icon>
  )
}

export function StepBackIcon() {
  return (
    <Icon>
      <path d="M6 5v14M18 5.5 9 12l9 6.5z" />
    </Icon>
  )
}

export function StepForwardIcon() {
  return (
    <Icon>
      <path d="M18 5v14M6 5.5 15 12l-9 6.5z" />
    </Icon>
  )
}

export function MarkInIcon() {
  return (
    <Icon size={18}>
      <path d="M10 4H6v16h4M14 12h6M17 9l3 3-3 3" />
    </Icon>
  )
}

export function MarkOutIcon() {
  return (
    <Icon size={18}>
      <path d="M14 4h4v16h-4M10 12H4M7 9l-3 3 3 3" />
    </Icon>
  )
}

export function ScissorsIcon() {
  return (
    <Icon size={18}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.2 7.8 20 18M8.2 16.2 20 6" />
    </Icon>
  )
}

export function DownloadIcon() {
  return (
    <Icon size={18}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </Icon>
  )
}

export function UploadIcon({ size = 20 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />
    </Icon>
  )
}

export function FilmIcon() {
  return (
    <Icon size={18}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" />
    </Icon>
  )
}

export function SunIcon() {
  return (
    <Icon size={24}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </Icon>
  )
}

export function MoonIcon() {
  return (
    <Icon size={24}>
      <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  )
}

export function GitHubIcon() {
  return (
    <Icon size={24}>
      <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.9a3.4 3.4 0 0 0-1-2.7c3.4-.4 7-1.7 7-7.5a5.9 5.9 0 0 0-1.6-4.1A5.5 5.5 0 0 0 19.3 0S18 0 15 1.6a14.3 14.3 0 0 0-6 0C6 0 4.7 0 4.7 0a5.5 5.5 0 0 0-.1 3.8A5.9 5.9 0 0 0 3 8c0 5.8 3.6 7.1 7 7.5a3.4 3.4 0 0 0-1 2.7V22" />
    </Icon>
  )
}
