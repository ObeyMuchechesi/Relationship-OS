import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Heart,
  LogOut,
  Home,
  Images,
  Globe,
  Plane,
  Film,
  Gift,
  Settings as SettingsIcon,
  Shield,
  MonitorPlay,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mediaUrl } from '../api';
import TimezoneBar from './TimezoneBar';

const NAV = [
  { to: '/', label: 'Home', end: true, Icon: Home },
  { to: '/timeline', label: 'Timeline', Icon: Images },
  { to: '/bucket-list', label: 'Bucket list', Icon: Globe },
  { to: '/reunion', label: 'Reunion', Icon: Plane },
  { to: '/date-night', label: 'Date night', Icon: Film },
  { to: '/watch', label: 'Watch', Icon: MonitorPlay },
  { to: '/gifts', label: 'Gifts', Icon: Gift },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export function Avatar({ user, className = 'w-8 h-8 text-sm' }) {
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  if (user?.avatarUrl) {
    return (
      <img
        src={mediaUrl(user.avatarUrl)}
        alt={user.name || 'avatar'}
        className={`${className} rounded-full object-cover ring-2 ring-white shadow-sm`}
      />
    );
  }
  return (
    <span
      className={`${className} rounded-full bg-rose-100 text-rose-600 grid place-items-center font-medium ring-2 ring-white`}
    >
      {initial}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <Heart className="w-6 h-6 text-rose-500" fill="currentColor" strokeWidth={1.5} />
            <span className="font-display text-lg font-bold tracking-tight text-stone-800 hidden sm:block">
              Relationship OS
            </span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {NAV.map(({ to, label, end, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition whitespace-nowrap ${
                    isActive
                      ? 'bg-rose-50 text-rose-600 font-medium'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" strokeWidth={2} />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-50 text-amber-700 font-medium'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`
                }
              >
                <Shield className="w-4 h-4" strokeWidth={2} />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden lg:flex items-center gap-2 text-sm text-stone-500">
              <Avatar user={user} className="w-7 h-7 text-xs" />
              {user?.name}
            </span>
            <button onClick={handleLogout} className="btn-ghost !py-1.5 !px-2.5 text-xs">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        <TimezoneBar />
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-stone-200 flex overflow-x-auto no-scrollbar z-30 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 min-w-[64px] px-1.5 py-2 text-[10px] text-center flex flex-col items-center gap-0.5 ${
                isActive ? 'text-rose-600 font-medium' : 'text-stone-500'
              }`
            }
          >
            <Icon className="w-5 h-5" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex-1 min-w-[64px] px-1.5 py-2 text-[10px] text-center flex flex-col items-center gap-0.5 ${
                isActive ? 'text-amber-700 font-medium' : 'text-stone-500'
              }`
            }
          >
            <Shield className="w-5 h-5" strokeWidth={2} />
            Admin
          </NavLink>
        )}
      </nav>
    </div>
  );
}
