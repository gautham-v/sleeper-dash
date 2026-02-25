import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary';

interface MetricTooltipProps {
  metricKey: GlossaryKey;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function MetricTooltip({ metricKey, side = 'top' }: MetricTooltipProps) {
  const entry = GLOSSARY[metricKey];
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What is ${entry.name}?`}
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            <HelpCircle size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side}>
          <p className="font-semibold text-foreground mb-1">{entry.name}</p>
          <p className="text-muted-foreground leading-relaxed">{entry.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
