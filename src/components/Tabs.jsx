import { useCallback, useEffect, useState } from 'react'

function readTab(tabs, fallback) {
  const t = new URLSearchParams(location.search).get('tab')
  return tabs.some((x) => x.id === t) ? t : fallback
}

export function Tabs({ tabs, defaultTab = tabs[0]?.id, children }) {
  const [active, setActive] = useState(() => readTab(tabs, defaultTab))

  useEffect(() => {
    const onPop = () => setActive(readTab(tabs, defaultTab))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = useCallback((id) => {
    const url = new URL(location.href)
    url.searchParams.set('tab', id)
    history.pushState({}, '', url)
    setActive(id)
  }, [])

  return (
    <>
      <div className="tabbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children(active)}
    </>
  )
}
