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

export default function MiniMap({ users, bonds, nodePositions, viewport, width, height, onViewportClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1a2236';
    ctx.fillRect(0, 0, size, size);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let gx = 8; gx < size - 8; gx += 12) {
      for (let gy = 8; gy < size - 8; gy += 12) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // Build sun layout positions (same as WebGLGraph)
    const meUser = users.find((u) => u.name === '\u042F');
    const meId = meUser?.id;
    const others = users.filter((u) => u.id !== meId);
    const cx = width / 2;
    const cy = height / 2;
    const sunRadius = Math.min(width, height) * 0.32;

    const sunPos: Record<string, { x: number; y: number }> = {};
    if (meId) {
      sunPos[meId] = { x: cx, y: cy };
    }
    const count = others.length;
    others.forEach((u, i) => {
      const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      sunPos[u.id] = {
        x: cx + Math.cos(angle) * sunRadius,
        y: cy + Math.sin(angle) * sunRadius,
      };
    });

    // Merge: use real nodePositions if available (for dragged nodes), else sun layout
    const pos: Record<string, { x: number; y: number }> = {};
    users.forEach((u) => {
      const real = nodePositions[u.id];
      if (real && real.x != null && real.y != null) {
        pos[u.id] = real;
      } else {
        pos[u.id] = sunPos[u.id] || { x: cx, y: cy };
      }
    });

    if (Object.keys(pos).length === 0) return;

    // Compute bounds from merged positions
    const vals = Object.values(pos);
    const minX = Math.min(...vals.map((p) => p.x)) - 80;
    const maxX = Math.max(...vals.map((p) => p.x)) + 80;
    const minY = Math.min(...vals.map((p) => p.y)) - 80;
    const maxY = Math.max(...vals.map((p) => p.y)) + 80;
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);

    const sc = Math.min((size - 16) / spanX, (size - 16) / spanY);
    const ox = 8 + (size - 16 - spanX * sc) / 2 - minX * sc;
    const oy = 8 + (size - 16 - spanY * sc) / 2 - minY * sc;

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
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Nodes
    users.forEach((u) => {
      const p = pos[u.id];
      if (!p) return;
      const x = tx(p.x);
      const y = ty(p.y);
      const isMe = u.id === meId;
      const color = isMe ? '#fbbf24' : (u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage]);

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, isMe ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = hexRgba(color, isMe ? 0.4 : 0.3);
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(x, y, isMe ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // White center
      ctx.beginPath();
      ctx.arc(x, y, isMe ? 2 : 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();

      // "Я" label
      if (isMe) {
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('\u042F', x, y + 10);
      }
    });

    // Viewport indicator
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;
    const vw = Math.max(width / vz * sc, 10);
    const vh = Math.max(height / vz * sc, 10);
    const vrx = tx(vx - (width / vz) / 2);
    const vry = ty(vy - (height / vz) / 2);

    const cX = Math.max(0, Math.min(vrx, size - 2));
    const cY = Math.max(0, Math.min(vry, size - 2));
    const cW = Math.min(vw, size - cX);
    const cH = Math.min(vh, size - cY);

    if (cW > 2 && cH > 2) {
      ctx.strokeStyle = 'rgba(52,211,153,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cX, cY, cW, cH);
      ctx.fillStyle = 'rgba(52,211,153,0.08)';
      ctx.fillRect(cX, cY, cW, cH);
    }

  }, [users, bonds, nodePositions, viewport, width, height]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Build same transform as in useEffect
    const meUser = users.find((u) => u.name === '\u042F');
    const meId = meUser?.id;
    const others = users.filter((u) => u.id !== meId);
    const cx = width / 2;
    const cy = height / 2;
    const sunRadius = Math.min(width, height) * 0.32;

    const sunPos: Record<string, { x: number; y: number }> = {};
    if (meId) sunPos[meId] = { x: cx, y: cy };
    const count = others.length;
    others.forEach((u, i) => {
      const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      sunPos[u.id] = { x: cx + Math.cos(angle) * sunRadius, y: cy + Math.sin(angle) * sunRadius };
    });

    const pos: Record<string, { x: number; y: number }> = {};
    users.forEach((u) => {
      const real = nodePositions[u.id];
      if (real && real.x != null && real.y != null) {
        pos[u.id] = real;
      } else {
        pos[u.id] = sunPos[u.id] || { x: cx, y: cy };
      }
    });

    const vals = Object.values(pos);
    if (vals.length === 0) return;
    const minX = Math.min(...vals.map((p) => p.x)) - 80;
    const maxX = Math.max(...vals.map((p) => p.x)) + 80;
    const minY = Math.min(...vals.map((p) => p.y)) - 80;
    const maxY = Math.max(...vals.map((p) => p.y)) + 80;
    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);
    const sc = Math.min((size - 16) / spanX, (size - 16) / spanY);
    const ox = 8 + (size - 16 - spanX * sc) / 2 - minX * sc;
    const oy = 8 + (size - 16 - spanY * sc) / 2 - minY * sc;

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