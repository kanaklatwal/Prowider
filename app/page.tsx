// app/page.tsx
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      <div className="home-hero">
        <div className="hero-eyebrow">
          <span className="live-dot" />
          Lead Distribution System
        </div>
        <h1 className="hero-title">
          Connect customers to the right <span>providers</span>
        </h1>
        <p className="hero-desc">
          Submit a service enquiry and our system will automatically assign it to the best
          available providers — fairly, instantly, and reliably.
        </p>
        <div className="hero-actions">
          <Link href="/request-service" className="btn btn-primary">
            Submit a Request
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            View Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
