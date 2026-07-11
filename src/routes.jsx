import { useState, useEffect } from 'react'
import { viewTokenFromUrl, linkFor } from './lib/format.js'

export function useRoute() {
  const [vt, setVt] = useState(viewTokenFromUrl)

  useEffect(() => {
    const onPop = () => setVt(viewTokenFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (newVt) => {
    history.pushState({}, '', newVt ? linkFor(newVt) : `${location.origin}${location.pathname}`)
    setVt(newVt)
  }

  return { vt, go }
}
