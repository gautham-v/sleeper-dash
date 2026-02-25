import { ArrowLeftRight, BookOpen, ClipboardList, LayoutDashboard, Scale, TrendingUp, Users } from 'lucide-react';

export const TABS = [
  { id: 'overview',   label: 'Overview',   icon: LayoutDashboard },
  { id: 'managers',   label: 'Managers',   icon: Users },
  { id: 'franchise',  label: 'Franchise',  icon: TrendingUp },
  { id: 'trades',     label: 'Trades',     icon: ArrowLeftRight },
  { id: 'draft',      label: 'Draft',      icon: ClipboardList },
  { id: 'h2h',        label: 'H2H',        icon: Scale },
  { id: 'records',    label: 'Records',    icon: BookOpen },
] as const;

export type TabId = (typeof TABS)[number]['id'];
