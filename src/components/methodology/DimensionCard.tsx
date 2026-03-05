'use client';
import type { LucideIcon } from 'lucide-react';

interface DimensionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  variant?: 'compact' | 'expanded';
}

export function DimensionCard({ icon: Icon, label, description, variant = 'compact' }: DimensionCardProps) {
  return (
    <div className="flex items-start gap-3 bg-card-bg border border-card-border rounded-lg p-3">
      <div className="flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white leading-snug">{label}</div>
        <div className={`text-muted-foreground leading-relaxed mt-0.5 ${variant === 'expanded' ? 'text-sm' : 'text-xs'}`}>
          {description}
        </div>
      </div>
    </div>
  );
}
