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
const pad = 10;

export default function MiniMap({ users, bonds, nodePositions, viewport, width, height, onViewportClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background — brighter
    ctx.fillStyle = '#1a2236';
    ctx.fillRect(0, 0, size, size);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let gx = pad; gx < size - pad; gx += 14) {
      for (let gy = pad; gy < size - pad; gy += 14) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // Determine positions to use
    let pos: Record<string, { x: number; y: number }>;
    let useSunLayout = false;

    if (nodePositions && Object.keys(nodePositions).length >= users.length) {
      // Use real positions from force-graph
      pos = nodePositions;
    } else {
      // Fallback: sun layout
      useSunLayout = true;
      const meUser = users.find((u) => u.name === 'Я');
      const meId = meUser?.id;
      const others = users.filter((u) => u.id !== meId);
      pos = {};

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.32;

      if (meId) {
        pos[meId] = { x: cx, y: cy };
      }
      const count = others.length;
      others.forEach((u, i) => {
        const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
        pos[u.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });
    }

    if (Object.keys(pos).length === 0) return;

    // Compute bounds
    const vals = Object.values(pos);
    let minX = Math.min(...vals.map((p) => p.x));
    let maxX = Math.max(...vals.map((p) => p.x));
    let minY = Math.min(...vals.map((p) => p.y));
    let maxY = Math.max(...vals.map((p) => p.y));

    if (useSunLayout) {
      // For sun layout, add fixed padding
      const p = 120;
      minX -= p; maxX += p;
      minY -= p; maxY += p;
    } else {
      // For real positions, add smaller padding
      const p = 60;
      minX -= p; maxX += p;
      minY -= p; maxY += p;
    }

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

    // Nodes — brighter
    users.forEach((u) => {
      const p = pos[u.id];
      if (!p) return;
      const x = tx(p.x);
      const y = ty(p.y);
      const isMe = u.name === 'Я';
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
        ctx.fillText('Я', x, y + 10);
      }
    });

    // Viewport indicator — bright green rectangle
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;
    const vw = Math.max(width / vz * sc, 10);
    const vh = Math.max(height / vz * sc, 10);
    const vrx = tx(vx - (width / vz) / 2);
    const vry = ty(vy - (height / vz) / 2);

    // Clamp
    const cx = Math.max(0, Math.min(vrx, size - 2));
    const cy_ = Math.max(0, Math.min(vry, size - 2));
    const cw = Math.min(vw, size - cx);
    const ch = Math.min(vh, size - cy_);

    if (cw > 2 && ch > 2) {
      ctx.strokeStyle = 'rgba(52,211,153,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy_, cw, ch);
      ctx.fillStyle = 'rgba(52,211,153,0.08)';
      ctx.fillRect(cx, cy_, cw, ch);
    }

  }, [users, bonds, nodePositions, viewport, width, height]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Determine positions (same logic as useEffect)
    let pos: Record<string, { x: number; y: number }>;
    let useSunLayout = false;

    if (nodePositions && Object.keys(nodePositions).length >= users.length) {
      pos = nodePositions;
    } else {
      useSunLayout = true;
      const meUser = users.find((u) => u.name === 'Я');
      const meId = meUser?.id;
      const others = users.filter((u) => u.id !== meId);
      pos = {};
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.32;
      if (meId) pos[meId] = { x: cx, y: cy };
      const count = others.length;
      others.forEach((u, i) => {
        const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
        pos[u.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });
    }

    const vals = Object.values(pos);
    if (vals.length === 0) return;

    let minX = Math.min(...vals.map((p) => p.x));
    let maxX = Math.max(...vals.map((p) => p.x));
    let minY = Math.min(...vals.map((p) => p.y));
    let maxY = Math.max(...vals.map((p) => p.y));

    if (useSunLayout) {
      const p = 120;
      minX -= p; maxX += p;
      minY -= p; maxY += p;
    } else {
      const p = 60;
      minX -= p; maxX += p;
      minY -= p; maxY += p;
    }

    const spanX = Math.max(maxX - minX, 200);
    const spanY = Math.max(maxY - minY, 200);
    const sc = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
    const ox = pad + (size - pad * 2 - spanX * sc) / 2 - minX * sc;
    const oy = pad + (size - pad * 2 - spanY * sc) / 2 - minY * sc;

    // Convert minimap pixel → world coord
    const worldX = (mx - ox) / sc;
    const worldY = (my - oy) / sc;

    onViewportClick(worldX, worldY);
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
