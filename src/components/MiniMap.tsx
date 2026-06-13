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

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, size, size);

    // Subtle grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let gx = 0; gx < size; gx += 12) {
      for (let gy = 0; gy < size; gy += 12) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    ctx.restore();

    // Get positions — always use sun layout for minimap
    const meUser = users.find((u) => u.name === 'Я');
    const meId = meUser?.id;
    const others = users.filter((u) => u.id !== meId);
    const pos: Record<string, { x: number; y: number }> = {};

    // Sun layout: center = (0,0), others on circle radius 1
    if (meId) {
      pos[meId] = { x: 0, y: 0 };
    }
    const count = others.length;
    others.forEach((u, i) => {
      const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      pos[u.id] = { x: Math.cos(angle), y: Math.sin(angle) };
    });

    if (Object.keys(pos).length === 0) return;

    // Transform: sun layout → minimap pixels
    const centerX = size / 2;
    const centerY = size / 2;
    const mapRadius = (size / 2) - 14; // padding from edge

    const tx = (x: number) => centerX + x * mapRadius;
    const ty = (y: number) => centerY + y * mapRadius;

    // Links
    bonds.forEach((b) => {
      const s = pos[b.sourceId];
      const t = pos[b.targetId];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(tx(s.x), ty(s.y));
      ctx.lineTo(tx(t.x), ty(t.y));
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.4);
      ctx.lineWidth = 1;
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

      if (isMe) {
        // Central "Я" — larger gold glow
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = hexRgba('#fbbf24', 0.25);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Label
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('Я', x, y + 14);
      } else {
        // Regular node — smaller
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = hexRgba(color, 0.3);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    });

    // Circular border
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Viewport indicator
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vz = viewport.zoom || 1;

    // Map viewport rect to minimap sun coordinates
    const viewW = (width / vz) / (width * 0.65);
    const viewH = (height / vz) / (height * 0.65);
    const viewX = ((vx - width / 2) / (width * 0.325));
    const viewY = ((vy - height / 2) / (height * 0.325));

    const vrx = tx(viewX - viewW / 2);
    const vry = ty(viewY - viewH / 2);
    const vrW = Math.max(viewW * mapRadius, 8);
    const vrH = Math.max(viewH * mapRadius, 8);

    ctx.strokeStyle = 'rgba(52,211,153,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vrx, vry, vrW, vrH);
    ctx.fillStyle = 'rgba(52,211,153,0.06)';
    ctx.fillRect(vrx, vry, vrW, vrH);

  }, [users, bonds, nodePositions, viewport, width, height]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Map click to sun layout coords (-1 to 1)
    const nx = (mx - size / 2) / ((size / 2) - 14);
    const ny = (my - size / 2) / ((size / 2) - 14);

    // Convert to world coords
    const worldX = width / 2 + nx * Math.min(width, height) * 0.32;
    const worldY = height / 2 + ny * Math.min(width, height) * 0.32;

    onViewportClick(worldX, worldY);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 rounded-full overflow-hidden shadow-2xl border border-white/20" style={{ width: size, height: size }}>
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
