import { useRoute } from './routes.jsx'
import { useTheme } from './theme/useTheme.js'
import { useSession } from './features/auth/useSession.js'
import { AuthBox } from './features/auth/AuthBox.jsx'
import { CreateTracker } from './features/trackers/CreateTracker.jsx'
import { MyTrackers } from './features/trackers/MyTrackers.jsx'
import { TrackerPage } from './features/trackers/TrackerPage.jsx'

export default function App() {
  const { vt, go } = useRoute()
  const { theme, toggle } = useTheme()
  const { session, signOut } = useSession()

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand" onClick={() => go(null)}>Tal<b>ly</b></div>
        <div className="topright">
          <button className="iconbtn" onClick={toggle} title="Toggle mood">
            {theme === 'light' ? '☾' : '☀'}
          </button>
          {session
            ? <button className="linkbtn" onClick={signOut}>sign out</button>
            : <span className="who">guest</span>}
        </div>
      </header>

      {vt ? (
        <TrackerPage vt={vt} session={session} go={go} />
      ) : (
        <>
          <CreateTracker go={go} />
          {session ? <MyTrackers key={session.user.id} go={go} /> : <AuthBox />}
        </>
      )}
    </div>
  )
}
