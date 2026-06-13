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

const size = 180;
const pad = 6;

export default function MiniMap({ users, bonds, nodePositions, viewport, width, height, onViewportClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#0f1720';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    const pos = nodePositions;
    if (!pos || Object.keys(pos).length === 0) return;

    // Compute bounds
    const vals = Object.values(pos);
    const minX = Math.min(...vals.map((p) => p.x)) - 60;
    const maxX = Math.max(...vals.map((p) => p.x)) + 60;
    const minY = Math.min(...vals.map((p) => p.y)) - 60;
    const maxY = Math.max(...vals.map((p) => p.y)) + 60;
    const spanX = Math.max(maxX - minX, 100);
    const spanY = Math.max(maxY - minY, 100);

    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const ox = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const oy = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    const tx = (x: number) => x * sc + ox;
    const ty = (y: number) => y * sc + oy;

    // Links
    bonds.forEach((b) => {
      const s = pos[b.sourceId];
      const t = pos[b.targetId];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(tx(s.x), ty(s.y));
      ctx.lineTo(tx(t.x), ty(t.y));
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Nodes
    users.forEach((u) => {
      const p = pos[u.id];
      if (!p) return;
      const x = tx(p.x);
      const y = ty(p.y);
      const color = u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage];
      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = hexRgba(color, 0.25);
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Viewport
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;
    const vw = Math.max(width / vz * sc, 10);
    const vh = Math.max(height / vz * sc, 10);
    const vrx = tx(vx - (width / vz) / 2);
    const vry = ty(vy - (height / vz) / 2);

    ctx.strokeStyle = 'rgba(52,211,153,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vrx, vry, vw, vh);
    ctx.fillStyle = 'rgba(52,211,153,0.06)';
    ctx.fillRect(vrx, vry, vw, vh);
  }, [users, bonds, nodePositions, viewport, width, height]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const vals = Object.values(nodePositions);
    if (vals.length === 0) return;
    const minX = Math.min(...vals.map((p) => p.x)) - 60;
    const maxX = Math.max(...vals.map((p) => p.x)) + 60;
    const minY = Math.min(...vals.map((p) => p.y)) - 60;
    const maxY = Math.max(...vals.map((p) => p.y)) + 60;
    const spanX = Math.max(maxX - minX, 100);
    const spanY = Math.max(maxY - minY, 100);
    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const ox = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const oy = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    onViewportClick((mx - ox) / sc, (my - oy) / sc);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 rounded-lg overflow-hidden shadow-xl border border-white/15" style={{ width: size, height: size }}>
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
