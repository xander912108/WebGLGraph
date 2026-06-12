import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { users as allUsers, bonds as allBonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import type { User, Bond, BondType } from '@/types';
import WebGLGraph from '@/components/WebGLGraph';
import type { WebGLGraphHandle } from '@/components/WebGLGraph';
import LegendPanel from '@/components/LegendPanel';
import {
  ArrowLeft, Search, UserPlus, Shield, AlertTriangle, GitBranch,
  Radio, Siren, TrendingUp, Filter, X, Activity, Gauge,
  ChevronDown, ChevronRight, Table2, GitFork, ZoomIn, ZoomOut, Maximize2, Download
} from 'lucide-react';

type TimeRange = 'all' | 'day' | 'week' | 'month';
type SignalType = 'orphan' | 'overloaded' | 'faded' | 'bridge';

interface Signal {
  id: string; type: SignalType; userId: string;
  title: string; description: string; severity: 'critical' | 'warning' | 'info';
}

const SIGNAL_CFG: Record<SignalType, { icon: typeof Siren; color: string; bg: string }> = {
  orphan: { icon: Siren, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  overloaded: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  faded: { icon: TrendingUp, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  bridge: { icon: GitBranch, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
};

function computeAnalytics(users: User[], bonds: Bond[]) {
  const total = users.length;
  const active = bonds.filter((b) => !b.isFaded).length;
  const faded = bonds.filter((b) => b.isFaded).length;
  const maxBonds = (total * (total - 1)) / 2;
  const density = maxBonds > 0 ? bonds.length / maxBonds : 0;
  const orphans = users.filter((u) => u.isOrphan && !u.isLeader);
  const overloaded = users.filter((u) => u.isOverloaded);
  const bc = new Map<string, number>();
  users.forEach((u) => bc.set(u.id, 0));
  bonds.forEach((b) => { bc.set(b.sourceId, (bc.get(b.sourceId) || 0) + 1); bc.set(b.targetId, (bc.get(b.targetId) || 0) + 1); });
  const bridges = users.filter((u) => !u.isLeader && (bc.get(u.id) || 0) >= 4);
  return { total, active, faded, density, orphans, overloaded, bridges, avg: total > 0 ? (bonds.length * 2) / total : 0 };
}

function generateSignals(users: User[], bonds: Bond[]): Signal[] {
  const signals: Signal[] = [];
  users.forEach((u) => {
    if (u.isLeader) return;
    if (u.isOrphan) signals.push({ id: `o-${u.id}`, type: 'orphan', userId: u.id, title: `${u.name} — без связей`, description: 'Новичок без единой связи', severity: 'critical' });
    if (u.isOverloaded) signals.push({ id: `ov-${u.id}`, type: 'overloaded', userId: u.id, title: `${u.name} — перегруз`, description: `${u.bondCount} связей, риск выгорания`, severity: 'warning' });
    const fb = bonds.filter((b) => (b.sourceId === u.id || b.targetId === u.id) && b.isFaded);
    if (fb.length >= 2) signals.push({ id: `f-${u.id}`, type: 'faded', userId: u.id, title: `${u.name} — связи увядают`, description: `${fb.length} связей требуют внимания`, severity: 'warning' });
  });
  const bc = new Map<string, number>();
  users.forEach((u) => bc.set(u.id, 0));
  bonds.forEach((b) => { bc.set(b.sourceId, (bc.get(b.sourceId) || 0) + 1); bc.set(b.targetId, (bc.get(b.targetId) || 0) + 1); });
  users.forEach((u) => { if (!u.isLeader && !u.isOrphan && (bc.get(u.id) || 0) >= 4) signals.push({ id: `b-${u.id}`, type: 'bridge', userId: u.id, title: `${u.name} — связующий узел`, description: `${bc.get(u.id)} связей`, severity: 'info' }); });
  return signals.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity]));
}

export default function LeaderConnectionsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<WebGLGraphHandle>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [hoveredUser, setHoveredUser] = useState<User | null>(null);
  const [hoveredBond, setHoveredBond] = useState<Bond | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selBondTypes, setSelBondTypes] = useState<Set<BondType>>(new Set());
  const [selStages, setSelStages] = useState<Set<number>>(new Set());
  const [showOrphans, setShowOrphans] = useState(true);
  const [sigFilter, setSigFilter] = useState<SignalType | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState({ signals: true, orphans: false, bridges: false, filters: true, detailGroups: new Set<string>() });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => { for (const en of e) setSize({ w: en.contentRect.width, h: en.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // zoomToFit при загрузке
  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current?.zoomToFit) graphRef.current.zoomToFit(400, 60);
    }, 600);
    return () => clearTimeout(timer);
  }, [viewMode]);

  const fBonds = useMemo(() => {
    let r = allBonds;
    if (timeRange !== 'all') {
      const limits: Record<TimeRange, number> = { all: Infinity, day: 864e5, week: 7 * 864e5, month: 30 * 864e5 };
      const now = Date.now();
      r = r.filter((b) => now - b.lastReinforced <= limits[timeRange]);
    }
    if (selBondTypes.size > 0) r = r.filter((b) => selBondTypes.has(b.type));
    return r;
  }, [timeRange, selBondTypes]);

  const fUsers = useMemo(() => selStages.size > 0 ? allUsers.filter((u) => selStages.has(u.stage)) : allUsers, [selStages]);
  const analytics = useMemo(() => computeAnalytics(fUsers, fBonds), [fUsers, fBonds]);
  const signals = useMemo(() => generateSignals(allUsers, allBonds), []);
  const fSignals = sigFilter ? signals.filter((s) => s.type === sigFilter) : signals;

  // Search with highlight
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const matches = allUsers.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
      setSearchMatchIds(new Set(matches.map((u) => u.id)));
    } else {
      setSearchMatchIds(new Set());
    }
  }, [searchQuery]);

  const searchResults = searchQuery.length >= 2 ? allUsers.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const focusUser = focusNodeId ? allUsers.find((u) => u.id === focusNodeId) || null : null;

  const focusBondsGrouped = useMemo(() => {
    if (!focusNodeId) return [] as { other: User; bonds: (Bond & { label: string })[] }[];
    const map = new Map<string, (Bond & { label: string })[]>();
    allBonds.forEach((b) => {
      if (b.sourceId !== focusNodeId && b.targetId !== focusNodeId) return;
      const otherId = b.sourceId === focusNodeId ? b.targetId : b.sourceId;
      const list = map.get(otherId) || [];
      list.push({ ...b, label: BOND_LABELS[b.type] });
      map.set(otherId, list);
    });
    return Array.from(map.entries())
      .map(([otherId, bnds]) => ({ other: allUsers.find((u) => u.id === otherId)!, bonds: bnds }))
      .sort((a, b) => b.bonds.reduce((s, x) => s + x.strength, 0) - a.bonds.reduce((s, x) => s + x.strength, 0));
  }, [focusNodeId]);

  const allBondsList = useMemo(() => {
    return allBonds.map((b) => {
      const s = allUsers.find((u) => u.id === b.sourceId)!;
      const t = allUsers.find((u) => u.id === b.targetId)!;
      return { ...b, sourceUser: s, targetUser: t, label: BOND_LABELS[b.type] };
    }).sort((a, b) => b.strength - a.strength);
  }, []);

  const toggleBond = (t: BondType) => setSelBondTypes((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleStage = (s: number) => setSelStages((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleExp = (k: keyof Omit<typeof expanded, 'detailGroups'>) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const toggleDetailGroup = (id: string) => setExpanded((p) => { const n = new Set(p.detailGroups); n.has(id) ? n.delete(id) : n.add(id); return { ...p, detailGroups: n }; });

  // Zoom
  const handleZoomIn = () => { if (graphRef.current?.zoom) { const z = (graphRef.current as any).zoom?.() || 1; (graphRef.current as any).zoom?.(z * 1.3, 300); } };
  const handleZoomOut = () => { if (graphRef.current?.zoom) { const z = (graphRef.current as any).zoom?.() || 1; (graphRef.current as any).zoom?.(z / 1.3, 300); } };
  const handleZoomFit = () => graphRef.current?.zoomToFit(400, 60);
  const handleZoomSlider = (v: number) => { setZoom(v); if ((graphRef.current as any)?.zoom) (graphRef.current as any).zoom(v, 0); };
  const onZoomChange = (z: number) => setZoom(z);

  const exportPng = () => {
    const canvas = (graphRef.current as any)?.canvas;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mentori-console-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="h-screen flex flex-col bg-[#060a14] overflow-hidden">
      <header className="h-14 px-5 flex items-center justify-between border-b border-white/5 bg-[#060a14]/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />Мои связи
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h1 className="text-sm font-bold text-gray-100">Консоль лидера</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-white/5 border border-white/10 overflow-hidden">
            <button onClick={() => setViewMode('graph')} className={viewMode === 'graph' ? 'px-3 py-1.5 text-[11px] font-medium bg-amber-600 text-white flex items-center gap-1.5' : 'px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1.5'}>
              <GitFork className="w-3.5 h-3.5" />Граф
            </button>
            <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'px-3 py-1.5 text-[11px] font-medium bg-amber-600 text-white flex items-center gap-1.5' : 'px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1.5'}>
              <Table2 className="w-3.5 h-3.5" />Список
            </button>
          </div>
          {viewMode === 'graph' && (
            <button onClick={exportPng} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-gray-200 transition-colors" title="Сохранить PNG">
              <Download className="w-4 h-4" />
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input placeholder="Найти..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)}
              className="pl-8 pr-4 h-8 w-44 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-amber-500/50" />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-48 rounded-xl bg-[#131b2e] border border-white/10 shadow-2xl z-50 overflow-hidden">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => { setFocusNodeId(u.id); setShowSearch(false); setSearchQuery(''); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: STAGE_COLORS[u.stage] + '20', color: STAGE_COLORS[u.stage], border: '1px solid ' + STAGE_COLORS[u.stage] + '40' }}>{u.name[0]}</div>
                    <span className="text-xs text-gray-200">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors">
            <UserPlus className="w-3.5 h-3.5" />Пригласить
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar (graph only) */}
        {viewMode === 'graph' && (
          <aside className="w-[260px] flex-shrink-0 border-r border-white/5 bg-[#060a14]/90 backdrop-blur-md overflow-y-auto">
            {/* Metrics */}
            <div className="p-4 border-b border-white/5">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-xl font-bold text-gray-100 font-mono">{analytics.total}</p>
                  <p className="text-[10px] text-gray-600 uppercase">Участники</p>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-xl font-bold text-emerald-400 font-mono">{analytics.active}</p>
                  <p className="text-[9px] text-gray-700">{analytics.faded} увядают</p>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-xl font-bold text-blue-400 font-mono">{(analytics.density * 100).toFixed(1)}%</p>
                  <p className="text-[10px] text-gray-600 uppercase">Плотность</p>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-xl font-bold text-amber-400 font-mono">{analytics.avg.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-600 uppercase">Связей/чел</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-gray-600" />
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: Math.min(analytics.density * 100 * 5, 100) + '%', background: analytics.density < 0.05 ? '#ef4444' : analytics.density < 0.1 ? '#f59e0b' : '#34d399' }} />
                </div>
                <span className="text-[9px] text-gray-600 font-mono">{analytics.density < 0.05 ? 'Хрупкая' : analytics.density < 0.1 ? 'Средняя' : 'Плотная'}</span>
              </div>
            </div>

            {/* Signals */}
            <div className="border-b border-white/5">
              <button onClick={() => toggleExp('signals')} className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs font-semibold text-gray-200">Сигналы</span>
                  {signals.filter((s) => s.severity === 'critical').length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400">{signals.filter((s) => s.severity === 'critical').length}</span>
                  )}
                </div>
                {expanded.signals ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
              {expanded.signals && (
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(['orphan', 'overloaded', 'faded', 'bridge'] as SignalType[]).map((t) => {
                      const c = SIGNAL_CFG[t];
                      const cnt = signals.filter((s) => s.type === t).length;
                      const active = sigFilter === t;
                      return (
                        <button key={t} onClick={() => setSigFilter(active ? null : t)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] transition-all ${active ? 'ring-1 ring-inset' : ''}`}
                          style={{ background: active ? c.bg : 'rgba(255,255,255,0.03)', color: c.color, '--tw-ring-color': c.color } as React.CSSProperties}>
                          <c.icon className="w-3 h-3" />{cnt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {fSignals.slice(0, 8).map((s) => {
                      const c = SIGNAL_CFG[s.type];
                      return (
                        <button key={s.id} onClick={() => setFocusNodeId(s.userId)} className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left">
                          <c.icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: c.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-200 truncate">{s.title}</p>
                            <p className="text-[9px] text-gray-600 truncate">{s.description}</p>
                          </div>
                          {s.severity === 'critical' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 mt-1.5 animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Orphans */}
            <div className="border-b border-white/5">
              <button onClick={() => toggleExp('orphans')} className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                  <Siren className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs font-semibold text-gray-200">Изоляторы</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400">{analytics.orphans.length}</span>
                </div>
                {expanded.orphans ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
              {expanded.orphans && (
                <div className="px-3 pb-3 space-y-1">
                  {analytics.orphans.map((u) => (
                    <button key={u.id} onClick={() => setFocusNodeId(u.id)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-colors text-left">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-400">{u.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-200">{u.name}</p>
                        <p className="text-[9px] text-gray-600">B {u.vklad} &bull; {STAGE_NAMES[u.stage]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bridges */}
            <div className="border-b border-white/5">
              <button onClick={() => toggleExp('bridges')} className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-gray-200">Связующие</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400">{analytics.bridges.length}</span>
                </div>
                {expanded.bridges ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
              {expanded.bridges && (
                <div className="px-3 pb-3 space-y-1">
                  {analytics.bridges.map((u) => (
                    <button key={u.id} onClick={() => setFocusNodeId(u.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: STAGE_COLORS[u.stage] + '20', color: STAGE_COLORS[u.stage], border: '1px solid ' + STAGE_COLORS[u.stage] + '40' }}>{u.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-200">{u.name}</p>
                        <p className="text-[9px] text-gray-600">{u.bondCount} связей</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filters */}
            <div>
              <button onClick={() => toggleExp('filters')} className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-gray-200">Фильтры</span>
                </div>
                {expanded.filters ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
              {expanded.filters && (
                <div className="px-3 pb-3 space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase mb-1.5">Период</p>
                    <div className="flex gap-1">
                      {([{ v: 'all', l: 'Всё' }, { v: 'day', l: 'День' }, { v: 'week', l: 'Неделя' }, { v: 'month', l: 'Месяц' }] as { v: TimeRange; l: string }[]).map((r) => (
                        <button key={r.v} onClick={() => setTimeRange(r.v)} className={timeRange === r.v ? 'flex-1 px-2 py-1 rounded-md text-[10px] bg-blue-500/15 text-blue-400' : 'flex-1 px-2 py-1 rounded-md text-[10px] bg-white/5 text-gray-600 hover:text-gray-300'}>{r.l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase mb-1.5">Тип связи</p>
                    <div className="flex flex-wrap gap-1">
                      {(Object.entries(BOND_LABELS) as [BondType, string][]).map(([type, label]) => {
                        const a = selBondTypes.has(type);
                        return (
                          <button key={type} onClick={() => toggleBond(type)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${a ? 'ring-1 ring-inset' : ''}`}
                            style={{ background: a ? BOND_COLORS[type] + '15' : 'rgba(255,255,255,0.03)', color: a ? BOND_COLORS[type] : '#6b7280', '--tw-ring-color': BOND_COLORS[type] } as React.CSSProperties}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[type] }} />{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-600">Показывать изолированных</span>
                    <button onClick={() => setShowOrphans(!showOrphans)} className={`w-8 h-4 rounded-full transition-colors ${showOrphans ? 'bg-emerald-600' : 'bg-white/10'}`}>
                      <div className="w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: showOrphans ? 'translateX(18px)' : 'translateX(2px)', marginTop: '2px' }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main area */}
        <div ref={containerRef} className="flex-1 relative" onMouseMove={(e) => { const r = containerRef.current?.getBoundingClientRect(); if (r) setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}>
          {viewMode === 'graph' && size.w > 0 && size.h > 0 && (
            <>
              <WebGLGraph
                ref={graphRef}
                users={fUsers}
                bonds={fBonds}
                width={size.w}
                height={size.h}
                focusNodeId={focusNodeId}
                searchMatchIds={searchMatchIds}
                onNodeClick={(u) => setFocusNodeId(u.id)}
                onNodeHover={setHoveredUser}
                onLinkHover={setHoveredBond}
                onZoomChange={onZoomChange}
                showOrphans={showOrphans}
              />

              {/* LEGEND — компактная кнопка */}
              <div className="absolute top-3 left-3">
                <LegendPanel compact />
              </div>

              {/* ZOOM CONTROLS */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
                <button onClick={handleZoomIn} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-8 h-24 bg-[#131b2e]/90 border border-white/10 rounded-lg flex items-center justify-center py-1">
                  <input type="range" min="0.3" max="3" step="0.05" value={Math.min(Math.max(zoom, 0.3), 3)}
                    onChange={(e) => handleZoomSlider(Number(e.target.value))}
                    className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer -rotate-90 origin-center" />
                </div>
                <button onClick={handleZoomOut} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={handleZoomFit} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Focus reset */}
              {focusNodeId && (
                <button onClick={() => setFocusNodeId(null)} className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#131b2e]/90 border border-white/10 text-[11px] text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors">
                  <X className="w-3 h-3" />Сбросить фокус
                </button>
              )}
            </>
          )}

          {/* TOOLTIP USER */}
          {hoveredUser && viewMode === 'graph' && (
            <div className="absolute z-50 pointer-events-none" style={{ left: mousePos.x + 16, top: mousePos.y + 12 }}>
              <div className="p-2.5 rounded-lg bg-[#131b2e] border border-white/10 shadow-2xl backdrop-blur-xl min-w-[170px]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border"
                    style={{ borderColor: hoveredUser.isLeader ? '#fbbf24' : STAGE_COLORS[hoveredUser.stage], background: '#0c1222' }}>{hoveredUser.name[0]}</div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-100">{hoveredUser.name}</p>
                    <p className="text-[10px] text-gray-500">{hoveredUser.role || STAGE_NAMES[hoveredUser.stage]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span className="text-emerald-400 font-mono">B {hoveredUser.vklad}</span>
                  <span className="text-gray-600">{hoveredUser.bondCount} связей</span>
                  {hoveredUser.isOrphan && <span className="text-rose-400">Изолирован</span>}
                  {hoveredUser.isOverloaded && <span className="text-amber-400">Перегруз</span>}
                </div>
              </div>
            </div>
          )}

          {/* TOOLTIP BOND */}
          {hoveredBond && !hoveredUser && viewMode === 'graph' && (
            <div className="absolute z-50 pointer-events-none" style={{ left: mousePos.x + 16, top: mousePos.y + 12 }}>
              <div className="p-2.5 rounded-lg bg-[#131b2e] border shadow-2xl backdrop-blur-xl" style={{ borderColor: BOND_COLORS[hoveredBond.type] + '40' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: BOND_COLORS[hoveredBond.type] }} />
                  <span className="text-[12px] font-medium text-gray-100">{BOND_LABELS[hoveredBond.type]}</span>
                  <span className="text-[10px] font-mono text-gray-500">x{hoveredBond.strength}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {allUsers.find((u) => u.id === hoveredBond.sourceId)?.name} &rarr; {allUsers.find((u) => u.id === hoveredBond.targetId)?.name}
                </p>
                {hoveredBond.isFaded && <p className="text-[9px] text-rose-400 mt-0.5">Увядает</p>}
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-300">Все связи ({allBondsList.length})</h2>
                <div className="flex gap-1">
                  {([{ v: 'all', l: 'Всё' }, { v: 'day', l: 'День' }, { v: 'week', l: 'Неделя' }, { v: 'month', l: 'Месяц' }] as { v: TimeRange; l: string }[]).map((r) => (
                    <button key={r.v} onClick={() => setTimeRange(r.v)} className={timeRange === r.v ? 'px-2 py-1 rounded-md text-[10px] bg-blue-500/15 text-blue-400' : 'px-2 py-1 rounded-md text-[10px] bg-white/5 text-gray-600 hover:text-gray-300'}>{r.l}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {allBondsList.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border"
                        style={{ borderColor: STAGE_COLORS[b.sourceUser.stage], background: '#0c1222' }}>{b.sourceUser.name[0]}</div>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[b.type] }} />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border"
                        style={{ borderColor: STAGE_COLORS[b.targetUser.stage], background: '#0c1222' }}>{b.targetUser.name[0]}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]" style={{ color: BOND_COLORS[b.type] }}>{b.label}</span>
                        <span className="text-[10px] font-mono text-gray-600">x{b.strength}</span>
                      </div>
                      <p className="text-[10px] text-gray-600">{b.sourceUser.name} &rarr; {b.targetUser.name}</p>
                    </div>
                    {b.isFaded && <span className="text-[9px] text-rose-400">Увядает</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'graph' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#131b2e]/80 border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] text-gray-600">Drag — перемещение | Клик — фокус | Двойной клик — разблокировать | Колесико — зум</p>
            </div>
          )}
        </div>

        {/* RIGHT: Detail */}
        {focusUser && viewMode === 'graph' && (
          <aside className="w-[300px] flex-shrink-0 border-l border-white/5 bg-[#060a14]/90 backdrop-blur-md p-4 overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <img src={focusUser.avatar} alt="" className="w-12 h-12 rounded-full border-2 object-cover"
                style={{ borderColor: focusUser.isLeader ? '#fbbf24' : STAGE_COLORS[focusUser.stage] }} />
              <div>
                <h3 className="text-sm font-bold text-gray-100">{focusUser.name}</h3>
                <p className="text-[10px] text-gray-500">{focusUser.role || STAGE_NAMES[focusUser.stage]}</p>
                <span className="inline-flex items-center justify-center bg-emerald-900/60 text-emerald-400 font-mono font-medium border border-emerald-700/40 text-[10px] px-2 py-0.5 rounded-full mt-1">B {focusUser.vklad}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                <p className="text-lg font-bold text-gray-100 font-mono">{focusUser.bondCount}</p>
                <p className="text-[9px] text-gray-600">Связей</p>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                <p className="text-lg font-bold font-mono" style={{ color: STAGE_COLORS[focusUser.stage] }}>{focusUser.stage}</p>
                <p className="text-[9px] text-gray-600">Уровень</p>
              </div>
            </div>
            {focusBondsGrouped.length > 0 && (
              <>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Связи ({focusBondsGrouped.length} человек)</p>
                <div className="space-y-2">
                  {focusBondsGrouped.map(({ other, bonds: bnds }) => (
                    <div key={other.id} className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
                      <button onClick={() => toggleDetailGroup(other.id)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/[0.02] transition-colors">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border"
                          style={{ borderColor: STAGE_COLORS[other.stage], background: STAGE_COLORS[other.stage] + '15', color: '#e2e8f0' }}>{other.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-gray-200 truncate">{other.name}</p>
                          <p className="text-[9px] text-gray-600">{STAGE_NAMES[other.stage]} &bull; B {other.vklad}</p>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">{bnds.length} связи</span>
                        {expanded.detailGroups.has(other.id) ? <ChevronDown className="w-3 h-3 text-gray-600" /> : <ChevronRight className="w-3 h-3 text-gray-600" />}
                      </button>
                      {expanded.detailGroups.has(other.id) && (
                        <div className="px-2.5 pb-2 space-y-1">
                          {bnds.map((b) => (
                            <div key={b.id} className="flex items-center gap-2 py-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[b.type] }} />
                              <span className="text-[11px]" style={{ color: BOND_COLORS[b.type] }}>{b.label}</span>
                              <span className="text-[10px] font-mono text-gray-600 ml-auto">x{b.strength}</span>
                              {b.isFaded && <span className="text-[9px] text-rose-400">Увядает</span>}
                              {!b.isFaded && <span className="text-[8px] text-gray-700">{Math.floor((Date.now() - b.lastReinforced) / 86400000)}д</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {focusUser.isOrphan && (
              <button className="w-full mt-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors flex items-center justify-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />Назначить наставника
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
