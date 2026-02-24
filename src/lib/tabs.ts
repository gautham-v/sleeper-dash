import { ArrowLeftRight, BookOpen, ClipboardList, LayoutDashboard, Scale, Users } from 'lucide-react';

export const TABS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'managers',  label: 'Managers',  icon: Users },
  { id: 'h2h',       label: 'H2H',       icon: Scale },
  { id: 'trades',    label: 'Trades',    icon: ArrowLeftRight },
  { id: 'draft',     label: 'Draft',     icon: ClipboardList },
  { id: 'records',   label: 'Records',   icon: BookOpen },
] as const;

export type TabId = (typeof TABS)[number]['id'];
