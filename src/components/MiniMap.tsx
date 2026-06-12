import { useRef, useEffect, useCallback } from 'react';
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = 'rgba(6,10,20,0.9)';
    ctx.fillRect(0, 0, size, size);

    if (!nodePositions || Object.keys(nodePositions).length === 0) return;

    // Find bounds
    const xs = Object.values(nodePositions).map((p) => p.x);
    const ys = Object.values(nodePositions).map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);

    const scaleX = (size - pad * 2) / spanX;
    const scaleY = (size - pad * 2) / spanY;
    const scale = Math.min(scaleX, scaleY);
    const offX = pad + (size - pad * 2 - spanX * scale) / 2 - minX * scale;
    const offY = pad + (size - pad * 2 - spanY * scale) / 2 - minY * scale;

    const tx = (x: number) => x * scale + offX;
    const ty = (y: number) => y * scale + offY;

    // Links
    bonds.forEach((b) => {
      const s = nodePositions[b.sourceId];
      const t = nodePositions[b.targetId];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(tx(s.x), ty(s.y));
      ctx.lineTo(tx(t.x), ty(t.y));
      ctx.strokeStyle = hexRgba(BOND_COLORS[b.type], 0.15);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // Nodes
    users.forEach((u) => {
      const p = nodePositions[u.id];
      if (!p) return;
      const r = u.isLeader ? 3 : 2;
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage];
      ctx.fill();
    });

    // Viewport focus indicator (small, follows center)
    const vx = viewport.x || 0;
    const vy = viewport.y || 0;
    const vSize = 6;
    const vrx = tx(vx) - vSize / 2;
    const vry = ty(vy) - vSize / 2;

    ctx.strokeStyle = 'rgba(52,211,153,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vrx, vry, vSize, vSize);
    ctx.fillStyle = 'rgba(52,211,153,0.15)';
    ctx.fillRect(vrx, vry, vSize, vSize);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
  }, [users, bonds, nodePositions, viewport, width, height]);

  // Real-time updates
  useEffect(() => {
    let raf: number;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !nodePositions || Object.keys(nodePositions).length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const xs = Object.values(nodePositions).map((p) => p.x);
    const ys = Object.values(nodePositions).map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const scaleX = (size - pad * 2) / spanX;
    const scaleY = (size - pad * 2) / spanY;
    const scale = Math.min(scaleX, scaleY);
    const offX = pad + (size - pad * 2 - spanX * scale) / 2 - minX * scale;
    const offY = pad + (size - pad * 2 - spanY * scale) / 2 - minY * scale;

    const worldX = (mx - offX) / scale;
    const worldY = (my - offY) / scale;
    onViewportClick(worldX, worldY);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 rounded-lg overflow-hidden shadow-xl border border-white/10">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="cursor-pointer"
        onClick={handleClick}
      />
    </div>
  );
}

function hexRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
