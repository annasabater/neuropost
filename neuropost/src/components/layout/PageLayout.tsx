import type { ReactNode } from 'react';

type PageLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageLayout({
  title,
  subtitle,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="page-content dashboard-unified-page dashboard-layout-shell">
      <div className="dashboard-unified-header dashboard-layout-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-sub">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="dashboard-unified-content">
        {children}
      </div>
    </div>
  );
}
