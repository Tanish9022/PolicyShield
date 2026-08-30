import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, FileText, Bot, ListOrdered, AlertOctagon, Activity, Search, FlaskConical, Play } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { path: '/policies', label: 'Merchant Policies', icon: <FileText size={18} /> },
  { path: '/buyer', label: 'AI Buyer Simulator', icon: <Bot size={18} /> },
  { path: '/decisions', label: 'Decisions', icon: <ListOrdered size={18} /> },
  { path: '/failures', label: 'Failure Center', icon: <AlertOctagon size={18} /> },
  { path: '/audit', label: 'Audit Ledger', icon: <Search size={18} /> },
  { path: '/chaos', label: 'Chaos Control', icon: <Activity size={18} /> },
  { path: '/evaluation', label: 'Evaluation', icon: <FlaskConical size={18} /> },
  { path: '/demo', label: 'End-to-End Checkout Demo', icon: <Play size={18} /> }
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-text-main font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col bg-surface/50">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Shield className="text-primary mr-2" size={24} />
          <span className="font-display font-semibold text-lg tracking-tight">PolicyShield</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary-muted text-primary' 
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                <span className={isActive ? 'text-primary' : 'text-text-muted'}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold text-primary">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Merchant Admin</span>
              <span className="text-xs text-text-muted">Test Environment</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4">
            <span className="px-2.5 py-1 rounded-full bg-primary-muted text-primary text-xs font-bold tracking-widest">
              TEST MODE
            </span>
          </div>
          <div className="flex items-center space-x-6 text-sm text-text-muted">
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <span>Backend</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <span>Gemini</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <span>Razorpay API</span>
             </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
