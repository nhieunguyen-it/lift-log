import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import { ensureSeed } from '@/db';
import ExercisesPage from '@/pages/ExercisesPage';
import HistoryPage, { HistoryDetailPage } from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import WorkoutPage from '@/pages/WorkoutPage';

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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
