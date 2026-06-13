import { useRef, useEffect } from 'react';
import { STAGE_COLORS, BOND_COLORS } from '@/types';
import type { User, Bond } from '@/types';

interface Props {
  users: User[];
  bonds: Bond[];
  nodePositions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
  width: number;
  height: number;
  onViewportClick: (nx: number, ny: number) => void;
}

export default function MiniMap({ users, bonds, nodePositions, viewport, width, height, onViewportClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 180;
  const pad = 4;

  // Direct draw — reads fresh props every frame
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(6,10,20,0.9)';
    ctx.fillRect(0, 0, size, size);

    const pos = nodePositions;
    if (!pos || Object.keys(pos).length === 0) {
      // Border only when empty
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, size, size);
      return;
    }

    const vals = Object.values(pos);
    const minX = Math.min(...vals.map((p) => p.x));
    const maxX = Math.max(...vals.map((p) => p.x));
    const minY = Math.min(...vals.map((p) => p.y));
    const maxY = Math.max(...vals.map((p) => p.y));
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);

    const scaleX = (size - pad * 2) / spanX;
    const scaleY = (size - pad * 2) / spanY;
    const sc = Math.min(scaleX, scaleY);
    const offX = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const offY = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    const tx = (x: number) => x * sc + offX;
    const ty = (y: number) => y * sc + offY;

    // Links
    bonds.forEach((b) => {
      const s = pos[b.sourceId];
      const t = pos[b.targetId];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(tx(s.x), ty(s.y));
      ctx.lineTo(tx(t.x), ty(t.y));
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.12);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // Nodes
    users.forEach((u) => {
      const p = pos[u.id];
      if (!p) return;
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), u.isLeader ? 3 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage];
      ctx.fill();
    });

    // Viewport rectangle
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;
    const vw = width / vz;
    const vh = height / vz;
    const vrx = tx(vx - vw / 2);
    const vry = ty(vy - vh / 2);
    const vrw = Math.max(vw * sc, 6);
    const vrh = Math.max(vh * sc, 6);

    ctx.strokeStyle = 'rgba(52,211,153,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vrx, vry, vrw, vrh);
    ctx.fillStyle = 'rgba(52,211,153,0.05)';
    ctx.fillRect(vrx, vry, vrw, vrh);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
  };

  // RAF loop — always uses latest props via closure
  useEffect(() => {
    let raf: number;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const vals = Object.values(nodePositions);
    if (vals.length === 0) return;
    const minX = Math.min(...vals.map((p) => p.x));
    const maxX = Math.max(...vals.map((p) => p.x));
    const minY = Math.min(...vals.map((p) => p.y));
    const maxY = Math.max(...vals.map((p) => p.y));
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);
    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const offX = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const offY = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    onViewportClick((mx - offX) / sc, (my - offY) / sc);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 rounded-lg overflow-hidden shadow-xl border border-white/10">
      <canvas ref={canvasRef} width={size} height={size} className="cursor-pointer" onClick={handleClick} />
    </div>
  );
}

function hexRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
