import { useRef, useEffect, useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { users, bonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import { ZoomIn, ZoomOut } from 'lucide-react';

const CURRENT_USER_ID = 'u4';

interface GNode {
  id: string; user: typeof users[0]; x: number; y: number; vx: number; vy: number;
  radius: number; opacity: number;
}

export default function GalaxyPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const allUsers = useMemo(() => users.filter((u) => !u.isOrphan || u.isLeader), []);
  const allBonds = useMemo(() => bonds, []);

  const nodesRef = useRef<GNode[]>([]);
  useEffect(() => {
    const cx = size.w / 2, cy = size.h / 2;
    const nodes: GNode[] = allUsers.map((u, i) => {
      const angle = (i / allUsers.length) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 80 + Math.random() * 250;
      return { id: u.id, user: u, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, radius: u.isLeader ? 28 : 14 + u.stage * 2, opacity: 1 };
    });
    const meNode = nodes.find((n) => n.id === CURRENT_USER_ID);
    if (meNode) { meNode.x = cx; meNode.y = cy; meNode.vx = 0; meNode.vy = 0; }
    nodesRef.current = nodes;
  }, [allUsers, size]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => { for (const en of e) setSize({ w: en.contentRect.width, h: en.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animRef = 0;

    const tick = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      const bg = ctx.createRadialGradient(size.w / 2, size.h / 2, 0, size.w / 2, size.h / 2, size.w);
      bg.addColorStop(0, '#0a0f1e'); bg.addColorStop(1, '#030508');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, size.w, size.h);

      for (let i = 0; i < 80; i++) {
        const sf = Math.sin(performance.now() * 0.001 + i) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${0.03 * sf})`;
        ctx.fillRect((i * 137.5 + size.w * 0.3) % size.w, (i * 97.3 + size.h * 0.2) % size.h, 1.5, 1.5);
      }

      ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(zoom, zoom);

      allBonds.forEach((b) => {
        const s = nodesRef.current.find((n) => n.id === b.sourceId);
        const t = nodesRef.current.find((n) => n.id === b.targetId);
        if (!s || !t) return;
        const dist = Math.sqrt((t.x - s.x) ** 2 + (t.y - s.y) ** 2);
        if (dist > 500) return;
        const alpha = Math.max(0.05, 0.4 - dist / 600);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(${parseInt(BOND_COLORS[b.type].slice(1, 3), 16)},${parseInt(BOND_COLORS[b.type].slice(3, 5), 16)},${parseInt(BOND_COLORS[b.type].slice(5, 7), 16)},${alpha * (b.strength / 5)})`;
        ctx.lineWidth = 0.5 + b.strength * 0.3; ctx.stroke();
      });

      const time = performance.now() * 0.001;
      nodesRef.current.forEach((n) => {
        if (n.id !== CURRENT_USER_ID) {
          n.x += n.vx; n.y += n.vy;
          const ddx = n.x - size.w / 2, ddy = n.y - size.h / 2;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d > 400) { n.vx -= ddx * 0.00002; n.vy -= ddy * 0.00002; }
          n.vx *= 0.999; n.vy *= 0.999;
        }
        const isHov = hoveredId === n.id;
        const isMe = n.id === CURRENT_USER_ID;
        const r = n.radius;

        const ag = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 2.2);
        ag.addColorStop(0, `rgba(${isMe ? '251,191,36' : STAGE_COLORS[n.user.stage].slice(1).match(/.{2}/g)!.map((h: string) => parseInt(h, 16)).join(',')},${isHov ? 0.3 : 0.15})`);
        ag.addColorStop(1, 'transparent');
        ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.2, 0, Math.PI * 2); ctx.fill();

        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#080c18'; ctx.fill();
        ctx.strokeStyle = isMe ? '#fbbf24' : STAGE_COLORS[n.user.stage];
        ctx.lineWidth = isMe ? 3 : 1.5; ctx.stroke();

        ctx.font = `bold ${Math.max(r * 0.6, 11)}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = isMe ? '#fbbf24' : STAGE_COLORS[n.user.stage];
        ctx.fillText(isMe ? 'Я' : n.user.name[0], n.x, n.y);

        if (!isMe) {
          ctx.font = '500 9px Inter, sans-serif';
          ctx.fillStyle = isHov ? '#fff' : 'rgba(255,255,255,0.5)';
          ctx.fillText(n.user.name, n.x, n.y + r + 11);
        }
      });
      ctx.restore();
      animRef = requestAnimationFrame(tick);
    };
    animRef = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef);
  }, [size, zoom, offset, allBonds, hoveredId]);

  const getWorldPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left - offset.x) / zoom, y: (e.clientY - rect.top - offset.y) / zoom };
  };

  return (
    <Layout>
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} width={size.w} height={size.h} className="absolute inset-0 cursor-crosshair"
          onMouseMove={(e) => {
            if (isDragging.current) { setOffset({ x: offsetStart.current.x + (e.clientX - dragStart.current.x), y: offsetStart.current.y + (e.clientY - dragStart.current.y) }); return; }
            const pos = getWorldPos(e);
            const found = nodesRef.current.find((n) => { const dx = n.x - pos.x, dy = n.y - pos.y; return Math.sqrt(dx * dx + dy * dy) < n.radius + 5; });
            setHoveredId(found ? found.id : null);
          }}
          onMouseDown={(e) => { if (hoveredId) return; isDragging.current = true; dragStart.current = { x: e.clientX, y: e.clientY }; offsetStart.current = { ...offset }; }}
          onMouseUp={() => { isDragging.current = false; }}
          onMouseLeave={() => { isDragging.current = false; }}
          onWheel={(e) => { e.preventDefault(); const delta = e.deltaY > 0 ? 0.92 : 1.08; setZoom((z) => Math.min(Math.max(z * delta, 0.3), 4)); }}
        />
        <div className="absolute bottom-10 left-4 z-40 flex flex-col gap-1.5">
          <button onClick={() => setZoom((z) => z * 1.12)} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setZoom((z) => z / 1.12)} className="w-8 h-8 rounded-lg bg-[#131b2e]/90 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
        </div>
        <div className="absolute top-3 left-3 z-40 p-2.5 rounded-xl bg-[#131b2e]/80 border border-white/5 backdrop-blur-sm">
          <p className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-wider">Уровни</p>
          {Object.entries(STAGE_NAMES).map(([stage, name]) => (
            <div key={stage} className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[Number(stage)] }} />
              <span className="text-[9px] text-gray-400">{name}</span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-[#131b2e]/60 border border-white/5">
          <p className="text-[9px] text-gray-600">Перетащить для панорамы &middot; Колесико для масштаба</p>
        </div>
      </div>
    </Layout>
  );
}
