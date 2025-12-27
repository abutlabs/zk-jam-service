'use client';

import { ReactNode } from 'react';
import { ServiceProvider } from '@/contexts/ServiceContext';

export function Providers({ children }: { children: ReactNode }) {
  return <ServiceProvider>{children}</ServiceProvider>;
}
