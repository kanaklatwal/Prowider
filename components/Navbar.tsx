'use client';
// components/Navbar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/request-service', label: 'Request Service' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/test-tools', label: 'Test Tools' },
  ];

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        Pro<span>wider</span>
      </Link>
      <div className="nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${pathname === l.href ? 'active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
