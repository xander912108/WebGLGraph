import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { users, bonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import type { User, Bond } from '@/types';
import Layout from '@/components/Layout';
import WebGLGraph from '@/components/WebGLGraph';
import type { WebGLGraphHandle, Bookmark } from '@/components/WebGLGraph';
import LegendPanel from '@/components/LegendPanel';
import ContextMenu from '@/components/ContextMenu';
import MiniMap from '@/components/MiniMap';
import {
  Search, Link2, Sun, ChevronDown, ChevronUp, SlidersHorizontal,
  ZoomIn, ZoomOut, Download, X,
  RotateCcw, BookmarkPlus, Bookmark as BookmarkIcon,
  Clock as ClockIcon, Trash2
} from 'lucide-react';

const CURRENT_USER_ID = 'u4';
const BOND_TYPES = [
  { key: 'help', label: 'Помощь' },
  { key: 'review', label: 'Разбор' },
  { key: 'ritual', label: 'Ритуал' },
  { key: 'intro', label: 'Знакомство' },
  { key: 'support', label: 'Опора' },
  { key: 'insight', label: 'Инсайт' },
];
const ROLES = ['Держатель круга', 'Наставник по практике', 'Связующий', 'Наставник на старт'];

const BOND_DESCRIPTIONS: Record<string, string> = {
  b4: 'Петр помог с разбором кейса о запуске продукта',
  b15: 'Александр поддержал на групповом созвоне',
  b20: 'Дмитрий дал инсайт по монетизации',
  b23: 'Иван провел разбор по стратегии роста',
  b28: 'Елена поддержала в сложный момент',
  b29: 'Петр помог на старте проекта',
  b30: 'Мария познакомила с командой',
  b31: 'Сергей дал обратную связь по презентации',
  b32: 'Ольга поделился инсайтом по маркетингу',
  b33: 'Александр провел ритуал закрытия месяца',
};

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} дн. назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед. назад`;
  return `${Math.floor(d / 30)} мес. назад`;
}

function loadBookmarks(): Bookmark[] {
  try { return JSON.parse(localStorage.getItem('mentori-bookmarks') || '[]'); } catch { return []; }
}
function saveBookmarks(bms: Bookmark[]) { localStorage.setItem('mentori-bookmarks', JSON.stringify(bms)); }

const NOW = Date.now();
const OLDEST_BOND = Math.min(...bonds.map((b) => b.lastReinforced));
const TIME_RANGE = NOW - OLDEST_BOND;

export default function MemberConnectionsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<WebGLGraphHandle>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [hoveredUser, setHoveredUser] = useState<User | null>(null);
  const [hoveredBond, setHoveredBond] = useState<Bond | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBondType, setSearchBondType] = useState<string | null>(null);
  const [searchRole, setSearchRole] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string>>(new Set());
  const [panelUser, setPanelUser] = useState<User | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; user: User } | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timePercent, setTimePercent] = useState(100);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [viewportCenter, setViewportCenter] = useState({ x: 0, y: 0 });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('mentori-onboarded');
  });
  const [bookmarkFlash, setBookmarkFlash] = useState(false);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const initialBookmarkSaved = useRef(false);

  const maxTime = timePercent >= 100 ? null : OLDEST_BOND + TIME_RANGE * (timePercent / 100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => { for (const en of e) setSize({ w: en.contentRect.width, h: en.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      graphRef.current?.zoomToFit(400, 100);
      setTimeout(() => {
        if (!initialBookmarkSaved.current && graphRef.current) {
          initialBookmarkSaved.current = true;
          const bms = loadBookmarks();
          if (!bms.find((b) => b.name === 'Начальная')) {
            const bm = graphRef.current.saveBookmark('Начальная');
            setBookmarks([bm, ...bms]);
            saveBookmarks([bm, ...bms]);
          }
        }
      }, 800);
    }, 900);
    return () => clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'graph') return;
    const iv = setInterval(() => {
      const c = graphRef.current?.getCenter?.();
      if (c) setViewportCenter(c);
    }, 50);
    return () => clearInterval(iv);
  }, [viewMode]);

  const currentUser = users.find((u) => u.id === CURRENT_USER_ID)!;
  const myBonds = useMemo(() => bonds.filter((b) => b.sourceId === CURRENT_USER_ID || b.targetId === CURRENT_USER_ID), []);

  const connectedIds = useMemo(() => {
    const ids = new Set([CURRENT_USER_ID]);
    myBonds.forEach((b) => { if (b.sourceId === CURRENT_USER_ID) ids.add(b.targetId); if (b.targetId === CURRENT_USER_ID) ids.add(b.sourceId); });
    return ids;
  }, [myBonds]);

  const connectedUsers = useMemo(() => users.filter((u) => connectedIds.has(u.id)), [connectedIds]);

  useEffect(() => {
    let matches = connectedUsers;
    if (searchQuery.length >= 2) matches = matches.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchBondType) {
      const withBondIds = new Set<string>();
      myBonds.filter((b) => b.type === searchBondType).forEach((b) => { if (b.sourceId === CURRENT_USER_ID) withBondIds.add(b.targetId); if (b.targetId === CURRENT_USER_ID) withBondIds.add(b.sourceId); });
      matches = matches.filter((u) => withBondIds.has(u.id));
    }
    if (searchRole) {
      matches = matches.filter((u) => searchRole === '_none' ? !u.role : u.role === searchRole);
    }
    if (searchQuery.length >= 2 || searchBondType || searchRole) setSearchMatchIds(new Set(matches.map((u) => u.id)));
    else setSearchMatchIds(new Set());
  }, [searchQuery, searchBondType, searchRole, connectedUsers, myBonds]);

  const searchResults = searchQuery.length >= 2 ? connectedUsers.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const focusUser = focusNodeId ? users.find((u) => u.id === focusNodeId) || null : null;

  const panelBonds = useMemo(() => {
    if (!panelUser) return [];
    return bonds.filter((b) => (b.sourceId === CURRENT_USER_ID && b.targetId === panelUser.id) || (b.targetId === CURRENT_USER_ID && b.sourceId === panelUser.id))
      .sort((a, b) => b.lastReinforced - a.lastReinforced)
      .map((b) => ({ ...b, label: BOND_LABELS[b.type], description: BOND_DESCRIPTIONS[b.id] || `${BOND_LABELS[b.type]} с ${panelUser.name}`, timeAgo: timeAgo(b.lastReinforced) }));
  }, [panelUser]);

  const myBondsList = useMemo(() => myBonds.map((b) => {
    const otherId = b.sourceId === CURRENT_USER_ID ? b.targetId : b.sourceId;
    const other = users.find((u) => u.id === otherId)!;
    return { ...b, other, label: BOND_LABELS[b.type] };
  }).sort((a, b) => b.strength - a.strength), [myBonds]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {

    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleZoomIn = () => { const z = (graphRef.current as any)?.zoom?.() || zoom; graphRef.current?.zoom(z * 1.15, 200); };
  const handleZoomOut = () => { const z = (graphRef.current as any)?.zoom?.() || zoom; graphRef.current?.zoom(z / 1.15, 200); };
  const handleReset = () => { setFocusNodeId(null); setPanelUser(null); setSelectedIds(new Set()); setTimePercent(100); graphRef.current?.resetSun(); };
  const exportPng = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mentori-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  const openPanel = (user: User) => { setPanelUser(user); setFocusNodeId(user.id); };
  const handleNodeRightClick = useCallback((user: User, x: number, y: number) => { setCtxMenu({ x, y, user }); }, []);
  const handleCtxAction = (action: 'message' | 'role' | 'profile') => {
    if (!ctxMenu) return;
    switch (action) { case 'message': alert(`Чат с ${ctxMenu.user.name}`); break; case 'role': alert(`Роль для ${ctxMenu.user.name}`); break; case 'profile': alert(`Профиль ${ctxMenu.user.name}`); break; }
    setCtxMenu(null);
  };
  const addBookmark = () => {
    if (!graphRef.current) return;
    const name = prompt('Название закладки:', `Карта ${bookmarks.length + 1}`);
    if (!name) return;
    const bm = graphRef.current.saveBookmark(name);
    const next = [bm, ...bookmarks];
    setBookmarks(next);
    saveBookmarks(next);
    // Visual feedback
    setBookmarkFlash(true);
    setBookmarkSaved(true);
    setTimeout(() => { setBookmarkFlash(false); setBookmarkSaved(false); }, 2000);
  };
  const restoreBookmark = (bm: Bookmark) => {
    console.log('Restoring bookmark:', bm.name, 'zoom:', bm.zoom, 'center:', bm.centerX, bm.centerY);
    graphRef.current?.restoreBookmark(bm);
    setShowBookmarks(false);
  };
  const deleteBookmark = (id: string) => { const next = bookmarks.filter((b) => b.id !== id); setBookmarks(next); saveBookmarks(next); };
  const toggleSelect = (user: User, shift: boolean) => {
    if (shift) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(user.id)) next.delete(user.id); else next.add(user.id); return next; }); }
    else { setSelectedIds(new Set()); openPanel(user); }
  };
  const handleMinimapClick = (wx: number, wy: number) => { graphRef.current?.centerAt(wx, wy, 300); };

  const rightActions = (
    <>
      <div className="relative">
        <button onClick={() => setShowBookmarks((p) => !p)} className={`p-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors relative ${bookmarkFlash ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-gray-500 hover:text-amber-400'}`} title={bookmarkSaved ? 'Карта связей сохранена!' : 'Закладки'}>
          <BookmarkIcon className={`w-4 h-4 ${bookmarkFlash ? 'animate-pulse' : ''}`} />
          {bookmarkSaved && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
        {showBookmarks && (
          <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-[#131b2e] border border-white/10 shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <span className="text-[11px] text-gray-400">Закладки ({bookmarks.length})</span>
              <button onClick={addBookmark} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[10px]" title="Сохранить текущее состояние">
                <BookmarkPlus className="w-3.5 h-3.5" />Сохранить
              </button>
            </div>
            {bookmarks.length === 0 && <p className="text-[10px] text-gray-600 px-3 py-3 text-center">Нет закладок. Сохраните текущую карту связей.</p>}
            {bookmarks.map((bm) => (
              <div key={bm.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors group">
                <button onClick={() => restoreBookmark(bm)} className="flex-1 text-left text-[11px] text-gray-300 hover:text-white truncate">{bm.name}</button>
                <span className="text-[9px] text-gray-600 tabular-nums">{new Date(bm.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                <button onClick={() => deleteBookmark(bm.id)} className="text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-5 w-px bg-white/10" />
      <button onClick={() => { graphRef.current?.resetSun(); handleReset(); }} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-amber-400 transition-colors" title="Исходное состояние"><RotateCcw className="w-4 h-4" /></button>
      <button onClick={exportPng} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-gray-200 transition-colors" title="Скачать карту связей"><Download className="w-4 h-4" /></button>
    </>
  );

  return (
    <Layout rightActions={rightActions}>

      {/* ====== COMPACT FILTER BAR (Premium) ====== */}
      {viewMode === 'graph' && (
        <div className="flex-shrink-0 border-b border-white/5">
          {/* Compact row — always visible */}
          <div className="px-5 py-2 flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input placeholder="Найти участника..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)}
                className="pl-8 pr-4 h-7 w-56 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500/50" />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 w-48 rounded-xl bg-[#131b2e] border border-white/10 shadow-2xl z-50 overflow-hidden">
                  {searchResults.map((u) => (
                    <button key={u.id} onClick={() => { openPanel(u); setShowSearch(false); setSearchQuery(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                      <img src={u.avatar} alt="" className="w-6 h-6 rounded-full border" style={{ borderColor: STAGE_COLORS[u.stage] }} />
                      <span className="text-xs text-gray-200">{u.name}</span>
                      <span className="text-[10px] font-mono text-emerald-400 ml-auto">B {u.vklad}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Expand filters toggle */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filtersExpanded ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Фильтры</span>
              {(searchBondType || searchRole) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              {filtersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {/* Active filters — compact dots */}
            <div className="flex items-center gap-1">
              {searchBondType && (
                <button onClick={() => setSearchBondType(null)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white transition-colors" style={{ backgroundColor: BOND_COLORS[searchBondType] + '30' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[searchBondType] }} />
                  {BOND_TYPES.find(b => b.key === searchBondType)?.label}
                  <X className="w-2.5 h-2.5 ml-0.5" />
                </button>
              )}
              {searchRole && (
                <button onClick={() => setSearchRole(null)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-amber-400 bg-amber-500/10 transition-colors">
                  {searchRole === '_none' ? 'Без роли' : searchRole}
                  <X className="w-2.5 h-2.5 ml-0.5" />
                </button>
              )}
            </div>
            <div className="flex-1" />
            {/* Time slider — always visible */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <ClockIcon className="w-3 h-3 text-gray-600" />
              <span className="text-[10px] text-gray-500 tabular-nums">{timePercent >= 100 ? 'Сейчас' : timePercent <= 0 ? 'Начало' : `${Math.round(timePercent * TIME_RANGE / 86400000 / 100)} дн назад`}</span>
              <input type="range" min={0} max={100} step={1} value={timePercent} onChange={(e) => setTimePercent(Number(e.target.value))} className="w-28 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500" />
            </div>
          </div>
          {/* Expanded filters panel */}
          {filtersExpanded && (
            <div className="px-5 pb-2.5 flex items-center gap-4">
              {/* Bond types */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-600 mr-1">Тип</span>
                <button onClick={() => setSearchBondType(null)} className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${!searchBondType ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Все</button>
                {BOND_TYPES.map((bt) => (
                  <button key={bt.key} onClick={() => setSearchBondType(searchBondType === bt.key ? null : bt.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors flex items-center gap-1 ${searchBondType === bt.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    style={searchBondType === bt.key ? { backgroundColor: BOND_COLORS[bt.key] + '30' } : {}}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: BOND_COLORS[bt.key] }} />{bt.label}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-white/10" />
              {/* Roles */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-600 mr-1">Роль</span>
                <button onClick={() => setSearchRole(null)} className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${!searchRole ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Все</button>
                {ROLES.map((role) => (
                  <button key={role} onClick={() => setSearchRole(searchRole === role ? null : role)}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${searchRole === role ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-gray-300'}`}>{role}</button>
                ))}
                <button onClick={() => setSearchRole(searchRole === '_none' ? null : '_none')}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${searchRole === '_none' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-gray-300'}`}>Без роли</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== BULK BAR ====== */}
      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 px-5 py-2 border-b border-white/5 bg-sky-500/5 flex items-center gap-3">
          <span className="text-[11px] text-sky-400">{selectedIds.size} выбрано</span>
          <div className="flex-1" />
          <button onClick={() => alert('Ритуал')} className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 hover:bg-sky-500/20 transition-colors">Ритуал</button>
          <button onClick={() => alert('Трек')} className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 hover:bg-sky-500/20 transition-colors">Трек</button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ====== MAIN ====== */}
      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} className="flex-1 relative" onMouseMove={onMouseMove}>
          {viewMode === 'graph' && size.w > 0 && size.h > 0 && (
            <>
              <WebGLGraph
                ref={graphRef}
                users={connectedUsers}
                bonds={myBonds}
                width={size.w}
                height={size.h}
                focusNodeId={focusNodeId}
                searchMatchIds={searchMatchIds}
                selectedIds={selectedIds}
                currentUserId={CURRENT_USER_ID}
                onNodeClick={(u) => toggleSelect(u, false)}
                onNodeRightClick={handleNodeRightClick}
                onNodeHover={setHoveredUser}
                onLinkHover={setHoveredBond}
                onZoomChange={(z) => setZoom(z)}
                onPositionsChange={setNodePositions}
                showOrphans={false}
                maxTime={maxTime}
              />
              <div className="absolute top-3 left-3 z-40"><LegendPanel compact /></div>
              <div className="absolute bottom-10 left-4 z-40 flex flex-col gap-1.5">
                <button onClick={handleZoomIn} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shadow-lg"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={handleZoomOut} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shadow-lg"><ZoomOut className="w-4 h-4" /></button>
              </div>
              {focusNodeId && (
                <button onClick={() => { setFocusNodeId(null); setPanelUser(null); }}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg bg-[#131b2e]/90 border border-white/10 text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 shadow-lg">
                  <RotateCcw className="w-3 h-3" />Сбросить фильтр
                </button>
              )}
              <MiniMap users={connectedUsers} bonds={myBonds} nodePositions={nodePositions}
                viewport={{ x: viewportCenter.x, y: viewportCenter.y, zoom }} width={size.w} height={size.h}
                onViewportClick={handleMinimapClick} />
              {/* Tooltip User */}
              {hoveredUser && (
                <div className="absolute z-50 pointer-events-none" style={{ left: mousePos.x + 16, top: mousePos.y + 12 }}>
                  <div className="p-2.5 rounded-lg bg-[#131b2e] border border-white/10 shadow-2xl backdrop-blur-xl min-w-[160px]">
                    <p className="text-[12px] font-semibold text-gray-100">{hoveredUser.name}</p>
                    <p className="text-[10px] text-gray-500">{hoveredUser.role || STAGE_NAMES[hoveredUser.stage]}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                      <span className="text-emerald-400 font-mono">B {hoveredUser.vklad}</span>
                      <span className="text-gray-600">{hoveredUser.bondCount} связей</span>
                      {hoveredUser.isOnline && <span className="text-emerald-500">online</span>}
                    </div>
                  </div>
                </div>
              )}
              {/* Tooltip Bond */}
              {hoveredBond && !hoveredUser && (
                <div className="absolute z-50 pointer-events-none" style={{ left: mousePos.x + 16, top: mousePos.y + 12 }}>
                  <div className="p-2.5 rounded-lg bg-[#131b2e] border shadow-2xl backdrop-blur-xl min-w-[180px]" style={{ borderColor: BOND_COLORS[hoveredBond.type] + '40' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: BOND_COLORS[hoveredBond.type] }} />
                      <span className="text-[12px] font-medium text-gray-100">{BOND_LABELS[hoveredBond.type]}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="font-mono text-gray-400">Сила: {hoveredBond.strength}</span>
                      <span>{timeAgo(hoveredBond.lastReinforced)}</span>
                      {hoveredBond.isFaded && <span className="text-rose-400">Увядает</span>}
                    </div>
                  </div>
                </div>
              )}
              {/* Hint */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-[#131b2e]/60 border border-white/5">
                <p className="text-[9px] text-gray-600">Перетащить &middot; Кликнуть для фокуса &middot; Shift + выбор &middot; Правый клик — меню</p>
              </div>
            </>
          )}
          {/* List View */}
          {viewMode === 'list' && (
            <div className="h-full overflow-y-auto p-6 flex justify-center">
              <div className="space-y-2 w-full max-w-lg">
                <h2 className="text-sm font-semibold text-gray-300 mb-4">Мои связи ({myBondsList.length})</h2>
                {myBondsList.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer"
                    onClick={(e) => toggleSelect(b.other, e.shiftKey)}>
                    <img src={b.other.avatar} alt="" className="w-7 h-7 rounded-full border flex-shrink-0" style={{ borderColor: STAGE_COLORS[b.other.stage] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-200 truncate">{b.other.name}</span>
                        <span className="text-[9px] text-gray-600 flex-shrink-0">{STAGE_NAMES[b.other.stage]}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BOND_COLORS[b.type] }} />
                        <span className="text-[11px] truncate" style={{ color: BOND_COLORS[b.type] }}>{b.label}</span>
                        <span className="text-[10px] font-mono text-gray-600 flex-shrink-0">x{b.strength}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400/70 flex-shrink-0">B {b.other.vklad}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} userName={ctxMenu.user.name} onAction={handleCtxAction} onClose={() => setCtxMenu(null)} />}

      {/* Slide-over Panel */}
      {panelUser && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => { setPanelUser(null); setFocusNodeId(null); }} />}
      <div className={`fixed right-0 top-14 bottom-0 w-[380px] z-50 transition-transform duration-300 ${panelUser ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full bg-[#0c1222]/95 backdrop-blur-xl border-l border-white/10 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Связь</span>
            <button onClick={() => { setPanelUser(null); setFocusNodeId(null); }} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={currentUser.avatar} alt="" className="w-14 h-14 rounded-full border-2" style={{ borderColor: STAGE_COLORS[currentUser.stage] }} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0c1222]" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-100">Я</p>
                  <p className="text-[11px] text-gray-500">{STAGE_NAMES[currentUser.stage]}</p>
                  <p className="text-[11px] font-mono text-emerald-400 mt-0.5">B {currentUser.vklad}</p>
                </div>
              </div>
              {currentUser.role && <p className="mt-3 text-[11px] text-gray-400 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/5">{currentUser.role}</p>}
            </div>
            <div className="px-5 py-2 flex items-center justify-center gap-3">
              <div className="h-px flex-1 bg-white/5" /><Link2 className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] text-gray-600">{panelBonds.length} связ{panelBonds.length === 1 ? 'ь' : panelBonds.length < 5 ? 'и' : 'ей'}</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            {panelUser && (
              <div className="px-5 pt-3 pb-5">
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative">
                    <img src={panelUser.avatar} alt="" className="w-14 h-14 rounded-full border-2" style={{ borderColor: panelUser.isLeader ? '#fbbf24' : STAGE_COLORS[panelUser.stage] }} />
                    {panelUser.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0c1222]" />}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-100">{panelUser.name}</p>
                    <p className="text-[11px] text-gray-500">{panelUser.role || STAGE_NAMES[panelUser.stage]}</p>
                    <p className="text-[11px] font-mono text-emerald-400 mt-0.5">B {panelUser.vklad}</p>
                  </div>
                </div>
                {panelBonds.length > 0 ? (
                  <div className="space-y-2">
                    {panelBonds.map((b) => (
                      <div key={b.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BOND_COLORS[b.type] }} />
                          <span className="text-[12px] font-medium" style={{ color: BOND_COLORS[b.type] }}>{b.label}</span>
                          <span className="text-[10px] font-mono text-gray-600 ml-auto">x{b.strength}</span>
                          {b.isFaded && <span className="text-[9px] text-rose-400 flex-shrink-0 ml-1">Увядает</span>}
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed">{b.description}</p>
                        <p className="text-[10px] text-gray-600 mt-1.5">{b.timeAgo}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-gray-600 text-center py-4">Нет прямых связей</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== ONBOARDING OVERLAY ====== */}
      {showOnboarding && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowOnboarding(false); localStorage.setItem('mentori-onboarded', '1'); }}>
          <div className="max-w-sm mx-4 p-6 rounded-2xl bg-[#0c1222] border border-amber-500/20 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Sun className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-100 mb-2">Солнце опоры</h3>
            <p className="text-[12px] text-gray-400 leading-relaxed mb-1">Вы — в центре. Вокруг вас те, с кем вы связаны.</p>
            <div className="space-y-1.5 my-4 text-left">
              <div className="flex items-center gap-2 text-[11px] text-gray-300"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />Перетащите круги — расширьте или соберите</div>
              <div className="flex items-center gap-2 text-[11px] text-gray-300"><div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />Кликните круг — откроется карточка связи</div>
              <div className="flex items-center gap-2 text-[11px] text-gray-300"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Shift + клик — выбор нескольких</div>
              <div className="flex items-center gap-2 text-[11px] text-gray-300"><div className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />Правый клик — меню действий</div>
            </div>
            <button onClick={() => { setShowOnboarding(false); localStorage.setItem('mentori-onboarded', '1'); }} className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[12px] font-semibold hover:bg-amber-500/25 transition-colors">
              Начать
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
