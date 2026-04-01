const ONBOARDING_COOKIE_NAME = 'pdfation_onboarding_seen'
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

export const hasSeenOnboardingCookie = () => {
  if (typeof document === 'undefined') {
    return false
  }

  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .some((entry) => entry === `${ONBOARDING_COOKIE_NAME}=1`)
}

export const markOnboardingSeenCookie = () => {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = [
    `${ONBOARDING_COOKIE_NAME}=1`,
    `Max-Age=${ONE_YEAR_IN_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ')
}
