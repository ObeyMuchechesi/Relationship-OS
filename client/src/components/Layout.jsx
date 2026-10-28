import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TimezoneBar from './TimezoneBar';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/timeline', label: 'Timeline' },
  { to: '/bucket-list', label: 'Bucket list' },
  { to: '/reunion', label: 'Reunion' },
  { to: '/date-night', label: 'Date night' },
  { to: '/gifts', label: 'Gifts' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">💞</span>
            <span className="font-display text-lg font-semibold tracking-tight text-stone-800">
              Relationship OS
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm transition ${
                    isActive
                      ? 'bg-rose-50 text-rose-600 font-medium'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-stone-500">Hi, {user?.name}</span>
            <button onClick={handleLogout} className="btn-ghost !py-1.5 !px-3 text-xs">
              Log out
            </button>
          </div>
        </div>

        <TimezoneBar />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <nav className="md:hidden sticky bottom-0 bg-white border-t border-stone-200 flex overflow-x-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 min-w-max px-3 py-3 text-xs text-center ${
                isActive ? 'text-rose-600 font-medium' : 'text-stone-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
