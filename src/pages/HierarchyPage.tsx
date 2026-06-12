import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { users, bonds } from '@/data/mockData';
import { STAGE_NAMES, STAGE_COLORS, BOND_COLORS, BOND_LABELS } from '@/types';
import { GitFork, ChevronDown, ChevronUp } from 'lucide-react';

const CURRENT_USER_ID = 'u4';

interface TreeNode {
  user: typeof users[0];
  bond: typeof bonds[0];
  typeLabel: string;
}

export default function HierarchyPage() {
  const currentUser = users.find((u) => u.id === CURRENT_USER_ID)!;
  const [othersExpanded, setOthersExpanded] = useState(false);

  const { outgoing, incoming, allUsers } = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.id, u]));
    const out: TreeNode[] = bonds
      .filter((b) => b.sourceId === CURRENT_USER_ID)
      .map((b) => ({ user: userMap.get(b.targetId)!, bond: b, typeLabel: BOND_LABELS[b.type] }))
      .filter((n) => n.user);
    const inc: TreeNode[] = bonds
      .filter((b) => b.targetId === CURRENT_USER_ID && b.sourceId !== CURRENT_USER_ID)
      .map((b) => ({ user: userMap.get(b.sourceId)!, bond: b, typeLabel: BOND_LABELS[b.type] }))
      .filter((n) => n.user);
    const all = users
      .filter((u) => u.id !== CURRENT_USER_ID && !u.isOrphan)
      .map((u) => ({
        user: u,
        outBonds: bonds.filter((b) => b.sourceId === u.id),
        inBonds: bonds.filter((b) => b.targetId === u.id),
      }))
      .sort((a, b) => (b.outBonds.length + b.inBonds.length) - (a.outBonds.length + a.inBonds.length));
    return { outgoing: out, incoming: inc, allUsers: all };
  }, []);

  const nodeH = 44;
  const gapY = 12;
  const maxSide = Math.max(outgoing.length, incoming.length, 1);

  // Compact layout: all nodes start near top
  const topPad = 40;
  const meY = topPad + (maxSide - 1) * (nodeH + gapY) / 2;
  const leftX = 10;
  const trunkX = 350;
  const rightX = 690;
  const svgW = 740;
  // Height: from top to last node + small padding
  const svgH = topPad + (maxSide - 1) * (nodeH + gapY) + nodeH + 10;

  const makePath = (sx: number, sy: number, ex: number, ey: number, color: string) => (
    <path d={`M ${sx} ${sy} C ${(sx + ex) / 2} ${sy}, ${(sx + ex) / 2} ${ey}, ${ex} ${ey}`}
      fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
  );

  return (
    <Layout>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <GitFork className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-gray-100">Дерево опоры</p>
              <p className="text-[10px] text-gray-500">{outgoing.length} отдаю &middot; {incoming.length} получаю</p>
            </div>
          </div>

          {/* TREE SVG — compact */}
          <div className="rounded-xl border border-white/5 bg-[#080c18] overflow-hidden">
            <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="block">
              <defs>
                <pattern id="tgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.03)" />
                </pattern>
              </defs>
              <rect width={svgW} height={svgH} fill="url(#tgrid)" />

              {/* Labels */}
              <text x={leftX + 90} y={topPad - 12} textAnchor="middle" fill="#22d3ee" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif" opacity={0.6}>ПОЛУЧАЮ</text>
              <text x={rightX - 90} y={topPad - 12} textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif" opacity={0.6}>ОТДАЮ</text>

              {/* LEFT BRANCHES */}
              {incoming.map((inc, i) => {
                const y = topPad + i * (nodeH + gapY);
                return (
                  <g key={`inc-${inc.user.id}`}>
                    {makePath(leftX + 180, y + nodeH / 2, trunkX - 40, meY + nodeH / 2, BOND_COLORS[inc.bond.type])}
                    <polygon points={`${trunkX - 40},${meY + nodeH / 2 - 3} ${trunkX - 34},${meY + nodeH / 2} ${trunkX - 40},${meY + nodeH / 2 + 3}`}
                      fill={BOND_COLORS[inc.bond.type]} fillOpacity={0.4} />
                  </g>
                );
              })}

              {/* RIGHT BRANCHES */}
              {outgoing.map((out, i) => {
                const y = topPad + i * (nodeH + gapY);
                return (
                  <g key={`out-${out.user.id}`}>
                    {makePath(trunkX + 40, meY + nodeH / 2, rightX - 180, y + nodeH / 2, BOND_COLORS[out.bond.type])}
                    <polygon points={`${rightX - 180},${y + nodeH / 2 - 3} ${rightX - 174},${y + nodeH / 2} ${rightX - 180},${y + nodeH / 2 + 3}`}
                      fill={BOND_COLORS[out.bond.type]} fillOpacity={0.4} />
                  </g>
                );
              })}

              {/* LEFT NODES */}
              {incoming.map((inc, i) => {
                const y = topPad + i * (nodeH + gapY);
                return (
                  <g key={`lnode-${inc.user.id}`}>
                    <rect x={leftX} y={y} width="180" height={nodeH} rx="8" fill="#0c1222" stroke={BOND_COLORS[inc.bond.type] + '25'} strokeWidth={1} />
                    <clipPath id={`clip-l-${inc.user.id}`}><circle cx={leftX + 22} cy={y + nodeH / 2} r="12" /></clipPath>
                    <image href={inc.user.avatar} x={leftX + 10} y={y + nodeH / 2 - 12} width="24" height="24" clipPath={`url(#clip-l-${inc.user.id})`} />
                    <text x={leftX + 42} y={y + nodeH / 2 - 4} fill="#e5e7eb" fontSize="10" fontFamily="Inter, sans-serif">{inc.user.name}</text>
                    <text x={leftX + 42} y={y + nodeH / 2 + 10} fill={BOND_COLORS[inc.bond.type]} fontSize="8" fontFamily="Inter, sans-serif">{inc.typeLabel} x{inc.bond.strength}</text>
                  </g>
                );
              })}

              {/* CENTER NODE */}
              <g>
                <rect x={trunkX - 40} y={meY} width="80" height={nodeH} rx="10" fill="#0c1222" stroke="#fbbf2450" strokeWidth={1.5} />
                <clipPath id="clip-me"><circle cx={trunkX} cy={meY + nodeH / 2} r="14" /></clipPath>
                <image href={currentUser.avatar} x={trunkX - 14} y={meY + nodeH / 2 - 14} width="28" height="28" clipPath="url(#clip-me)" />
                <text x={trunkX} y={meY - 8} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">Я</text>
              </g>

              {/* RIGHT NODES */}
              {outgoing.map((out, i) => {
                const y = topPad + i * (nodeH + gapY);
                return (
                  <g key={`rnode-${out.user.id}`}>
                    <rect x={rightX - 180} y={y} width="180" height={nodeH} rx="8" fill="#0c1222" stroke={BOND_COLORS[out.bond.type] + '25'} strokeWidth={1} />
                    <clipPath id={`clip-r-${out.user.id}`}><circle cx={rightX - 158} cy={y + nodeH / 2} r="12" /></clipPath>
                    <image href={out.user.avatar} x={rightX - 170} y={y + nodeH / 2 - 12} width="24" height="24" clipPath={`url(#clip-r-${out.user.id})`} />
                    <text x={rightX - 148} y={y + nodeH / 2 - 4} fill="#e5e7eb" fontSize="10" fontFamily="Inter, sans-serif">{out.user.name}</text>
                    <text x={rightX - 148} y={y + nodeH / 2 + 10} fill={BOND_COLORS[out.bond.type]} fontSize="8" fontFamily="Inter, sans-serif">{out.typeLabel} x{out.bond.strength}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Others */}
          <button
            onClick={() => setOthersExpanded(!othersExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors mt-4">
            <span className="text-[10px] text-gray-500">Остальные {allUsers.length} участников</span>
            {othersExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {othersExpanded && (
            <div className="space-y-2 pb-6 pt-2">
              {allUsers.map((item) => {
                const u = item.user;
                return (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <img src={u.avatar} alt="" className="w-8 h-8 rounded-full border flex-shrink-0" style={{ borderColor: u.isLeader ? '#fbbf24' : STAGE_COLORS[u.stage] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-200">{u.name}</span>
                        <span className="text-[9px] text-gray-600">{STAGE_NAMES[u.stage]}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                        <span>{item.inBonds.length} входящих</span>
                        <span className="text-gray-700">&middot;</span>
                        <span>{item.outBonds.length} исходящих</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 flex-shrink-0">B {u.vklad}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
