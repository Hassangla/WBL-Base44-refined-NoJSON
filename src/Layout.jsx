import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  CheckSquare,
  Download,
  Brain,
  BarChart3,
  GitCompare,
  Library,
  Globe,
  Users,
  Settings,
  Cpu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toaster } from 'sonner';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState({ workflow_mode: 'two_step' });
  const location = useLocation();

  useEffect(() => {
    loadUser();
    loadSettings();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.error('Failed to load user');
    }
  };

  const loadSettings = async () => {
    try {
      const settingsData = await base44.entities.AppSettings.filter({ setting_key: 'workflow_mode' });
      if (settingsData.length > 0) {
        setSettings({ workflow_mode: settingsData[0].setting_value });
      }
    } catch (e) {
      console.error('Failed to load settings');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.wbl_role === 'sub_admin';
  const isValidator = user?.role === 'admin' || user?.wbl_role === 'validator';
  const isViewer = user?.wbl_role === 'viewer';
  const isTwoStepMode = settings.workflow_mode !== 'single_step';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', roles: ['all'] },
    { name: 'Research Batches', icon: FolderKanban, page: 'Batches', roles: ['all'] },
    { name: 'Tasks', icon: ListTodo, page: 'Tasks', roles: ['all'] },
    { name: 'Validator Queue', icon: CheckSquare, page: 'ValidatorQueue', roles: ['validator', 'admin'], showIf: isTwoStepMode && !isViewer },
    { name: 'Exports', icon: Download, page: 'Exports', roles: ['all'] },
    { name: 'AI Requests', icon: Brain, page: 'AIRequests', roles: ['researcher', 'admin'], hideFromViewer: true },
    { name: 'AI Usage', icon: BarChart3, page: 'AIUsage', roles: ['researcher', 'admin'], hideFromViewer: true },
    { name: 'AI Comparison', icon: GitCompare, page: 'AIComparison', roles: ['all'] },
  ];

  const adminItems = [
    { name: 'Question Library', icon: Library, page: 'QuestionLibrary' },
    { name: 'Economies', icon: Globe, page: 'Economies' },
    { name: 'Users & Roles', icon: Users, page: 'UsersRoles' },
    { name: 'AI Settings', icon: Cpu, page: 'AISettings' },
    { name: 'Settings', icon: Settings, page: 'AppSettings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.hideFromViewer && isViewer) return false;
    if (item.showIf === false) return false;
    if (item.roles.includes('all')) return true;
    if (item.roles.includes('admin') && isAdmin) return true;
    if (item.roles.includes('validator') && isValidator) return true;
    return true;
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavLink = ({ item, mobile = false }) => {
    const isActive = currentPageName === item.page;
    return (
      <Link
        to={createPageUrl(item.page)}
        onClick={() => mobile && setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        <item.icon className={cn('h-5 w-5 flex-shrink-0', collapsed && !mobile && 'mx-auto')} />
        {(!collapsed || mobile) && <span>{item.name}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --wbl-blue: #002244;
          --wbl-light-blue: #0066B3;
          --wbl-accent: #F7941D;
        }
      `}</style>
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#002244] text-white z-50 flex items-center px-4 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-white hover:bg-white/10 mr-2"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[#F7941D] rounded flex items-center justify-center font-bold text-sm">
            WBL
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold tracking-tight">Analyst Workbench</h1>
            <p className="text-xs text-blue-200">Women, Business and the Law</p>
          </div>
        </div>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-white/10">
              <Avatar className="h-8 w-8 bg-[#0066B3]">
                <AvatarFallback className="bg-[#0066B3] text-white text-sm">
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm">{user?.full_name || 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <p className="text-xs text-blue-600 capitalize mt-1">
                {user?.wbl_role || user?.role || 'Researcher'}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="h-16 flex items-center justify-between px-4 border-b">
              <span className="font-semibold text-slate-800">Navigation</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
              {filteredNavItems.map(item => (
                <NavLink key={item.page} item={item} mobile />
              ))}
              {isAdmin && (
                <>
                  <div className="pt-4 pb-2">
                    <span className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Administration
                    </span>
                  </div>
                  {adminItems.map(item => (
                    <NavLink key={item.page} item={item} mobile />
                  ))}
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        'fixed left-0 top-16 bottom-0 bg-white border-r border-slate-200 transition-all duration-300 hidden lg:block z-40',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <div className="flex flex-col h-full">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {filteredNavItems.map(item => (
              <NavLink key={item.page} item={item} />
            ))}
            
            {isAdmin && (
              <>
                <div className="pt-6 pb-2">
                  {!collapsed && (
                    <span className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Administration
                    </span>
                  )}
                </div>
                {adminItems.map(item => (
                  <NavLink key={item.page} item={item} />
                ))}
              </>
            )}
          </nav>

          <div className="p-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        'pt-16 min-h-screen transition-all duration-300',
        collapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <Toaster closeButton richColors position="top-right" />
    </div>
  );
}