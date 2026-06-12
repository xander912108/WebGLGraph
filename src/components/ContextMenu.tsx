import { useEffect, useRef } from 'react';
import { MessageSquare, Shield, UserCircle } from 'lucide-react';

interface Props {
  x: number;
  y: number;
  userName: string;
  onAction: (action: 'message' | 'role' | 'profile') => void;
  onClose: () => void;
}

export default function ContextMenu({ x, y, userName, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('click', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  const items = [
    { icon: MessageSquare, label: 'Написать', action: 'message' as const },
    { icon: Shield, label: 'Назначить роль', action: 'role' as const },
    { icon: UserCircle, label: 'Посмотреть профиль', action: 'profile' as const },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] w-52 rounded-xl bg-[#131b2e] border border-white/10 shadow-2xl overflow-hidden"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-white/5">
        <p className="text-[11px] font-semibold text-gray-300 truncate">{userName}</p>
      </div>
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => onAction(item.action)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors">
          <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
