import { useState } from 'react';
import { BOND_COLORS, BOND_LABELS, STAGE_COLORS, STAGE_NAMES } from '@/types';
import type { BondType } from '@/types';
import { HelpCircle, X } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export default function LegendPanel({ compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (compact && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg bg-[#131b2e]/90 border border-white/10 backdrop-blur-sm text-gray-400 hover:text-gray-200 transition-colors"
        title="Легенда"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-[#131b2e]/95 border border-white/10 backdrop-blur-sm shadow-2xl max-w-[180px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Легенда</p>
        {compact && (
          <button onClick={() => setIsOpen(false)} className="text-gray-600 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {(Object.entries(BOND_LABELS) as [BondType, string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BOND_COLORS[type] }} />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-gray-500 uppercase mb-1">Роль</p>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[9px] text-gray-400">Есть роль в сообществе</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-gray-500 uppercase mb-1">Уровни</p>
        <div className="flex flex-wrap gap-0.5">
          {(Object.entries(STAGE_NAMES) as [string, string][]).map(([s, l]) => (
            <span key={s} className="text-[7px] px-1 py-0.5 rounded" style={{ background: STAGE_COLORS[Number(s) as 1] + '20', color: STAGE_COLORS[Number(s) as 1] }}>{l}</span>
          ))}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-gray-500 uppercase mb-1">Активность</p>
        <div className="flex items-center gap-1">
          <div className="w-10 h-1 rounded-full bg-gradient-to-r from-gray-700 via-gray-400 to-white" />
          <span className="text-[7px] text-gray-600">старая &rarr; свежая</span>
        </div>
      </div>
    </div>
  );
}
