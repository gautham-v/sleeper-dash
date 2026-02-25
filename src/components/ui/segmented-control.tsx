'use client';
import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

interface SegmentedControlItem {
  value: string;
  label: React.ReactNode;
}

interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  items: SegmentedControlItem[];
  className?: string;
}

export function SegmentedControl({ value, onValueChange, items, className }: SegmentedControlProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onValueChange(v); }}
      className={cn('inline-flex h-auto items-center rounded-lg bg-muted p-1 gap-0', className)}
    >
      {items.map((item) => (
        <ToggleGroupPrimitive.Item
          key={item.value}
          value={item.value}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
            'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'text-muted-foreground hover:text-foreground',
            'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
          )}
        >
          {item.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
