import { Link, useLocation } from 'react-router';
import {
  Link2, Sun, Sparkles, Grid3X3, LayoutList, GitFork, Clock,
} from 'lucide-react';
import { users } from '@/data/mockData';

const CURRENT_USER_ID = 'u4';

interface Props {
  children: React.ReactNode;
  rightActions?: React.ReactNode;
}

export default function Layout({ children, rightActions }: Props) {
  const location = useLocation();
  const currentUser = users.find((u) => u.id === CURRENT_USER_ID)!;

  const nav = [
    { to: '/', label: 'Солнце', icon: Sun, activeColor: 'text-amber-400', activeBg: 'bg-amber-500/15' },
    { to: '/galaxy', label: 'Созвездие', icon: Sparkles, activeColor: 'text-violet-400', activeBg: 'bg-violet-500/15' },
    { to: '/hierarchy', label: 'Дерево', icon: GitFork, activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/15' },
    { to: '/timeline', label: 'Хронология', icon: Clock, activeColor: 'text-cyan-400', activeBg: 'bg-cyan-500/15' },
    { to: '/heatmap', label: 'Плотность', icon: Grid3X3, activeColor: 'text-rose-400', activeBg: 'bg-rose-500/15' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#060a14] overflow-hidden">
      {/* ====== HEADER — always visible ====== */}
      <header className="h-14 px-5 flex items-center justify-between border-b border-white/5 bg-[#060a14]/90 backdrop-blur-md z-30 flex-shrink-0">
        {/* LEFT: Nav */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 mr-3">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-gray-100">Мои связи</span>
          </div>
          {nav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  isActive ? `${item.activeColor} ${item.activeBg}` : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* RIGHT: Actions + Profile */}
        <div className="flex items-center gap-2">
          {rightActions}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <img src={currentUser.avatar} alt="" className="w-5 h-5 rounded-full" />
            <span className="text-xs text-gray-200">{currentUser.name}</span>
          </div>
        </div>
      </header>

      {/* ====== CONTENT ====== */}
      {children}
    </div>
  );
}
