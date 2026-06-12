import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { users, bonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import { Flame, Snowflake, Thermometer, ChevronDown, ChevronUp, Filter, Grid3X3 } from 'lucide-react';

const CURRENT_USER_ID = 'u4';

type TempZone = 'cold' | 'cool' | 'warm' | 'hot' | 'fire';

interface UserStat {
  user: typeof users[0];
  bondCount: number;
  totalStrength: number;
  types: Set<string>;
  partnerCount: number;
  avgStrength: string;
  lastActive: number;
  ratio: number;
  zone: TempZone;
}

const ZONE_CONFIG: Record<TempZone, { label: string; color: string; textColor: string; border: string; bg: string; bar: string }> = {
  cold:  { label: 'Холодные',   color: 'text-blue-400',    textColor: '#60a5fa',    border: 'border-blue-500/15',   bg: 'bg-blue-500/5',   bar: '#3b82f6' },
  cool:  { label: 'Прохладные', color: 'text-cyan-400',    textColor: '#22d3ee',    border: 'border-cyan-500/15',   bg: 'bg-cyan-500/5',   bar: '#06b6d4' },
  warm:  { label: 'Тёплые',     color: 'text-emerald-400', textColor: '#34d399',    border: 'border-emerald-500/15', bg: 'bg-emerald-500/5', bar: '#34d399' },
  hot:   { label: 'Горячие',    color: 'text-amber-400',   textColor: '#fbbf24',    border: 'border-amber-500/15',  bg: 'bg-amber-500/5',  bar: '#fbbf24' },
  fire:  { label: 'Огненные',   color: 'text-rose-400',    textColor: '#f87171',    border: 'border-rose-500/15',   bg: 'bg-rose-500/5',   bar: '#f87171' },
};

const ZONE_ORDER: TempZone[] = ['cold', 'cool', 'warm', 'hot', 'fire'];

function getZone(ratio: number): TempZone {
  if (ratio < 0.2) return 'cold';
  if (ratio < 0.4) return 'cool';
  if (ratio < 0.6) return 'warm';
  if (ratio < 0.8) return 'hot';
  return 'fire';
}

export default function HeatmapPage() {
  const [sortBy, setSortBy] = useState<'strength' | 'partners' | 'name'>('strength');
  const [activeZoneFilter, setActiveZoneFilter] = useState<TempZone | null>(null);
  const [expandedZones, setExpandedZones] = useState<Set<TempZone>>(new Set(['fire', 'hot', 'warm', 'cool', 'cold']));

  const userStats = useMemo(() => {
    const stats: UserStat[] = users.filter((u) => !u.isOrphan || u.isLeader).map((u) => {
      const userBonds = bonds.filter((b) => b.sourceId === u.id || b.targetId === u.id);
      const bondCount = userBonds.length;
      const totalStrength = userBonds.reduce((s, b) => s + b.strength, 0);
      const types = new Set(userBonds.map((b) => b.type));
      const partnerIds = new Set(userBonds.map((b) => b.sourceId === u.id ? b.targetId : b.sourceId));
      const avgStrength = bondCount > 0 ? (totalStrength / bondCount).toFixed(1) : '0';
      const lastActive = userBonds.length > 0 ? Math.max(...userBonds.map((b) => b.lastReinforced)) : 0;
      return { user: u, bondCount, totalStrength, types, partnerCount: partnerIds.size, avgStrength, lastActive, ratio: 0, zone: 'cold' as TempZone };
    });

    const maxStrength = Math.max(...stats.map((s) => s.totalStrength), 1);
    const minStrength = Math.min(...stats.map((s) => s.totalStrength), 0);
    const range = maxStrength - minStrength || 1;
    stats.forEach((s) => { s.ratio = (s.totalStrength - minStrength) / range; s.zone = getZone(s.ratio); });

    stats.sort((a, b) => {
      if (sortBy === 'strength') return b.totalStrength - a.totalStrength;
      if (sortBy === 'partners') return b.partnerCount - a.partnerCount;
      return a.user.name.localeCompare(b.user.name);
    });

    return stats;
  }, [sortBy]);

  // All counts (unfiltered) for tab display
  const allGrouped = useMemo(() => {
    const g: Record<TempZone, UserStat[]> = { cold: [], cool: [], warm: [], hot: [], fire: [] };
    userStats.forEach((s) => g[s.zone].push(s));
    return g;
  }, [userStats]);

  // Filtered for display
  const grouped = useMemo(() => {
    const g: Record<TempZone, UserStat[]> = { cold: [], cool: [], warm: [], hot: [], fire: [] };
    userStats.forEach((s) => {
      if (!activeZoneFilter || s.zone === activeZoneFilter) g[s.zone].push(s);
    });
    return g;
  }, [userStats, activeZoneFilter]);

  const toggleZone = (z: TempZone) => {
    setExpandedZones((prev) => { const next = new Set(prev); if (next.has(z)) next.delete(z); else next.add(z); return next; });
  };

  const zonesToShow: TempZone[] = activeZoneFilter ? [activeZoneFilter] : ZONE_ORDER;

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Grid3X3 className="w-4 h-4 text-rose-400" />
              <div>
                <p className="text-sm font-semibold text-gray-100">Плотность связей</p>
                <p className="text-[10px] text-gray-500">{userStats.length} участников</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-gray-600" />
              {(['strength', 'name'] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${sortBy === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {s === 'strength' ? 'По силе' : 'По имени'}
                </button>
              ))}
            </div>
          </div>

          {/* Color bar + zone filter tabs */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-5">
            {/* Gradient bar */}
            <div className="flex items-center gap-2 mb-3">
              <Snowflake className="w-3 h-3 text-blue-400" />
              <div className="flex-1 h-2.5 rounded-full overflow-hidden flex">
                {ZONE_ORDER.map((z) => (
                  <div key={z} className="flex-1 h-full" style={{ background: ZONE_CONFIG[z].bar, opacity: 0.6 }} />
                ))}
              </div>
              <Flame className="w-3 h-3 text-rose-400" />
            </div>
            {/* Zone filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setActiveZoneFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${!activeZoneFilter ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                Все
              </button>
              {ZONE_ORDER.map((z) => {
                const cfg = ZONE_CONFIG[z];
                const count = allGrouped[z].length;
                if (count === 0) return null;
                return (
                  <button key={z} onClick={() => setActiveZoneFilter(activeZoneFilter === z ? null : z)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors flex items-center gap-1 ${
                      activeZoneFilter === z ? `${cfg.bg} ${cfg.color}` : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={activeZoneFilter === z ? { boxShadow: `0 0 0 1px ${cfg.bar}40` } : {}}>
                    {cfg.label} <span className="text-gray-600">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zones */}
          <div className="space-y-3">
            {zonesToShow.map((z) => {
              const cfg = ZONE_CONFIG[z];
              const items = grouped[z];
              const isExpanded = expandedZones.has(z);
              if (items.length === 0) return null;

              return (
                <div key={z} className={`rounded-xl border overflow-hidden transition-all`}
                  style={{ borderColor: activeZoneFilter === z ? cfg.bar + '40' : 'rgba(255,255,255,0.05)' }}>
                  <button onClick={() => toggleZone(z)} className={`w-full flex items-center gap-2 px-4 py-2.5 ${cfg.bg}`}>
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.bar }} />
                    <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-gray-600">{items.length}</span>
                    <div className="flex-1" />
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                  {isExpanded && (
                    <div className="p-2 space-y-1.5">
                      {items.map(({ user, bondCount, totalStrength, types, partnerCount, avgStrength, ratio }) => {
                        const isMe = user.id === CURRENT_USER_ID;
                        return (
                          <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02] transition-all hover:scale-[1.01] hover:bg-white/[0.04] cursor-pointer">
                            {isMe ? (
                              <div className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold bg-amber-500/10 border-amber-500/30 text-amber-400 flex-shrink-0">Я</div>
                            ) : (
                              <img src={user.avatar} alt="" className="w-9 h-9 rounded-full border flex-shrink-0" style={{ borderColor: STAGE_COLORS[user.stage] }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-100">{isMe ? 'Я' : user.name}</span>
                                <span className="text-[9px] text-gray-600">{STAGE_NAMES[user.stage]}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                                <span className="text-gray-500">{bondCount} связей</span>
                                <span className="text-gray-600">&middot;</span>
                                <span className="font-mono text-amber-400">⚡ {avgStrength}</span>
                              </div>
                              {/* Bond type indicators */}
                              <div className="flex gap-1.5 mt-1.5">
                                {Array.from(types).map((t) => (
                                  <span key={t} className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-black/20 text-gray-400">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[t as keyof typeof BOND_COLORS] }} />
                                    {BOND_LABELS[t as keyof typeof BOND_LABELS]}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-[10px] font-mono" style={{ color: cfg.bar }}>⚡ {avgStrength}</span>
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
        </div>
      </div>
    </Layout>
  );
}
