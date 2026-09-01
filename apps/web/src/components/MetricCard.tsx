import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  highlight?: boolean;
  alert?: boolean;
}

export function MetricCard({ title, value, icon, trend, trendUp, highlight, alert }: MetricCardProps) {
  return (
    <div className={`p-5 rounded-lg border bg-surface/50 flex flex-col ${highlight ? 'border-primary/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : alert ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-border'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-base font-medium text-text-muted">{title}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="flex items-baseline space-x-2">
        <span className={`text-3xl font-display font-semibold ${highlight ? 'text-primary' : alert ? 'text-red-500' : 'text-text-main'}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
