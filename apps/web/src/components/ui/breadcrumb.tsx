'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="text-content-tertiary hover:text-content-secondary transition-colors"
      >
        <Home size={14} />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-content-tertiary" />
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="text-content-tertiary hover:text-content-secondary transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-content-primary font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
