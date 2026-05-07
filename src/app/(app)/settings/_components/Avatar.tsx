type Props = {
  url: string | null
  firstName: string
  lastName: string
  email: string | null
  size?: number
}

// Renders the user's uploaded avatar, or initials on a colored background
// derived from their name when no image is set. Used in the Account section
// and (later) anywhere we surface "who's logged in".
export function Avatar({ url, firstName, lastName, email, size = 64 }: Props) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Avatar"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  const initials = computeInitials(firstName, lastName, email)
  const bg = colorFromString(`${firstName}${lastName}${email ?? ''}`)

  return (
    <div
      className="flex items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  )
}

function computeInitials(firstName: string, lastName: string, email: string | null): string {
  const f = firstName.trim().charAt(0)
  const l = lastName.trim().charAt(0)
  if (f || l) return (f + l).toUpperCase() || '?'
  if (email) return email.charAt(0).toUpperCase()
  return '?'
}

// Stable hash → hue. Saturation/lightness fixed so every avatar reads on a
// dark or light surface without per-user tuning.
function colorFromString(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 45%)`
}
