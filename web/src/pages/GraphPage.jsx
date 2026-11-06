import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

// ─── Layout constants ────────────────────────────────────────────────────────

const ROW_SPACING = 200; // Vertical space between generations
const SLOT_W = 160;      // Horizontal space between nodes in a generation (Wider for better curves)
const SIDE_PAD = 100;    // Left/Right padding
const TOP_PAD = 100;     // Top/Bottom padding

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function trunc(s, max = 14) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function radiusFor(dist, isFocus) {
  if (isFocus) return 38;
  if (dist <= 1) return 28;
  if (dist === 2) return 22;
  return 20;
}

// ─── Graph traversal ──────────────────────────────────────────────────────────

function buildChildMap(members) {
  const map = new Map();
  for (const m of members) {
    for (const pid of [m.fatherId, m.motherId]) {
      if (pid == null) continue;
      if (!map.has(pid)) map.set(pid, new Set());
      map.get(pid).add(m.mid);
    }
  }
  return map;
}

function computeGenerations(members, focusMid) {
  const byMid = new Map(members.map((m) => [m.mid, m]));
  const childMap = buildChildMap(members);
  const gen = new Map([[focusMid, 0]]);
  const q = [focusMid];

  while (q.length) {
    const cur = q.shift();
    const m = byMid.get(cur);
    if (!m) continue;
    const g = gen.get(cur);

    for (const pid of [m.fatherId, m.motherId]) {
      if (pid != null && byMid.has(pid) && !gen.has(pid)) {
        gen.set(pid, g - 1);
        q.push(pid);
      }
    }
    for (const cid of childMap.get(cur) ?? []) {
      if (byMid.has(cid) && !gen.has(cid)) {
        gen.set(cid, g + 1);
        q.push(cid);
      }
    }
    if (m.spouseId != null && byMid.has(m.spouseId) && !gen.has(m.spouseId)) {
      gen.set(m.spouseId, g);
      q.push(m.spouseId);
    }
  }

  for (const m of members) {
    if (!gen.has(m.mid)) gen.set(m.mid, 0);
  }
  return gen;
}

function computeBfsDist(members, focusMid) {
  const byMid = new Map(members.map((m) => [m.mid, m]));
  const childMap = buildChildMap(members);
  const dist = new Map([[focusMid, 0]]);
  const q = [focusMid];

  while (q.length) {
    const cur = q.shift();
    const m = byMid.get(cur);
    if (!m) continue;
    const d = dist.get(cur);

    const neighbors = [
      m.fatherId,
      m.motherId,
      m.spouseId,
      ...(childMap.get(cur) ?? []),
    ].filter((id) => id != null && byMid.has(id) && !dist.has(id));

    for (const nid of neighbors) {
      dist.set(nid, d + 1);
      q.push(nid);
    }
  }

  for (const m of members) {
    if (!dist.has(m.mid)) dist.set(m.mid, 99);
  }
  return dist;
}

function computePcReachable(members, focusMid) {
  const byMid = new Map(members.map((m) => [m.mid, m]));
  const childMap = buildChildMap(members);

  // Build a fast bidirectional map of all spouses in the tree
  const spouseMap = new Map();
  for (const m of members) {
    if (m.spouseId != null) {
      if (!spouseMap.has(m.spouseId)) spouseMap.set(m.spouseId, new Set());
      spouseMap.get(m.spouseId).add(m.mid);
      if (!spouseMap.has(m.mid)) spouseMap.set(m.mid, new Set());
      spouseMap.get(m.mid).add(m.spouseId);
    }
  }

  // Identify the spouses of the focus person
  const focusSpouses = spouseMap.get(focusMid) ?? new Set();

  const visible = new Set([focusMid]);
  const q = [focusMid];

  while (q.length) {
    const cur = q.shift();
    const m = byMid.get(cur);
    if (!m) continue;

    const isFocusSpouse = focusSpouses.has(cur);

    // 1. Traverse UP (Parents)
    // THE FIX: If 'cur' is the focus person's spouse, BLOCK upward traversal. 
    // This perfectly chops off their parents and siblings, hiding the in-law tree!
    if (!isFocusSpouse) {
      for (const pid of [m.fatherId, m.motherId]) {
        if (pid != null && byMid.has(pid) && !visible.has(pid)) {
          visible.add(pid); 
          q.push(pid);
        }
      }
    }

    // 2. Traverse DOWN (Children)
    for (const cid of childMap.get(cur) ?? []) {
      if (byMid.has(cid) && !visible.has(cid)) {
        visible.add(cid); 
        q.push(cid);
      }
    }

    // 3. Traverse ACROSS (Spouses)
    for (const spId of spouseMap.get(cur) ?? []) {
      if (byMid.has(spId) && !visible.has(spId)) {
        visible.add(spId); 
        q.push(spId);
      }
    }
  }

  return visible;
}

// ─── Hierarchical Cluster Layout Engine ───────────────────────────────────────

function computeLayout(members, focusMid, distMap) {
  if (!members?.length) return { nodes: [], edges: [], svgW: 400, svgH: 200 };

  const byMid = new Map(members.map((m) => [m.mid, m]));
  const genMap = computeGenerations(members, focusMid);

  // Group by Generation (Rows)
  const rowMap = new Map();
  for (const m of members) {
    const g = genMap.get(m.mid);
    if (!rowMap.has(g)) rowMap.set(g, []);
    rowMap.get(g).push(m);
  }

  // Sort nodes horizontally within their row
  for (const [g, row] of rowMap) {
    row.sort((a, b) => {
      // 1. Group by parents first so siblings are forced to stay together
      const pA = `${a.fatherId || 'none'}-${a.motherId || 'none'}`;
      const pB = `${b.fatherId || 'none'}-${b.motherId || 'none'}`;
      if (pA !== pB) return pA.localeCompare(pB);
      // 2. Sort by ID as a stable fallback
      return a.mid - b.mid;
    });

    const ordered = [];
    const used = new Set();
    for (const m of row) {
      if (used.has(m.mid)) continue;
      ordered.push(m);
      used.add(m.mid);
      
      // Keep spouses adjacent horizontally
      if (m.spouseId != null && byMid.has(m.spouseId)) {
        const sp = byMid.get(m.spouseId);
        if (genMap.get(sp.mid) === g && !used.has(sp.mid)) {
          ordered.push(sp);
          used.add(sp.mid);
        }
      }
    }
    rowMap.set(g, ordered);
  }

  const genVals = [...rowMap.keys()].sort((a, b) => a - b);
  const minGen = genVals[0];
  const maxGen = genVals[genVals.length - 1];

  const posMap = new Map();
  const getY = (g) => TOP_PAD + (g - minGen) * ROW_SPACING;
  const svgH = Math.max((genVals.length - 1) * ROW_SPACING + 2 * TOP_PAD, 600);

  // Helper to find the average X coordinate of given relatives
  const getAvgX = (mids) => {
    let sum = 0; let count = 0;
    for (const id of mids) {
      if (id != null && posMap.has(id)) {
        sum += posMap.get(id).x;
        count++;
      }
    }
    return count > 0 ? sum / count : null; 
  };

  // The core clustering algorithm: centers children under parents, preventing overlap
  const sortAndAssignX = (row, g) => {
    if (!row || row.length === 0) return;

    // 1. Group spouses into tightly bound blocks
    const blocks = [];
    const used = new Set();
    for (const m of row) {
      if (used.has(m.mid)) continue;
      used.add(m.mid);
      const block = [m];
      
      if (m.spouseId != null) {
        const sp = row.find(r => r.mid === m.spouseId);
        if (sp && !used.has(sp.mid)) {
          block.push(sp);
          used.add(sp.mid);
        }
      }

      // If one spouse has parents and the other doesn't, the one with parents dictates the position
      const validIdeals = block.map(b => b.idealX).filter(x => x !== null && x !== undefined);
      let blockIdealX = validIdeals.length > 0 
        ? validIdeals.reduce((a, b) => a + b, 0) / validIdeals.length 
        : 999999; // Fallback for disconnected nodes
      
      blocks.push({ block, blockIdealX });
    }

    // Sort blocks horizontally based on their calculated center point
    blocks.sort((a, b) => a.blockIdealX - b.blockIdealX || a.block[0].mid - b.block[0].mid);

    // Re-flatten the row
    let idx = 0;
    for (const { block, blockIdealX } of blocks) {
      for (const m of block) {
        m.idealX = blockIdealX; // Force spouses to share the exact same ideal anchor
        row[idx++] = m;
      }
    }

    // 2. Cluster layout (Groups of siblings)
    const clusters = [];
    let currentCluster = [row[0]];
    for (let i = 1; i < row.length; i++) {
      if (Math.abs(row[i].idealX - row[i-1].idealX) < 10) {
        currentCluster.push(row[i]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [row[i]];
      }
    }
    clusters.push(currentCluster);

    // Center each cluster around its parent's X coordinate
    for (const cluster of clusters) {
      const avgX = cluster[0].idealX !== 999999 ? cluster[0].idealX : 0;
      const startX = avgX - ((cluster.length - 1) * SLOT_W) / 2;
      cluster.forEach((m, i) => m.x = startX + i * SLOT_W);
    }

    // 3. Resolve Overlaps (Left-to-Right Sweep)
    for (let i = 1; i < row.length; i++) {
      if (row[i].x < row[i-1].x + SLOT_W) {
        row[i].x = row[i-1].x + SLOT_W;
      }
    }
    const xLR = row.map(m => m.x);

    // Reset clusters to their ideal positions for the reverse sweep
    for (const cluster of clusters) {
      const avgX = cluster[0].idealX !== 999999 ? cluster[0].idealX : 0;
      const startX = avgX - ((cluster.length - 1) * SLOT_W) / 2;
      cluster.forEach((m, i) => m.x = startX + i * SLOT_W);
    }

    // 4. Resolve Overlaps (Right-to-Left Sweep)
    for (let i = row.length - 2; i >= 0; i--) {
      if (row[i].x > row[i+1].x - SLOT_W) {
        row[i].x = row[i+1].x - SLOT_W;
      }
    }
    const xRL = row.map(m => m.x);

    // 5. Average the two sweeps and commit coordinates to posMap
    row.forEach((m, i) => {
      m.x = (xLR[i] + xRL[i]) / 2;
      posMap.set(m.mid, { x: m.x, y: getY(g) });
    });
  };

  // --- Execute Top-Down Layout Processing ---

  // 1. Anchor the oldest generation (Roots of the tree)
  const minGenRow = rowMap.get(minGen) || [];
  minGenRow.forEach((m, i) => m.idealX = i * SLOT_W); 
  sortAndAssignX(minGenRow, minGen);

  // 2. Cascade down to descendants. Children center naturally under their parents.
  for (let g = minGen + 1; g <= maxGen; g++) {
    const row = rowMap.get(g) || [];
    row.forEach(m => m.idealX = getAvgX([m.fatherId, m.motherId]));
    sortAndAssignX(row, g);
  }

  // Normalize all X coordinates so there are no negative values (fits viewport perfectly)
  let minX = Infinity, maxX = -Infinity;
  for (const pos of posMap.values()) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
  }
  const xOffset = SIDE_PAD - minX;
  for (const pos of posMap.values()) pos.x += xOffset;
  const svgW = Math.max(maxX + xOffset + SIDE_PAD, 600);

  // Compile final Nodes and Edges arrays
  const nodes = members.map((m) => {
    const { x, y } = posMap.get(m.mid) ?? { x: svgW / 2, y: svgH / 2 };
    const d = distMap.get(m.mid) ?? 99;
    const isFocus = m.mid === focusMid;
    return {
      ...m, x, y, r: radiusFor(d, isFocus), isFocus, gen: genMap.get(m.mid) ?? 0, dist: d,
    };
  });

  const nodeByMid = new Map(nodes.map((n) => [n.mid, n]));
  const edges = [];

  // Spouse edges (Horizontal dashed lines)
  const spouseSeen = new Set();
  for (const n of nodes) {
    if (!n.spouseId || !nodeByMid.has(n.spouseId)) continue;
    const key = Math.min(n.mid, n.spouseId) + '-' + Math.max(n.mid, n.spouseId);
    if (spouseSeen.has(key)) continue;
    spouseSeen.add(key);
    const s = nodeByMid.get(n.spouseId);
    const [L, R] = n.x <= s.x ? [n, s] : [s, n]; 
    edges.push({ id: `sp-${key}`, kind: 'spouse', x1: L.x + L.r, y1: L.y, x2: R.x - R.r, y2: R.y });
  }

  // Parent-child tree edges (Vertical Bezier curves)
  const pGroups = new Map();
  for (const n of nodes) {
    const vFid = n.fatherId != null && nodeByMid.has(n.fatherId) ? n.fatherId : null;
    const vMid = n.motherId != null && nodeByMid.has(n.motherId) ? n.motherId : null;
    if (vFid == null && vMid == null) continue;
    const key = `${vFid ?? 'x'}-${vMid ?? 'x'}`;
    if (!pGroups.has(key)) pGroups.set(key, { vFid, vMid, kids: [] });
    pGroups.get(key).kids.push(n.mid);
  }

  for (const { vFid, vMid, kids } of pGroups.values()) {
    const kidNodes = kids.map((id) => nodeByMid.get(id));

    let px, py, pR;
    if (vFid != null && vMid != null) {
      const fn = nodeByMid.get(vFid);
      const mn = nodeByMid.get(vMid);
      px = (fn.x + mn.x) / 2; // Curve originates horizontally between the two parents
      py = Math.max(fn.y, mn.y); 
      pR = Math.max(fn.r, mn.r);
    } else {
      const pn = nodeByMid.get(vFid ?? vMid);
      px = pn.x;
      py = pn.y;
      pR = pn.r;
    }

    const startY = py + pR;

    for (const kn of kidNodes) {
      edges.push({
        id: `pc-${vFid ?? 'x'}-${vMid ?? 'x'}-${kn.mid}`,
        kind: 'pc', startX: px, startY, endX: kn.x, endY: kn.y - kn.r 
      });
    }
  }

  return { nodes, edges, svgW, svgH };
}

// ─── Animated SVG sub-components ──────────────────────────────────────────────

function Edges({ edges }) {
  return (
    <g>
      {edges.map((e) => {
        if (e.kind === 'spouse') {
          return (
            <line
              key={e.id}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              className="parivar-graph-edge"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              style={{ transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }}
            />
          );
        }
        if (e.kind === 'pc') {
          // Calculate control points for a beautiful sweeping vertical Cubic Bezier curve
          const cpY = e.startY + (e.endY - e.startY) / 2;
          const d = `M ${e.startX} ${e.startY} C ${e.startX} ${cpY}, ${e.endX} ${cpY}, ${e.endX} ${e.endY}`;
          
          return (
            <path
              key={e.id}
              d={d}
              className="parivar-graph-edge"
              strokeWidth={1.5}
              fill="none"
              style={{ transition: 'd 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }}
            />
          );
        }
        return null;
      })}
    </g>
  );
}

function Nodes({ nodes, toggleExpand, navigate }) {
  return (
    <g>
      {nodes.map((n) => {
        const fillColor = n.isDeceased ? 'var(--parivar-deceased-bg)' : 'var(--parivar-accent-bg)';
        const textColor = n.isDeceased ? 'var(--parivar-deceased)' : 'var(--parivar-accent-text)';
        const strokeColor = n.isFocus
          ? 'var(--parivar-accent)'
          : n.isDeceased
          ? 'var(--parivar-deceased)'
          : 'var(--bs-border-color)';

        return (
          <g
            key={n.mid}
            onClick={() => toggleExpand(n.mid)}
            onDoubleClick={(e) => { e.stopPropagation(); navigate(`/${n.mid}`); }}
            style={{ 
              cursor: 'pointer',
              transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s',
              transform: `translate(${n.x}px, ${n.y}px)` // Nodes glide to new positions!
            }}
            opacity={n.isDeceased ? 0.45 : 1}
          >
            <title>Click to expand/collapse. Double-click to view profile.</title>
            <rect
              x={-n.r - 8} y={-n.r - 8}
              width={n.r * 2 + 16} height={n.r * 2 + 44}
              fill="transparent" stroke="none"
            />
            {n.isFocus && (
              <circle
                cx={0} cy={0} r={n.r + 8}
                fill="none"
                stroke="var(--parivar-accent)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.6}
              />
            )}
            <circle
              cx={0} cy={0} r={n.r}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={n.isFocus ? 3 : 1.5}
            />
            <text
              x={0} y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.round(n.r * 0.5)}
              fontWeight="500"
              fill={textColor}
              style={{ userSelect: 'none' }}
            >
              {initialsOf(n.name)}
            </text>
            <text
              x={0} y={n.r + 14}
              textAnchor="middle"
              fontSize={11}
              fill="var(--bs-body-color)"
              style={{ userSelect: 'none' }}
            >
              {trunc(n.name, 14)}
            </text>
            {n.location && (
              <text
                x={0} y={n.r + 27}
                textAnchor="middle"
                fontSize={9}
                fill="var(--bs-secondary-color)"
                style={{ userSelect: 'none' }}
              >
                {trunc(n.location, 14)}
              </text>
            )}
            {n.isDeceased && (
              <text
                x={n.r - 2} y={-n.r + 11}
                textAnchor="middle"
                fontSize={9}
                fill="var(--parivar-deceased)"
                style={{ userSelect: 'none' }}
              >
                ✦
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export function GraphPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { member } = useAuth();
  const fid = member.fid;

  const focusMid = Number(searchParams.get('focus') ?? member.mid);

  const [degrees, setDegrees] = useState(2); 
  const [expandedNodes, setExpandedNodes] = useState(new Set()); 

  const [hideDeceased, setHideDeceased] = useState(false);
  const [hideInLaws, setHideInLaws] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [maxDegrees, setMaxDegrees] = useState(10);
  const [savedDegrees, setSavedDegrees] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const layoutCenteredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAllMembers([]);
    layoutCenteredRef.current = false;

    api.listMembers(fid, { limit: 1000 })
      .then((res) => {
        if (!cancelled) setAllMembers(res.members ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load tree');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fid]);

  useEffect(() => {
    if (!allMembers.length) return;
    const dist = computeBfsDist(allMembers, focusMid);
    const vals = [...dist.values()].filter((v) => v < 99);
    const max = vals.length ? Math.max(...vals) : 5;
    setMaxDegrees(max);
    layoutCenteredRef.current = false;
  }, [allMembers, focusMid]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const z = d3Zoom()
      .filter((e) => !e.button && e.type !== 'dblclick')
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        select(gRef.current).attr('transform', event.transform.toString());
      });

    zoomRef.current = z;
    select(svgEl).call(z);

    return () => { select(svgEl).on('.zoom', null); };
  }, []);

  const toggleExpand = (mid) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid);
      else next.add(mid);
      return next;
    });
  };

  const { filteredMembers, distMap } = useMemo(() => {
    if (!allMembers.length) return { filteredMembers: [], distMap: new Map() };

    const byMid = new Map(allMembers.map((m) => [m.mid, m]));
    const childMap = buildChildMap(allMembers);

    const visible = new Set([focusMid]);
    const queue = [{ mid: focusMid, d: 0 }];
    const dMap = new Map([[focusMid, 0]]);

    while (queue.length) {
      const { mid: cur, d } = queue.shift();
      const m = byMid.get(cur);
      if (!m) continue;

      if (d < degrees || expandedNodes.has(cur)) {
        const neighbors = [
          m.fatherId,
          m.motherId,
          m.spouseId,
          ...(childMap.get(cur) ?? [])
        ].filter(id => id != null && byMid.has(id));

        for (const nMid of neighbors) {
          if (!visible.has(nMid)) {
            visible.add(nMid);
            dMap.set(nMid, d + 1);
            queue.push({ mid: nMid, d: d + 1 });
          }
        }
      }
    }

    let res = allMembers.filter((m) => visible.has(m.mid));
    if (hideDeceased) res = res.filter((m) => !m.isDeceased);
    if (hideInLaws) {
      const pcSet = computePcReachable(res, focusMid);
      res = res.filter((m) => pcSet.has(m.mid));
    }

    return { filteredMembers: res, distMap: dMap };
  }, [allMembers, focusMid, degrees, expandedNodes, hideDeceased, hideInLaws]);

  const layout = useMemo(
    () => (filteredMembers.length > 0 ? computeLayout(filteredMembers, focusMid, distMap) : null),
    [filteredMembers, focusMid, distMap],
  );

  useEffect(() => {
    if (!layout || !svgRef.current || !zoomRef.current) return;
    if (layoutCenteredRef.current) return;
    const focusNode = layout.nodes.find((n) => n.isFocus);
    if (!focusNode) return;
    layoutCenteredRef.current = true;
    requestAnimationFrame(() => {
      const svgEl = svgRef.current;
      const z = zoomRef.current;
      if (!svgEl || !z) return;
      const cx = svgEl.clientWidth / 2;
      const cy = svgEl.clientHeight / 2;
      if (!cx || !cy) return;
      const t = zoomIdentity.translate(cx - focusNode.x, cy - focusNode.y);
      select(svgEl).call(z.transform, t);
    });
  }, [layout]);

  return (
    <div className="d-flex flex-column flex-grow-1 overflow-hidden">
      {/* Toolbar */}
      <div className="border-bottom" style={{ background: 'var(--bs-body-bg)', flexShrink: 0 }}>
        <style>{`.parivar-toolbar::-webkit-scrollbar { display: none; }`}</style>
        
        {/* We use px-3 to match the standard Bootstrap gutter, aligning it perfectly with navigation tabs */}
        <div className="container px-3" style={{ maxWidth: '760px' }}>
          <div
            className="d-flex align-items-center flex-nowrap py-2 parivar-toolbar"
            style={{ 
              gap: '12px', 
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <span className="small text-body-secondary mb-0">Degrees</span>
              <div className="btn-group btn-group-sm shadow-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-2"
                  onClick={() => {
                    const newDeg = Math.max(1, degrees - 1);
                    setDegrees(newDeg);
                    setSavedDegrees(newDeg); // Remember manual change
                  }}
                  disabled={degrees <= 1}
                  aria-label="Decrease degrees"
                  style={{ touchAction: 'manipulation' }}
                >
                  −
                </button>
                <span
                  className="btn btn-outline-secondary pe-none px-3 fw-medium"
                  style={{
                    background: 'var(--parivar-accent-bg)',
                    color: 'var(--parivar-accent-text)',
                    borderColor: 'var(--bs-border-color)'
                  }}
                >
                  {Math.min(degrees, maxDegrees)}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary px-2"
                  onClick={() => {
                    const newDeg = Math.min(maxDegrees, degrees + 1);
                    setDegrees(newDeg);
                    if (newDeg < maxDegrees) setSavedDegrees(newDeg); // Remember manual change
                  }}
                  disabled={degrees >= maxDegrees}
                  aria-label="Increase degrees"
                  style={{ touchAction: 'manipulation' }}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`btn btn-sm flex-shrink-0 ${degrees === maxDegrees ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
              onClick={() => {
                if (degrees === maxDegrees) {
                  // Un-toggle: Restore previous view
                  setDegrees(Math.min(savedDegrees, maxDegrees));
                } else {
                  // Toggle ON: Save current and expand
                  setSavedDegrees(degrees);
                  setDegrees(maxDegrees);
                }
              }}
            >
              Show everyone
            </button>

            <button
              type="button"
              className={`btn btn-sm ${hideDeceased ? 'btn-secondary' : 'btn-outline-secondary'} flex-shrink-0`}
              onClick={() => setHideDeceased((v) => !v)}
            >
              {hideDeceased ? 'Show deceased' : 'Hide deceased'}
            </button>

            <button
              type="button"
              className={`btn btn-sm ${hideInLaws ? 'btn-secondary' : 'btn-outline-secondary'} flex-shrink-0`}
              onClick={() => setHideInLaws((v) => !v)}
            >
              {hideInLaws ? 'Show in-laws' : 'Hide in-laws'}
            </button>

            {!loading && layout && (
              <span 
                className="ms-auto small text-body-secondary text-end flex-shrink-0"
                style={{ lineHeight: '1.2' }}
              >
                Click nodes to expand.<br />Double-click for profile.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-grow-1 position-relative overflow-hidden">
        {loading && (
          <div
            className="text-body-secondary small position-absolute top-50 start-50 translate-middle"
            style={{ zIndex: 5 }}
          >
            Loading family…
          </div>
        )}

        {!loading && error && (
          <div
            className="position-absolute top-50 start-50 translate-middle"
            style={{
              zIndex: 5,
              background: 'var(--bs-body-bg)',
              border: '1px solid var(--bs-border-color)',
              borderRadius: 8,
              padding: 20,
              maxWidth: 320,
            }}
          >
            <div className="fw-medium mb-1">Couldn't load family</div>
            <div className="small text-body-secondary">{error}</div>
            <div className="small text-body-secondary mt-1">Is the API server running on port 4000?</div>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', background: 'var(--bs-body-bg)' }}
          role="img"
          aria-label="Family tree graph"
        >
          <g ref={gRef}>
            {layout && (
              <>
                {/* Edges render underneath nodes */}
                <Edges edges={layout.edges} />
                <Nodes nodes={layout.nodes} toggleExpand={toggleExpand} navigate={navigate} />
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}