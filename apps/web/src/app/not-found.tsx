import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-brand-600 mb-2">404</p>
        <h2 className="text-lg font-bold text-content-primary mb-1">Page not found</h2>
        <p className="text-sm text-content-tertiary mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Home size={14} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
