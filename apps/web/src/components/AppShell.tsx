import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, FileText, Bot, ListOrdered,
  AlertOctagon, Search, Package, Menu, X
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/buyer', label: 'AI Buyer Console', icon: Bot, highlight: true },
  { path: '/policies', label: 'Merchant Policies', icon: FileText },
  { path: '/decisions', label: 'Decisions', icon: ListOrdered },
  { path: '/failures', label: 'Failure Center', icon: AlertOctagon },
  { path: '/audit', label: 'Audit Ledger', icon: Search },
  { path: '/inventory', label: 'Inventory', icon: Package },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-text-main overflow-hidden relative" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-60 flex flex-col shrink-0 border-r border-white/5
          transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'rgba(10, 10, 14, 0.98)' }}
      >
        {/* Wordmark */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Shield size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-white">PolicyShield</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-white/40 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                  transition-all duration-150 btn-press
                  ${isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  }
                `}
                style={isActive ? { boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.2)' } : {}}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-white/30 group-hover:text-white/60'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary/60" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer identity */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
              M
            </div>
            <div>
              <div className="text-[12px] font-medium text-white/70">Merchant Admin</div>
              <div className="text-[10px] text-white/30 font-code">Test Environment</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header
          className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-white/5"
          style={{ background: 'rgba(10, 10, 14, 0.95)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold tracking-widest uppercase">
              Test Mode
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-screen-2xl mx-auto h-full px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
