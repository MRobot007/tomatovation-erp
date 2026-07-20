/**
 * Device, browser and location captured at punch time.
 *
 * All of it is advisory metadata for the attendance record — never trusted for
 * anything security-relevant. A user agent is trivially spoofed and geolocation
 * can be simulated, so these answer "roughly where and on what" for a human
 * reading the log, nothing more.
 */

export interface ClientContext {
  device: string
  browser: string
}

/**
 * Deliberately coarse. Precise UA parsing needs a library that ships a large
 * table and still goes stale; a manager reading the log wants "Windows /
 * Chrome", not a version string.
 */
export function detectClientContext(userAgent = navigator.userAgent): ClientContext {
  const ua = userAgent

  const device = /iPhone|iPod/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? 'Android phone'
          : 'Android tablet'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown device'

  // Order matters: Edge and Opera both include "Chrome" in their UA, and
  // Chrome includes "Safari". Checking the most specific first is the only way
  // this comes out right.
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Unknown browser'

  return { device, browser }
}

export interface Coordinates {
  lat: number
  lng: number
}

/**
 * Never blocks the punch. The spec is explicit: ask for permission, but a
 * denial or a slow fix must not stop someone clocking in. Resolves to null on
 * refusal, error, or timeout.
 */
export function requestCoordinates(timeoutMs = 5000): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: Coordinates | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    // Own timer as well as the API's: on some browsers a permission prompt left
    // unanswered never fires either callback, which would hang the punch button
    // indefinitely.
    const timer = window.setTimeout(() => finish(null), timeoutMs)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer)
        finish({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {
        window.clearTimeout(timer)
        finish(null)
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
