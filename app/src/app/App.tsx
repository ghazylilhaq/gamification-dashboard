import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardProvider } from '@/hooks/useDashboard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/states';

/**
 * Routes load on demand.
 *
 * Recharts is most of the bundle, so splitting per route keeps it out of the
 * admin and catalog pages — which matters on a phone connection more than the
 * extra request costs.
 */
const Overview = lazy(() => import('@/pages/Overview').then((m) => ({ default: m.Overview })));
const Trends = lazy(() => import('@/pages/Trends').then((m) => ({ default: m.Trends })));
const Activity = lazy(() => import('@/pages/Activity').then((m) => ({ default: m.Activity })));
const Budget = lazy(() => import('@/pages/Budget').then((m) => ({ default: m.Budget })));
const Rewards = lazy(() => import('@/pages/Rewards').then((m) => ({ default: m.Rewards })));
const Redemption = lazy(() => import('@/pages/Redemption').then((m) => ({ default: m.Redemption })));
const Gacha = lazy(() => import('@/pages/Gacha').then((m) => ({ default: m.Gacha })));
const Catalog = lazy(() => import('@/pages/Catalog').then((m) => ({ default: m.Catalog })));
const AdminUpload = lazy(() => import('@/pages/AdminUpload').then((m) => ({ default: m.AdminUpload })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));

export function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Lazy><Overview /></Lazy>} />
            <Route path="/trends" element={<Lazy><Trends /></Lazy>} />
            <Route path="/activity" element={<Lazy><Activity /></Lazy>} />
            <Route path="/budget" element={<Lazy><Budget /></Lazy>} />
            <Route path="/rewards" element={<Lazy><Rewards /></Lazy>} />
            <Route path="/redemption" element={<Lazy><Redemption /></Lazy>} />
            <Route path="/gacha" element={<Lazy><Gacha /></Lazy>} />
            <Route path="/catalog" element={<Lazy><Catalog /></Lazy>} />
            <Route path="/admin/upload" element={<Lazy><AdminUpload /></Lazy>} />
            <Route path="*" element={<Lazy><NotFound /></Lazy>} />
          </Route>
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Card>
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="h-48" />
        </Card>
      }
    >
      {children}
    </Suspense>
  );
}
