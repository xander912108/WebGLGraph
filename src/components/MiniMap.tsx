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
const pad = 8;

export default function MiniMap({ users, bonds, nodePositions, viewport, width, height, onViewportClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Bright semi-transparent background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // Check positions
    let pos = nodePositions;
    if (!pos || Object.keys(pos).length === 0) {
      // Fallback: compute sun layout positions
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.32;
      const meId = users.find((u) => u.name === 'Я')?.id || users[0]?.id;
      const others = users.filter((u) => u.id !== meId);
      pos = {};
      users.forEach((u) => {
        if (u.id === meId) {
          pos[u.id] = { x: cx, y: cy };
        } else {
          const idx = others.findIndex((o) => o.id === u.id);
          const angle = (idx / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
          pos[u.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
        }
      });
    }

    if (!pos || Object.keys(pos).length === 0) return;

    // Compute bounds
    const vals = Object.values(pos);
    let minX = Math.min(...vals.map((p) => p.x));
    let maxX = Math.max(...vals.map((p) => p.x));
    let minY = Math.min(...vals.map((p) => p.y));
    let maxY = Math.max(...vals.map((p) => p.y));
    // Add padding
    const padding = 80;
    minX -= padding; maxX += padding;
    minY -= padding; maxY += padding;
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);

    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const ox = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const oy = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    const tx = (x: number) => x * sc + ox;
    const ty = (y: number) => y * sc + oy;

    // Links — brighter
    bonds.forEach((b) => {
      const s = pos[b.sourceId];
      const t = pos[b.targetId];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(tx(s.x), ty(s.y));
      ctx.lineTo(tx(t.x), ty(t.y));
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Nodes — brighter with glow
    users.forEach((u) => {
      const p = pos[u.id];
      if (!p) return;
      const x = tx(p.x);
      const y = ty(p.y);
      const color = u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage];

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = hexRgba(color, 0.35);
      ctx.fill();

      // Core — white-ish center for visibility
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // White center dot
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    });

    // Viewport indicator — bright green
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;
    const vw = Math.max(width / vz * sc, 12);
    const vh = Math.max(height / vz * sc, 12);
    const vrx = tx(vx - (width / vz) / 2);
    const vry = ty(vy - (height / vz) / 2);

    // Clamp to minimap bounds
    const clampedX = Math.max(0, Math.min(vrx, size - vw));
    const clampedY = Math.max(0, Math.min(vry, size - vh));

    ctx.strokeStyle = 'rgba(52,211,153,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(clampedX, clampedY, Math.min(vw, size - clampedX), Math.min(vh, size - clampedY));
    ctx.fillStyle = 'rgba(52,211,153,0.1)';
    ctx.fillRect(clampedX, clampedY, Math.min(vw, size - clampedX), Math.min(vh, size - clampedY));

  }, [users, bonds, nodePositions, viewport, width, height]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Recompute transform (same as in useEffect)
    let pos = nodePositions;
    if (!pos || Object.keys(pos).length === 0) {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.32;
      const meId = users.find((u) => u.name === 'Я')?.id || users[0]?.id;
      const others = users.filter((u) => u.id !== meId);
      pos = {};
      users.forEach((u) => {
        if (u.id === meId) {
          pos[u.id] = { x: cx, y: cy };
        } else {
          const idx = others.findIndex((o) => o.id === u.id);
          const angle = (idx / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
          pos[u.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
        }
      });
    }

    const vals = Object.values(pos);
    if (vals.length === 0) return;
    let minX = Math.min(...vals.map((p) => p.x)) - 80;
    let maxX = Math.max(...vals.map((p) => p.x)) + 80;
    let minY = Math.min(...vals.map((p) => p.y)) - 80;
    let maxY = Math.max(...vals.map((p) => p.y)) + 80;
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);
    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const ox = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const oy = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    onViewportClick((mx - ox) / sc, (my - oy) / sc);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 rounded-lg overflow-hidden shadow-2xl border border-white/20" style={{ width: size, height: size }}>
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
