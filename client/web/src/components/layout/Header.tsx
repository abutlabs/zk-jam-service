'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ServiceSelector } from '@/components/ServiceSelector';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/verify', label: 'Verify' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/learn', label: 'Learn' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo - Polkadot style */}
          <Link href="/" className="flex items-center gap-3">
            {/* Polkadot dots logo - 3D spherical pattern */}
            <svg viewBox="0 0 100 100" className="h-8 w-8" fill="#1a1a1a">
              {/* Center large dot */}
              <circle cx="50" cy="50" r="14" />
              {/* Top dot - ellipse tilted */}
              <ellipse cx="50" cy="18" rx="8" ry="5" />
              {/* Bottom dot - ellipse tilted */}
              <ellipse cx="50" cy="82" rx="8" ry="5" />
              {/* Upper left - large circle */}
              <circle cx="22" cy="35" r="10" />
              {/* Upper right - ellipse tilted */}
              <ellipse cx="78" cy="35" rx="5" ry="9" transform="rotate(-25 78 35)" />
              {/* Lower left - large circle */}
              <circle cx="22" cy="65" r="10" />
              {/* Lower right - ellipse tilted */}
              <ellipse cx="78" cy="65" rx="5" ry="9" transform="rotate(25 78 65)" />
            </svg>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-[#1a1a1a]'
                    : 'text-gray-500 hover:text-[#1a1a1a]'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Service selector */}
          <ServiceSelector />
        </div>
      </div>
    </header>
  );
}
