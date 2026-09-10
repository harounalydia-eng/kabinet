import { Navigate, Route, Routes } from 'react-router'
import { Shell } from './components/Shell'
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

export default function App() {
  const phone = usePhone()
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={phone ? <ForYou /> : <YourWorld />} />
        <Route path="/home" element={phone ? <Home /> : <Navigate to="/" replace />} />
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
  )
}
