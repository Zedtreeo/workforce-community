'use client';

interface Tab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-0.5 border-b border-surface-200 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
              ${isActive
                ? 'text-brand-600'
                : 'text-content-tertiary hover:text-content-secondary'
              }
            `}
          >
            {tab.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-md text-xs ${isActive ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-content-tertiary'}`}>
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
