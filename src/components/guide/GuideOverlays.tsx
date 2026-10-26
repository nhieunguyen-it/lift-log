import type { ReactNode } from 'react';
import Onboarding from './Onboarding';
import WhatsNewDialog from './WhatsNewDialog';

/** Mount once inside the router (e.g. in AppShell). */
export default function GuideOverlays({ programChooser }: { programChooser?: ReactNode }) {
  return (
    <>
      <Onboarding programChooser={programChooser} />
      <WhatsNewDialog />
    </>
  );
}
