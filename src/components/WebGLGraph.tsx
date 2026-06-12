import { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { STAGE_COLORS, BOND_COLORS } from '@/types';
import type { User, Bond } from '@/types';

interface GNode {
  id: string; name: string; x?: number; y?: number; vx?: number; vy?: number;
  fx?: number | null; fy?: number | null; val: number; stage: number; vklad: number;
  color: string; isLeader: boolean; isOrphan: boolean; isOverloaded: boolean;
  isOnline: boolean; role: string | null; avatar: string;
}

interface GLn {
  source: string | GNode; target: string | GNode;
  color: string; width: number; strength: number; type: string;
  lastReinforced: number; bondIndex: number; totalBondsBetween: number;
}

export interface Bookmark {
  id: string; name: string; zoom: number;
  centerX: number; centerY: number;
  positions: Record<string, { x: number; y: number }>;
  timestamp: number;
}

interface UndoState {
  positions: Record<string, { x: number; y: number; fx?: number | null; fy?: number | null }>;
}

function hexRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function nodeRadius(stage: number, isLeader: boolean): number {
  if (isLeader) return 34;
  const s: Record<number, number> = { 1: 15, 2: 17, 3: 19, 4: 22, 5: 25, 6: 28, 7: 32 };
  return s[stage] || 19;
}

// Premium link alpha based on freshness
function linkAlpha(lastReinforced: number): number {
  const days = (Date.now() - lastReinforced) / 86400000;
  if (days < 1) return 0.7;
  if (days < 3) return 0.55;
  if (days < 7) return 0.4;
  if (days < 14) return 0.25;
  return 0.15;
}

function playClick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* ignore */ }
}

interface Props {
  users: User[];
  bonds: Bond[];
  width: number;
  height: number;
  focusNodeId: string | null;
  searchMatchIds?: Set<string>;
  selectedIds?: Set<string>;
  currentUserId?: string;
  onNodeClick: (user: User) => void;
  onNodeRightClick?: (user: User, x: number, y: number) => void;
  onNodeHover: (user: User | null) => void;
  onLinkHover?: (bond: Bond | null) => void;
  onZoomChange?: (zoom: number) => void;
  onPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
  showOrphans?: boolean;
  showOnlyConnectedTo?: string | null;
  maxTime?: number | null;
}

export interface WebGLGraphHandle {
  zoomToFit: (duration: number, padding: number) => void;
  zoom: (value: number, duration: number) => void;
  centerAt: (x: number, y: number, duration: number) => void;
  getCenter: () => { x: number; y: number };
  canvas: HTMLCanvasElement | null;
  resetSun: () => void;
  saveBookmark: (name: string) => Bookmark;
  restoreBookmark: (bm: Bookmark) => void;
  getNodePositions: () => Record<string, { x: number; y: number }>;
}

const WebGLGraph = forwardRef<WebGLGraphHandle, Props>(function WebGLGraph({
  users, bonds, width, height, focusNodeId, searchMatchIds = new Set(),
  selectedIds = new Set(), currentUserId,
  onNodeClick, onNodeRightClick, onNodeHover, onLinkHover, onZoomChange,
  onPositionsChange,
  showOrphans = true, showOnlyConnectedTo = null, maxTime = null,
}, ref) {
  const fgRef = useRef<any>(null);
  const hoverRef = useRef<string | null>(null);
  const timeRef = useRef(0);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const pinnedRef = useRef<Set<string>>(new Set());
  const birthRef = useRef(performance.now() / 1000);
  const gDataRef = useRef<{ nodes: GNode[]; links: GLn[] } | null>(null);
  const undoStack = useRef<UndoState[]>([]);
  const redoStack = useRef<UndoState[]>([]);

  useImperativeHandle(ref, () => ({
    zoomToFit: (d: number, p: number) => { fgRef.current?.zoomToFit(d, p); },
    zoom: (v: number, d: number) => fgRef.current?.zoom(v, d),
    centerAt: (x: number, y: number, d: number) => fgRef.current?.centerAt(x, y, d),
    getCenter: () => ({ x: fgRef.current?.centerX?.() || 0, y: fgRef.current?.centerY?.() || 0 }),
    get canvas() { return fgRef.current?.canvas; },
    resetSun: () => {
      if (!fgRef.current || !gDataRef.current) return;
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width, height) * 0.32;
      const nodes = gDataRef.current.nodes;
      const meNode = nodes.find((n) => n.id === currentUserId);
      if (meNode) { meNode.fx = cx; meNode.fy = cy; meNode.x = cx; meNode.y = cy; }
      const others = nodes.filter((n) => n.id !== currentUserId);
      others.forEach((n, i) => {
        const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
        n.fx = cx + Math.cos(angle) * radius;
        n.fy = cy + Math.sin(angle) * radius;
        n.x = n.fx; n.y = n.fy;
      });
      fgRef.current.graphData(gDataRef.current);
      fgRef.current.zoomToFit(400, 100);
    },
    saveBookmark: (name: string) => {
      const positions: Record<string, { x: number; y: number }> = {};
      gDataRef.current?.nodes.forEach((n) => { if (n.x != null && n.y != null) positions[n.id] = { x: n.x, y: n.y }; });
      return { id: `bm_${Date.now()}`, name, zoom: fgRef.current?.zoom() || 1, centerX: width / 2, centerY: height / 2, positions, timestamp: Date.now() };
    },
    restoreBookmark: (bm: Bookmark) => {
      if (!fgRef.current || !gDataRef.current) return;
      fgRef.current.zoom(bm.zoom, 400);
      gDataRef.current.nodes.forEach((n) => { const p = bm.positions[n.id]; if (p) { n.x = p.x; n.y = p.y; n.fx = p.x; n.fy = p.y; } });
      fgRef.current.graphData(gDataRef.current);
      fgRef.current.d3ReheatSimulation();
    },
    getNodePositions: () => {
      const p: Record<string, { x: number; y: number }> = {};
      gDataRef.current?.nodes.forEach((n) => { if (n.x != null && n.y != null) p[n.id] = { x: n.x, y: n.y }; });
      return p;
    },
    undo: () => {
      if (undoStack.current.length === 0) return false;
      const state = undoStack.current.pop()!;
      const cur: UndoState = { positions: {} };
      gDataRef.current?.nodes.forEach((n) => { cur.positions[n.id] = { x: n.x!, y: n.y!, fx: n.fx, fy: n.fy }; });
      redoStack.current.push(cur);
      gDataRef.current?.nodes.forEach((n) => { const s = state.positions[n.id]; if (s) { n.x = s.x; n.y = s.y; n.fx = s.fx; n.fy = s.fy; } });
      if (fgRef.current && gDataRef.current) { fgRef.current.graphData(gDataRef.current); fgRef.current.d3ReheatSimulation(); }
      return true;
    },
    redo: () => {
      if (redoStack.current.length === 0) return false;
      const state = redoStack.current.pop()!;
      const cur: UndoState = { positions: {} };
      gDataRef.current?.nodes.forEach((n) => { cur.positions[n.id] = { x: n.x!, y: n.y!, fx: n.fx, fy: n.fy }; });
      undoStack.current.push(cur);
      gDataRef.current?.nodes.forEach((n) => { const s = state.positions[n.id]; if (s) { n.x = s.x; n.y = s.y; n.fx = s.fx; n.fy = s.fy; } });
      if (fgRef.current && gDataRef.current) { fgRef.current.graphData(gDataRef.current); fgRef.current.d3ReheatSimulation(); }
      return true;
    },
  }));

  // Preload avatars
  useEffect(() => {
    users.forEach((u) => {
      if (imgCache.current.has(u.id)) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => imgCache.current.set(u.id, img);
      img.onerror = () => {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, 80, 80);
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.fillStyle = STAGE_COLORS[u.stage];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.name[0], 40, 40);
        const fb = new Image();
        fb.src = c.toDataURL();
        imgCache.current.set(u.id, fb);
      };
      img.src = u.avatar;
    });
  }, [users]);

  const vUsers = useMemo(() => {
    let r = users;
    if (!showOrphans) r = r.filter((u) => !u.isOrphan || u.isLeader);
    if (showOnlyConnectedTo) {
      const ids = new Set([showOnlyConnectedTo]);
      bonds.forEach((b) => { if (b.sourceId === showOnlyConnectedTo) ids.add(b.targetId); if (b.targetId === showOnlyConnectedTo) ids.add(b.sourceId); });
      r = r.filter((u) => ids.has(u.id));
    }
    return r;
  }, [users, bonds, showOrphans, showOnlyConnectedTo]);

  const vBonds = useMemo(() => {
    const ids = new Set(vUsers.map((u) => u.id));
    let r = bonds.filter((b) => ids.has(b.sourceId) && ids.has(b.targetId));
    if (maxTime != null) r = r.filter((b) => b.lastReinforced <= maxTime);
    return r;
  }, [vUsers, bonds, maxTime]);

  // === RADIAL STAR LAYOUT ===
  const gData = useMemo(() => {
    const cx = width / 2, cy = height / 2;
    const nodes: GNode[] = vUsers.map((u) => ({
      id: u.id, name: u.name,
      val: nodeRadius(u.stage, u.isLeader),
      stage: u.stage, vklad: u.vklad,
      color: u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage],
      isLeader: u.isLeader, isOrphan: u.isOrphan,
      isOverloaded: u.isOverloaded, isOnline: u.isOnline,
      role: u.role, avatar: u.avatar,
    }));

    // Position current user at center with stronger hold
    const meNode = nodes.find((n) => n.id === currentUserId);
    if (meNode) { meNode.fx = cx; meNode.fy = cy; meNode.x = cx; meNode.y = cy; }

    // === PERFECT SUN: evenly spaced nodes around circle ===
    const others = nodes.filter((n) => n.id !== currentUserId);
    const sunRadius = Math.min(width, height) * 0.32;
    const count = others.length;

    others.forEach((n, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // Start from top, go clockwise
      n.x = cx + Math.cos(angle) * sunRadius;
      n.y = cy + Math.sin(angle) * sunRadius;
      n.fx = n.x; n.fy = n.y; // Lock to sun position
    });

    // Aggregate bonds — one link per node pair (strongest bond wins)
    const bondAgg = new Map<string, { sourceId: string; targetId: string; type: string; strength: number; lastReinforced: number }>();
    vBonds.forEach((b) => {
      const key = [b.sourceId, b.targetId].sort().join('-');
      const existing = bondAgg.get(key);
      if (!existing || b.strength > existing.strength || (b.strength === existing.strength && b.lastReinforced > existing.lastReinforced)) {
        bondAgg.set(key, { sourceId: b.sourceId, targetId: b.targetId, type: b.type, strength: b.strength, lastReinforced: b.lastReinforced });
      }
    });

    const links: GLn[] = Array.from(bondAgg.values()).map((b, i) => ({
      source: b.sourceId, target: b.targetId,
      color: BOND_COLORS[b.type],
      width: Math.max(1.2, b.strength * 0.9),
      strength: b.strength, type: b.type,
      lastReinforced: b.lastReinforced,
      bondIndex: 0, totalBondsBetween: 1,
    }));

    const data = { nodes, links };
    gDataRef.current = data;
    return data;
  }, [vUsers, vBonds, width, height, currentUserId]);

  // Forces — balanced for bidirectional drag behavior
  useEffect(() => {
    if (!fgRef.current) return;
    // Balanced forces for radial sun layout
    fgRef.current.d3Force('charge', d3.forceManyBody().strength(-20));
    fgRef.current.d3Force('link', d3.forceLink().id((d: any) => d.id).distance(150).strength(0.2));
    fgRef.current.d3Force('collision', d3.forceCollide().radius((d: any) => d.val + 12).strength(0.5));
    // Gentle center force to keep layout centered
    fgRef.current.d3Force('center', d3.forceCenter(width / 2, height / 2).strength(0.015));
  }, [width, height]);

  // Lock "me" to center — every frame
  useEffect(() => {
    if (!currentUserId) return;
    const iv = setInterval(() => {
      const me = gDataRef.current?.nodes.find((n) => n.id === currentUserId);
      if (me) { me.fx = width / 2; me.fy = height / 2; me.x = width / 2; me.y = height / 2; }
    }, 50);
    return () => clearInterval(iv);
  }, [currentUserId, width, height]);

  // Positions for minimap
  useEffect(() => {
    const iv = setInterval(() => {
      if (onPositionsChange && gDataRef.current) {
        const p: Record<string, { x: number; y: number }> = {};
        gDataRef.current.nodes.forEach((n) => { if (n.x != null && n.y != null) p[n.id] = { x: n.x, y: n.y }; });
        onPositionsChange(p);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [onPositionsChange]);

  const connSet = useMemo(() => {
    if (!focusNodeId) return new Set<string>();
    const s = new Set([focusNodeId]);
    vBonds.forEach((b) => { if (b.sourceId === focusNodeId) s.add(b.targetId); if (b.targetId === focusNodeId) s.add(b.sourceId); });
    return s;
  }, [focusNodeId, vBonds]);

  const nOp = useCallback((id: string) => {
    if (searchMatchIds.size > 0) return searchMatchIds.has(id) ? 1 : 0.1;
    if (focusNodeId) return connSet.has(id) ? 1 : 0.05;
    return 1;
  }, [focusNodeId, connSet, searchMatchIds]);

  const lOp = useCallback((s: string, t: string) => {
    if (focusNodeId) return s === focusNodeId || t === focusNodeId ? 0.9 : 0.03;
    return 1;
  }, [focusNodeId]);

  // === PREMIUM NODE RENDERER ===
  const nodeCanvas = useCallback((node: any, ctx: CanvasRenderingContext2D, _gs: number) => {
    const n = node as GNode;
    const hov = hoverRef.current === n.id;
    const foc = focusNodeId === n.id;
    const sel = selectedIds.has(n.id);
    const isSearchMatch = searchMatchIds.has(n.id);
    const isMe = currentUserId && n.id === currentUserId;
    const op = nOp(n.id);
    const r = n.val;
    const x = n.x || 0, y = n.y || 0;
    const t = timeRef.current;

    ctx.save();
    ctx.globalAlpha = op;

    // Selection ring
    if (sel) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56,189,248,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Search match glow
    if (isSearchMatch && !focusNodeId) {
      const sp = Math.sin(t * 2.5) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = hexRgba(n.color, 0.4 * sp);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Premium ambient glow — smaller, more elegant
    const ag = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
    ag.addColorStop(0, hexRgba(n.color, hov || foc ? 0.18 : 0.08));
    ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // ONLINE indicator — subtle ring
    if (n.isOnline && !n.isLeader) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = hexRgba('#34d399', 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // HOVER glow
    if (hov || foc) {
      const gr = r * (foc ? 3 : 2.2);
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, gr);
      g.addColorStop(0, hexRgba(n.color, foc ? 0.35 : 0.25));
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    // NODE BODY — premium stroke
    ctx.shadowColor = isMe ? '#fbbf24' : n.color;
    ctx.shadowBlur = foc ? 16 : hov ? 10 : isMe ? 10 : 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#060a14';
    ctx.fill();
    ctx.strokeStyle = isMe ? '#fbbf24' : n.color;
    ctx.lineWidth = isMe ? 2.5 : n.isLeader ? 2 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner fill
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, Math.PI * 2);
    const ig = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r);
    ig.addColorStop(0, hexRgba(n.color, 0.15));
    ig.addColorStop(1, hexRgba(n.color, 0.03));
    ctx.fillStyle = ig;
    ctx.fill();

    // AVATAR (all nodes including "me")
    const nodeImg = imgCache.current.get(n.id);
    if (nodeImg && nodeImg.complete && nodeImg.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(nodeImg, x - r + 4, y - r + 4, (r - 4) * 2, (r - 4) * 2);
      ctx.restore();
    } else if (isMe) {
      ctx.font = `bold ${Math.max(r * 0.5, 13)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('Я', x, y);
    } else {
      // Fallback: initial letter
      ctx.font = `bold ${Math.max(r * 0.55, 10)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = n.color;
      ctx.fillText(n.name[0], x, y);
    }

    // Role indicator — small dot
    if (n.role) {
      ctx.beginPath();
      ctx.arc(x + r * 0.7, y - r * 0.7, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#080c18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Name label below node (hidden on hover to avoid duplicate with tooltip)
    if (!hov) {
      ctx.font = `500 ${Math.max(r * 0.3, 9)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = foc ? '#e5e7eb' : hexRgba('#9ca3af', 0.7);
      ctx.fillText(isMe ? 'Я' : n.name, x, y + r + 8);
    }

    ctx.restore();
  }, [focusNodeId, nOp, searchMatchIds, selectedIds, currentUserId]);

  // === PREMIUM LINK RENDERER — elegant curved lines ===
  const linkCanvas = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const l = link as GLn;
    const sx = (l.source as any).x || 0;
    const sy = (l.source as any).y || 0;
    const tx = (l.target as any).x || 0;
    const ty = (l.target as any).y || 0;
    const sId = (l.source as any).id as string;
    const tId = (l.target as any).id as string;
    const op = lOp(sId, tId);
    const alpha = linkAlpha(l.lastReinforced);
    const t = timeRef.current;

    if (op < 0.03) return;
    ctx.save();
    ctx.globalAlpha = op;

    // Calculate curve offset for parallel bonds
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let mx = (sx + tx) / 2;
    let my = (sy + ty) / 2;

    if (l.totalBondsBetween > 1) {
      // Curve perpendicular to link direction
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const offset = (l.bondIndex - (l.totalBondsBetween - 1) / 2) * 18;
      mx += perpX * offset;
      my += perpY * offset;
    }

    // Glow layer — stronger pulse for high-strength bonds
    if (alpha > 0.4) {
      const isStrong = l.strength >= 3;
      const pulseSpeed = isStrong ? 2.5 : 1.2;
      const pulseAmp = isStrong ? 0.35 : 0.15;
      const pulse = Math.sin(t * pulseSpeed + l.bondIndex) * pulseAmp + (1 - pulseAmp);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.strokeStyle = hexRgba(l.color, (isStrong ? 0.15 : 0.08) * alpha * pulse);
      ctx.lineWidth = (isStrong ? l.width + 14 : l.width + 8);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Main colored curve — visible but elegant
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.strokeStyle = hexRgba(l.color, alpha * 0.55);
    ctx.lineWidth = Math.max(l.width, 1.2);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner highlight — thinner brighter core
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.strokeStyle = hexRgba(l.color, alpha * 0.85);
    ctx.lineWidth = Math.max(l.width * 0.4, 0.5);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrowhead at target
    const tr = (l.target as any).val || 20;
    const angle = Math.atan2(ty - my, tx - mx);
    const arrowLen = 6;
    const arrowX = tx - Math.cos(angle) * (tr + 4);
    const arrowY = ty - Math.sin(angle) * (tr + 4);
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - arrowLen * Math.cos(angle - 0.45), arrowY - arrowLen * Math.sin(angle - 0.45));
    ctx.lineTo(arrowX - arrowLen * Math.cos(angle + 0.45), arrowY - arrowLen * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fillStyle = hexRgba(l.color, alpha * 0.8);
    ctx.fill();

    ctx.restore();
  }, [lOp]);

  // Background — deep space premium
  const bgCanvas = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
    grad.addColorStop(0, 'rgba(10,16,32,0.8)');
    grad.addColorStop(0.5, 'rgba(6,10,20,0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(148,163,184,0.04)';
    const spacing = 48;
    for (let gx = spacing; gx < w; gx += spacing) {
      for (let gy = spacing; gy < h; gy += spacing) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    const t = timeRef.current;
    [
      { cx: 0.15, cy: 0.2, color: '59,130,246', phase: 0 },
      { cx: 0.85, cy: 0.15, color: '139,92,246', phase: 2 },
      { cx: 0.8, cy: 0.8, color: '16,185,129', phase: 4 },
      { cx: 0.2, cy: 0.75, color: '6,182,212', phase: 6 },
    ].forEach((orb) => {
      const ox = w * (orb.cx + Math.sin(t * 0.08 + orb.phase) * 0.05);
      const oy = h * (orb.cy + Math.cos(t * 0.06 + orb.phase) * 0.05);
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.35);
      og.addColorStop(0, `rgba(${orb.color},0.025)`);
      og.addColorStop(1, 'transparent');
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, w, h);
    });
  }, []);

  // Drag with undo
  const dragStartPos = useRef<UndoState | null>(null);
  const onDragStart = useCallback((node: any) => {
    const n = node as GNode;
    if (currentUserId && n.id === currentUserId) {
      // Force "me" back to center immediately
      n.fx = width / 2; n.fy = height / 2; n.x = width / 2; n.y = height / 2;
      return;
    }
    const state: UndoState = { positions: {} };
    gDataRef.current?.nodes.forEach((nd) => { state.positions[nd.id] = { x: nd.x!, y: nd.y!, fx: nd.fx, fy: nd.fy }; });
    dragStartPos.current = state;
  }, [currentUserId, width, height]);

  const onDragEnd = useCallback((node: any) => {
    const n = node as GNode;
    if (currentUserId && n.id === currentUserId) {
      // Lock "me" to center
      n.fx = width / 2; n.fy = height / 2; n.x = width / 2; n.y = height / 2;
      if (fgRef.current) { fgRef.current.centerAt(width / 2, height / 2, 0); }
      return;
    }
    n.fx = n.x; n.fy = n.y;
    pinnedRef.current.add(n.id);
    if (dragStartPos.current) {
      undoStack.current.push(dragStartPos.current);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      dragStartPos.current = null;
    }
    if (fgRef.current) fgRef.current.d3ReheatSimulation();
  }, [width, height]);

  // Click — skip self
  const lastClick = useRef<{ id: string; time: number } | null>(null);
  const onClick = useCallback((n: any, event?: MouseEvent) => {
    const now = performance.now();
    const gn = n as GNode;
    if (currentUserId && gn.id === currentUserId) { playClick(); return; }
    if (lastClick.current && lastClick.current.id === gn.id && now - lastClick.current.time < 350) {
      if (pinnedRef.current.has(gn.id) && !gn.isLeader) {
        gn.fx = null; gn.fy = null;
        pinnedRef.current.delete(gn.id);
        if (fgRef.current) fgRef.current.d3ReheatSimulation();
      }
      lastClick.current = null;
      return;
    }
    lastClick.current = { id: gn.id, time: now };
    playClick();
    const u = users.find((x) => x.id === gn.id);
    if (u) onNodeClick(u);
  }, [users, onNodeClick, currentUserId]);

  const onHover = useCallback((n: any) => {
    hoverRef.current = n ? n.id : null;
    onNodeHover(n ? users.find((u) => u.id === n.id) || null : null);
  }, [users, onNodeHover]);

  const onRightClick = useCallback((n: any, event: MouseEvent) => {
    event.preventDefault();
    const gn = n as GNode;
    const u = users.find((x) => x.id === gn.id);
    if (u && onNodeRightClick) onNodeRightClick(u, event.clientX, event.clientY);
  }, [users, onNodeRightClick]);

  // Animation frame counter
  useEffect(() => {
    let frame = 0;
    const tick = () => { timeRef.current = performance.now() / 1000; frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={gData}
      width={width}
      height={height}
      backgroundColor="#060a14"
      nodeCanvasObject={nodeCanvas}
      nodeCanvasObjectMode={() => 'replace'}
      nodeLabel={() => ''}
      linkCanvasObject={linkCanvas}
      linkCanvasObjectMode={() => 'replace'}
      nodeRelSize={6}
      nodeVal="val"
      linkWidth="width"
      linkColor="color"
      onNodeClick={onClick}
      onNodeRightClick={onRightClick}
      onNodeHover={onHover}
      onLinkHover={(l: any) => {
        if (!onLinkHover) return;
        if (!l) { onLinkHover(null); return; }
        const sId = typeof l.source === 'string' ? l.source : l.source.id;
        const tId = typeof l.target === 'string' ? l.target : l.target.id;
        const bond = bonds.find((b) => (b.sourceId === sId && b.targetId === tId) || (b.sourceId === tId && b.targetId === sId));
        onLinkHover(bond || null);
      }}
      onNodeDragStart={onDragStart}
      onNodeDragEnd={onDragEnd}
      onZoomChange={onZoomChange}
      enableNodeDrag={true}
      minZoom={0.3}
      maxZoom={6}
      warmupTicks={200}
      cooldownTicks={40}
      autoPauseRedraw={false}
    />
  );
});

export default WebGLGraph;
