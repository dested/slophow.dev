import { useEffect } from 'react'

const SITE = 'slopshow'

export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : `${SITE} — show off the stuff you built with AI`
  }, [title])
}
