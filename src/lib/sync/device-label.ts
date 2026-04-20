const getPlatform = (): string => {
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean; brands?: { brand: string }[] }
  }).userAgentData
  const ua = navigator.userAgent

  if (uaData?.platform) return uaData.platform
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Device'
}

const prettyDevice = (platform: string): string => {
  const p = platform.toLowerCase()
  if (p.includes('mac')) return 'MacBook'
  if (p.includes('ios') || p.includes('iphone')) return 'iPhone'
  if (p.includes('ipad')) return 'iPad'
  if (p.includes('android')) return 'Android phone'
  if (p.includes('win')) return 'Windows PC'
  if (p.includes('linux')) return 'Linux PC'
  if (p.includes('chrome os') || p.includes('cros')) return 'Chromebook'
  return platform
}

export const suggestDeviceName = (city: string | null | undefined): string => {
  const device = prettyDevice(getPlatform())
  return city ? `${device} in ${city}` : device
}
