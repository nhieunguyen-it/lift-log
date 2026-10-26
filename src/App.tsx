import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import { ensureSeed } from '@/db';
import AnalyzePage from '@/pages/AnalyzePage';
import ExercisesPage from '@/pages/ExercisesPage';
import HistoryPage, { HistoryDetailPage } from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import WorkoutPage from '@/pages/WorkoutPage';
import ProgramsPage from '@/pages/ProgramsPage';

// The guide (content + renderer + search) is only loaded when opened.
const GuidePage = lazy(() => import('@/pages/GuidePage'));

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    ensureSeed().then(
      () => !cancelled && setStatus('ready'),
      (err) => {
        console.error(err);
        if (!cancelled) setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') return null;
  if (status === 'error') {
    return (
      <p role="alert" className="p-6">
        Could not open the local database. Storage may be disabled in this browser.
      </p>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WorkoutPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:id" element={<HistoryDetailPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="analyze" element={<AnalyzePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:id" element={<ProgramsPage />} />
          <Route
            path="guide"
            element={
              <Suspense fallback={<p role="status">Loading guide…</p>}>
                <GuidePage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
