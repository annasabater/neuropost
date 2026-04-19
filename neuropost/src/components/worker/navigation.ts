import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckSquare,
  DollarSign,
  FileText,
  Home,
  Inbox,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import type { WorkerRole } from '@/types';

export type WorkerNavBadge = 'queue' | 'msg';

export interface WorkerNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: WorkerNavBadge;
}

export interface WorkerNavGroup {
  label: string;
  items: WorkerNavItem[];
}

const BASE_GROUPS: WorkerNavGroup[] = [
  {
    label: 'Centro de control',
    items: [
      { href: '/worker/central', icon: Zap, label: 'Centro de control' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/worker', icon: Home, label: 'Operaciones', badge: 'queue' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/worker/inbox',      icon: Inbox,        label: 'Inbox',      badge: 'msg' },
      { href: '/worker/validation', icon: CalendarDays, label: 'Validación' },
      { href: '/worker/clientes', icon: Users, label: 'Clientes' },
      { href: '/worker/anuncios', icon: Bell, label: 'Notificaciones' },
      { href: '/worker/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
];

const ADMIN_GROUP: WorkerNavGroup = {
  label: 'Administración',
  items: [
    { href: '/worker/finanzas', icon: DollarSign, label: 'Finanzas' },
    { href: '/worker/auditoria', icon: FileText, label: 'Auditoría' },
    { href: '/worker/settings', icon: Settings, label: 'Configuración' },
  ],
};

const ALL_ITEMS = [...BASE_GROUPS.flatMap((group) => group.items), ...ADMIN_GROUP.items];

export function getWorkerNavGroups(role?: WorkerRole | null): WorkerNavGroup[] {
  return role === 'admin' || role === 'senior'
    ? [...BASE_GROUPS, ADMIN_GROUP]
    : BASE_GROUPS;
}

export function isWorkerRouteActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/worker' && pathname.startsWith(href));
}

export function getWorkerRouteLabel(pathname: string): string {
  return ALL_ITEMS.find((item) => isWorkerRouteActive(pathname, item.href))?.label ?? 'Operaciones';
}

