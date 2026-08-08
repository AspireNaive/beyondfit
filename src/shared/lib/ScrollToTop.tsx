import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Restores the browser's expected behaviour on navigation. React Router keeps
 * the scroll position across route changes, which reads as broken when you go
 * from halfway down the shop to a product page.
 *
 * Hash links are left alone so in-page anchors still work.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])

  return null
}
