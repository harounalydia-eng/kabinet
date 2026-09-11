import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Shell } from './components/Shell'
import { Splash, useSplash } from './components/Splash'
import Home from './screens/Home'
import YourWorld from './screens/YourWorld'
import { usePhone } from './components/mobile/usePhone'
import ForYou from './screens/mobile/ForYou'
import SavedFeed from './screens/mobile/SavedFeed'
import ExploreFeed from './screens/mobile/ExploreFeed'
import Search from './screens/Search'
import Collections from './screens/Collections'
import Collection from './screens/Collection'
import Detail from './screens/Detail'
import Profile from './screens/Profile'
import Explore from './screens/Explore'
import MyKabinet from './screens/MyKabinet'
import Settings from './screens/Settings'
import ProductDetail from './screens/ProductDetail'
import Routines from './screens/Routines'
import RoutineDetail from './screens/RoutineDetail'
import RoutineEditor from './screens/RoutineEditor'
import RoutineRun from './screens/RoutineRun'
import Welcome from './screens/onboarding/Welcome'
import Auth from './screens/onboarding/Auth'
import Worlds from './screens/onboarding/Worlds'
import Intents from './screens/onboarding/Intents'
import ShortcutIntro from './screens/onboarding/ShortcutIntro'
import Connect from './screens/onboarding/Connect'
import Connected from './screens/onboarding/Connected'
import { useAccount } from './lib/account'
import { useAuth } from './lib/auth'
import { useInboxSync } from './lib/social/useInboxSync'
import { useStore } from './lib/store'

/**
 * Who may see what.
 *   signed out            → Welcome / Create / Sign in only
 *   signed in, not onboarded → the introduction, resumed at the furthest step reached
 *   signed in, onboarded  → the app; the introduction stays reachable on purpose (Settings → replay)
 * When the build has no account keys, "signed in" is simply "on this device".
 */
function useGate() {
  const { user, available } = useAuth()
  const { account, onboarded } = useAccount()
  const signedIn = available ? user !== null : true
  const resume = `/onboarding/${account.onboardingStep}`
  return { signedIn, onboarded, resume }
}

function Public({ children }: { children: React.ReactElement }) {
  const { signedIn, onboarded, resume } = useGate()
  if (signedIn) return <Navigate to={onboarded ? '/home' : resume} replace />
  return children
}

function Onboarding({ children }: { children: React.ReactElement }) {
  const { signedIn } = useGate()
  if (!signedIn) return <Navigate to="/welcome" replace />
  return children
}

function Protected() {
  const { signedIn, onboarded, resume } = useGate()
  const { pathname } = useLocation()
  if (!signedIn) return <Navigate to="/welcome" replace state={{ from: pathname }} />
  if (!onboarded) return <Navigate to={resume} replace />
  return <Shell />
}

export default function App() {
  const phone = usePhone()
  const { ready: storeReady } = useStore()
  const { loading: authLoading } = useAuth()
  const { ready: accountReady } = useAccount()
  const ready = storeReady && !authLoading && accountReady
  const phase = useSplash(ready)
  useInboxSync()

  return (
    <div data-phase={phase}>
      {ready && (
        <Routes>
          <Route path="/welcome" element={<Public><Welcome /></Public>} />
          <Route path="/create" element={<Public><Auth mode="create" /></Public>} />
          <Route path="/signin" element={<Public><Auth mode="signin" /></Public>} />

          <Route path="/onboarding/worlds" element={<Onboarding><Worlds /></Onboarding>} />
          <Route path="/onboarding/intents" element={<Onboarding><Intents /></Onboarding>} />
          <Route path="/onboarding/shortcut" element={<Onboarding><ShortcutIntro /></Onboarding>} />
          <Route path="/onboarding/connect" element={<Onboarding><Connect /></Onboarding>} />
          <Route path="/onboarding/connected" element={<Onboarding><Connected /></Onboarding>} />
          <Route path="/onboarding" element={<Navigate to="/onboarding/worlds" replace />} />

          <Route element={<Protected />}>
            <Route path="/" element={phone ? <ForYou /> : <YourWorld />} />
            <Route path="/home" element={<Home />} />
            <Route path="/saved" element={phone ? <SavedFeed /> : <YourWorld />} />
            <Route path="/explore" element={phone ? <ExploreFeed /> : <Explore />} />
            <Route path="/shop" element={<Explore />} />
            <Route path="/search" element={<Search />} />
            <Route path="/look/:id" element={<Detail />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/kabinet" element={<MyKabinet />} />
            <Route path="/routines" element={<Routines />} />
            <Route path="/routines/new" element={<RoutineEditor />} />
            <Route path="/routines/:id" element={<RoutineDetail />} />
            <Route path="/routines/:id/edit" element={<RoutineEditor />} />
            <Route path="/routines/:id/start" element={<RoutineRun />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/:id" element={<Collection />} />
            <Route path="/s/:id" element={<Detail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      <Splash phase={phase} />
    </div>
  )
}
