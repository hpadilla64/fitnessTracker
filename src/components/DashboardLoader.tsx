'use client';

import dynamic from 'next/dynamic';

// G2 and Leaflet touch window/document, so the dashboard renders client-side only
const Dashboard = dynamic(() => import('./Dashboard').then((m) => m.Dashboard), { ssr: false });

export function DashboardLoader() {
  return <Dashboard />;
}
