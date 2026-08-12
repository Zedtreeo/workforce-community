interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', padding = 'md', hover }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-surface-200 shadow-xs ${paddingStyles[padding]} ${hover ? 'hover:shadow-sm hover:border-surface-300 transition-all duration-150' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold text-content-primary ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-content-tertiary ${className}`}>{children}</p>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, changeType = 'neutral', icon }: StatCardProps) {
  const changeColor = changeType === 'positive' ? 'text-success-dark' : changeType === 'negative' ? 'text-danger-dark' : 'text-content-tertiary';
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-content-tertiary mb-1">{label}</p>
          <p className="text-2xl font-bold text-content-primary tracking-tight">{value}</p>
          {change && <p className={`text-xs mt-1 font-medium ${changeColor}`}>{change}</p>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
