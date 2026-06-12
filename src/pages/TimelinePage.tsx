import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { users, bonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

const CURRENT_USER_ID = 'u4';

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} дн. назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед. назад`;
  if (d < 365) return `${Math.floor(d / 30)} мес. назад`;
  return `${Math.floor(d / 365)} г. назад`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTH_SHORT = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export default function TimelinePage() {
  const currentUser = users.find((u) => u.id === CURRENT_USER_ID)!;
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set([String(new Date().getFullYear())]));

  const timeline = useMemo(() => {
    const sorted = [...bonds].sort((a, b) => b.lastReinforced - a.lastReinforced);
    // Group by year then month
    const years: Record<string, Record<string, typeof sorted>> = {};
    sorted.forEach((b) => {
      const d = new Date(b.lastReinforced);
      const year = String(d.getFullYear());
      const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!years[year]) years[year] = {};
      if (!years[year][monthKey]) years[year][monthKey] = [];
      years[year][monthKey].push(b);
    });
    return Object.entries(years).sort((a, b) => b[0].localeCompare(a[0]));
  }, []);

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="text-sm font-semibold text-gray-100">Хронология связей</p>
              <p className="text-[10px] text-gray-500">{bonds.length} событий &middot; {timeline.length} год(а)</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-[14px] top-0 bottom-0 w-px bg-white/5" />

            {timeline.map(([year, months]) => {
              const yearExpanded = expandedYears.has(year);
              const monthEntries = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
              return (
                <div key={year} className="mb-4">
                  {/* Year header — collapsible */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="flex items-center gap-2 mb-3 group">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center z-10">
                      <span className="text-[9px] font-bold text-cyan-400">{year.slice(2)}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{year}</span>
                    <span className="text-[10px] text-gray-600">({Object.values(months).flat().length})</span>
                    {yearExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                  </button>

                  {/* Months */}
                  {yearExpanded && monthEntries.map(([monthKey, monthBonds]) => {
                    const [, month] = monthKey.split('-');
                    const isExpanded = expandedMonths.has(monthKey);
                    return (
                      <div key={monthKey} className="mb-3 ml-4">
                        {/* Month header — collapsible */}
                        <button
                          onClick={() => toggleMonth(monthKey)}
                          className="flex items-center gap-2 mb-2 group">
                          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                          <span className="text-[11px] font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{MONTH_SHORT[Number(month)]}</span>
                          <span className="text-[10px] text-gray-600">{monthBonds.length} связ{monthBonds.length === 1 ? 'ь' : monthBonds.length < 5 ? 'и' : 'ей'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
                        </button>

                        {/* Bond cards */}
                        {isExpanded && (
                          <div className="space-y-2 ml-4">
                            {monthBonds.map((b) => {
                              const source = users.find((u) => u.id === b.sourceId);
                              const target = users.find((u) => u.id === b.targetId);
                              if (!source || !target) return null;
                              const isMe = b.sourceId === CURRENT_USER_ID || b.targetId === CURRENT_USER_ID;
                              return (
                                <div
                                  key={b.id}
                                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${
                                    isMe ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01]'
                                  }`}>
                                  {/* Source → Target */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {source.id === CURRENT_USER_ID ? (
                                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold bg-amber-500/10 border-amber-500/30 text-amber-400">Я</div>
                                    ) : (
                                      <img src={source.avatar} alt="" className="w-7 h-7 rounded-full border" style={{ borderColor: STAGE_COLORS[source.stage] }} />
                                    )}
                                    <span className="text-[9px] text-gray-600 mx-0.5">&rarr;</span>
                                    {target.id === CURRENT_USER_ID ? (
                                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold bg-amber-500/10 border-amber-500/30 text-amber-400">Я</div>
                                    ) : (
                                      <img src={target.avatar} alt="" className="w-7 h-7 rounded-full border" style={{ borderColor: STAGE_COLORS[target.stage] }} />
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-gray-200">{source.name} &rarr; {target.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[b.type] }} />
                                      <span className="text-[10px]" style={{ color: BOND_COLORS[b.type] }}>{BOND_LABELS[b.type]}</span>
                                      <span className="text-[9px] font-mono text-gray-600">x{b.strength}</span>
                                      {b.isFaded && <span className="text-[8px] text-rose-400 ml-1">Увядает</span>}
                                    </div>
                                  </div>
                                  {/* Time */}
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[9px] text-gray-500">{formatDate(b.lastReinforced)}</p>
                                    <p className="text-[8px] text-gray-600">{timeAgo(b.lastReinforced)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
