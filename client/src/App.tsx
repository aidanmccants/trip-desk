import { useEffect, useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useSession } from './lib/queries';
import { IconButton, Skeleton, cx } from './components/ui';
import { Landing } from './features/auth/Landing';
import { Sidebar } from './features/shell/Sidebar';
import { useShortcuts } from './features/shell/shortcuts';
import { HomePane } from './features/trips/HomePane';
import { TripView } from './features/trips/TripView';
import { InboxPage } from './features/inbox/InboxPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  const session = useSession();
  if (session.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  if (!session.data) return <Landing />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePane />} />
        <Route path="trips/:tripId/:tab?" element={<TripView />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<HomePane />} />
      </Route>
    </Routes>
  );
}

/** Sidebar + main pane. Under 768px the sidebar becomes a slide-over drawer. */
function Layout() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);
  useShortcuts();
  return (
    <div className="flex h-full">
      <div className={cx('fixed inset-0 z-40 bg-black/40 md:hidden', drawer ? 'block' : 'hidden')} onClick={() => setDrawer(false)} />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 w-sidebar shrink-0 border-r border-separator/50 bg-card-2 transition-transform md:static md:translate-x-0',
          drawer ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar onNavigate={() => setDrawer(false)} />
      </aside>
      <main id="main-pane" className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 flex items-center gap-2 bg-bg/80 px-4 py-2 backdrop-blur md:hidden">
          <IconButton icon={Menu} label="Trips" onClick={() => setDrawer(true)} />
          <span className="text-headline">Trip Desk</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
