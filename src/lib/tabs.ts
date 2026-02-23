import { BookOpen, LayoutDashboard, Scale, Users } from 'lucide-react';

export const TABS = [
  { id: 'overview',  label: 'Overview', icon: LayoutDashboard },
  { id: 'records',   label: 'Records',  icon: BookOpen },
  { id: 'managers',  label: 'Managers', icon: Users },
  { id: 'h2h',       label: 'H2H',      icon: Scale },
] as const;

export type TabId = (typeof TABS)[number]['id'];
