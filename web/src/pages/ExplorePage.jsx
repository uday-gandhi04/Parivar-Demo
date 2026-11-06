import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { IconMenu2 } from '@tabler/icons-react';
import { forceSimulation, forceLink, forceManyBody, forceCollide } from 'd3-force';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
import { select } from 'd3-selection';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { getRelationPath } from '../lib/relations.js';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function lcg(seed) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

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
  if (isFocus) return 32;
  if (dist <= 1) return 22;
  if (dist === 2) return 18;
  if (dist === 3) return 14;
  return 12;
}

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
      m.fatherId, m.motherId, m.spouseId, ...(childMap.get(cur) ?? []),
    ].filter((id) => id != null && byMid.has(id) && !dist.has(id));
    for (const nid of neighbors) { dist.set(nid, d + 1); q.push(nid); }
  }

  for (const m of members) {
    if (!dist.has(m.mid)) dist.set(m.mid, 999);
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ExplorePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { member } = useAuth();
  const fid = member.fid;

  const focusMid = Number(searchParams.get('focus') ?? member.mid);

  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bfsDist, setBfsDist] = useState(new Map());
  const [maxDegrees, setMaxDegrees] = useState(10);
  const [degrees, setDegrees] = useState(null);
  const [savedDegrees, setSavedDegrees] = useState(10);
  const [hideDeceased, setHideDeceased] = useState(false);
  const [hideInLaws, setHideInLaws] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Search & Kinship State
  const [searchX, setSearchX] = useState('');
  const [searchY, setSearchY] = useState('');
  const [kinshipX, setKinshipX] = useState(null);
  const [kinshipY, setKinshipY] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [shortestPath, setShortestPath] = useState([]);
  const [kinshipText, setKinshipText] = useState(null);

  const svgRef = useRef(null);
  const gRef = useRef(null);
  const gEdgesRef = useRef(null);
  const gNodesRef = useRef(null);
  const simRef = useRef(null);
  const zoomRef = useRef(null);
  const neighborMapRef = useRef(new Map());
  const shortestPathRef = useRef([]); 
  
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const focusMidRef = useRef(focusMid);
  focusMidRef.current = focusMid;

  // Fetch all members once per fid
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAllMembers([]);
    setBfsDist(new Map());
    setDegrees(null);

    api.listMembers(fid, { limit: 1000 })
      .then((res) => { if (!cancelled) setAllMembers(res.members); })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [fid]);

  // Recompute BFS when members or focus changes
  useEffect(() => {
    if (!allMembers.length) return;
    const dist = computeBfsDist(allMembers, focusMid);
    const vals = [...dist.values()].filter((v) => v < 999);
    const max = vals.length ? Math.max(...vals) : 5;
    setBfsDist(dist);
    setMaxDegrees(max);
    setSavedDegrees(max);
    setDegrees(max);
  }, [allMembers, focusMid]);

  // Setup zoom once on mount
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const z = d3Zoom()
      .filter((e) => !e.button && e.type !== 'dblclick')
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        select(gRef.current).attr('transform', event.transform.toString());
      });

    zoomRef.current = z;
    select(svgEl).call(z);

    const cx = svgEl.clientWidth / 2;
    const cy = svgEl.clientHeight / 2;
    select(svgEl).call(z.transform, zoomIdentity.translate(cx, cy));

    select(svgEl).on('click.canvas', (event) => {
      if (event.target === svgEl || event.target === gRef.current
          || event.target === gEdgesRef.current || event.target === gNodesRef.current) {
        setKinshipX(null);
        setKinshipY(null);
        setSearchX('');
        setSearchY('');
        select(gNodesRef.current).selectAll('g.enode').attr('opacity', (d) => d.isDeceased ? 0.5 : 1);
        select(gEdgesRef.current).selectAll('path.eedge').attr('opacity', 0.55);
      }
    });

    return () => { select(svgEl).on('.zoom', null).on('click.canvas', null); };
  }, []);

  // Re-center when focus changes
  useEffect(() => {
    const svgEl = svgRef.current;
    const z = zoomRef.current;
    if (!svgEl || !z) return;
    const cx = svgEl.clientWidth / 2;
    const cy = svgEl.clientHeight / 2;
    select(svgEl).transition().duration(600).call(z.transform, zoomIdentity.translate(cx, cy));
  }, [focusMid]);

  // Filtered members (enriched with r, isFocus)
  const filteredMembers = useMemo(() => {
    if (!allMembers.length || !bfsDist.size) return [];
    const eff = degrees ?? maxDegrees;
    
    const pathSet = new Set(shortestPath);

    let visible = allMembers.filter((m) => (bfsDist.get(m.mid) ?? 999) <= eff || pathSet.has(m.mid));
    
    if (hideDeceased) {
      visible = visible.filter((m) => !m.isDeceased || pathSet.has(m.mid));
    }
    
    if (hideInLaws) {
      const pcSet = computePcReachable(visible, focusMid);
      visible = visible.filter((m) => pcSet.has(m.mid) || pathSet.has(m.mid));
    }

    return visible.map((m) => ({
      ...m,
      r: radiusFor(bfsDist.get(m.mid) ?? 99, m.mid === focusMid),
      isFocus: m.mid === focusMid,
    }));
  }, [allMembers, bfsDist, degrees, maxDegrees, hideDeceased, hideInLaws, focusMid, shortestPath]);

  const countAtDegrees = useMemo(() => {
    if (!allMembers.length || !bfsDist.size) return 0;
    const eff = degrees ?? maxDegrees;
    return allMembers.filter((m) => (bfsDist.get(m.mid) ?? 999) <= eff).length;
  }, [allMembers, bfsDist, degrees, maxDegrees]);

  // ── Kinship Pathfinding Logic ───────────────────────────────────────────────
  
  useEffect(() => {
    if (!kinshipX || !kinshipY) {
      setShortestPath([]);
      setKinshipText(null);
      shortestPathRef.current = [];
      return;
    }

    // 1. TEXT TRANSLATION
    const result = getRelationPath(kinshipX.mid, kinshipY.mid, allMembers);
    if (result) {
      setKinshipText(result.relation);
    } else {
      setKinshipText({ hi: 'Koi Rishta Nahi', en: 'No relationship path found in the current tree.' });
    }

    // 2. VISUAL PATH: Build strict literal graph for unbroken lines
    const adj = new Map();
    for (const m of allMembers) {
      if (!adj.has(m.mid)) adj.set(m.mid, new Set());
      if (m.fatherId) {
        if (!adj.has(m.fatherId)) adj.set(m.fatherId, new Set());
        adj.get(m.mid).add(m.fatherId);
        adj.get(m.fatherId).add(m.mid);
      }
      if (m.motherId) {
        if (!adj.has(m.motherId)) adj.set(m.motherId, new Set());
        adj.get(m.mid).add(m.motherId);
        adj.get(m.motherId).add(m.mid);
      }
      if (m.spouseId) {
        if (!adj.has(m.spouseId)) adj.set(m.spouseId, new Set());
        adj.get(m.mid).add(m.spouseId);
        adj.get(m.spouseId).add(m.mid);
      }
    }

    const q = [[kinshipX.mid]];
    const visited = new Set([kinshipX.mid]);
    let visualPath = [];
    
    while (q.length) {
      const p = q.shift();
      const cur = p[p.length - 1];
      if (cur === kinshipY.mid) {
        visualPath = p;
        break;
      }
      for (const nxt of (adj.get(cur) || [])) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          q.push([...p, nxt]);
        }
      }
    }

    setShortestPath(visualPath);
    shortestPathRef.current = visualPath;

  }, [kinshipX, kinshipY, allMembers]);

  // ── Force simulation (MUST BE ABOVE HIGHLIGHT EFFECT) ────────────────────────
  useEffect(() => {
    const gEdgesEl = gEdgesRef.current;
    const gNodesEl = gNodesRef.current;
    if (!filteredMembers.length || !gEdgesEl || !gNodesEl) return;

    const prevPos = new Map(
      (simRef.current?.nodes() ?? []).map((n) => [n.mid, { x: n.x, y: n.y }])
    );

    const rand = lcg(focusMid);
    const spread = Math.max(Math.sqrt(filteredMembers.length) * 22, 200);
    const rndMap = new Map();
    [...filteredMembers].sort((a, b) => a.mid - b.mid).forEach((m) => {
      rndMap.set(m.mid, { rx: (rand() - 0.5) * 2 * spread, ry: (rand() - 0.5) * 2 * spread });
    });

    const nodes = filteredMembers.map((m) => {
      const prev = prevPos.get(m.mid);
      const rnd = rndMap.get(m.mid) ?? { rx: 0, ry: 0 };
      return {
        ...m,
        x: m.isFocus ? 0 : (prev?.x ?? rnd.rx),
        y: m.isFocus ? 0 : (prev?.y ?? rnd.ry),
        fx: m.isFocus ? 0 : null,
        fy: m.isFocus ? 0 : null,
      };
    });

    const nodeSet = new Set(nodes.map((n) => n.mid));
    const links = [];
    const spouseSeen = new Set();

    for (const n of nodes) {
      if (n.fatherId != null && nodeSet.has(n.fatherId))
        links.push({ source: n.fatherId, target: n.mid, type: 'pc' });
      if (n.motherId != null && nodeSet.has(n.motherId))
        links.push({ source: n.motherId, target: n.mid, type: 'pc' });
      if (n.spouseId != null && nodeSet.has(n.spouseId)) {
        const key = Math.min(n.mid, n.spouseId) + '-' + Math.max(n.mid, n.spouseId);
        if (!spouseSeen.has(key)) {
          spouseSeen.add(key);
          links.push({ source: n.mid, target: n.spouseId, type: 'spouse' });
        }
      }
    }

    const neighborMap = new Map(nodes.map((n) => [n.mid, new Set()]));
    for (const l of links) {
      const sm = typeof l.source === 'object' ? l.source.mid : l.source;
      const tm = typeof l.target === 'object' ? l.target.mid : l.target;
      neighborMap.get(sm)?.add(tm);
      neighborMap.get(tm)?.add(sm);
    }
    neighborMapRef.current = neighborMap;

    simRef.current?.stop();

    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.mid)
        .distance((d) => d.type === 'spouse' ? 48 : 85)
        .strength((d) => d.type === 'spouse' ? 0.5 : 0.7))
      .force('charge', forceManyBody().strength(-280))
      .force('collide', forceCollide().radius((d) => d.r + 8));

    simRef.current = sim;

    // Clear and rebuild edges
    select(gEdgesEl).selectAll('*').remove();
    const edgeAll = select(gEdgesEl).selectAll('path.eedge')
      .data(links)
      .enter().append('path')
      .attr('class', 'eedge')
      .attr('fill', 'none')
      .attr('stroke', (d) => d.type === 'spouse' ? 'var(--parivar-accent)' : 'var(--bs-border-color)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) => d.type === 'spouse' ? '5 3' : null)
      .attr('opacity', 0.55);

    // Clear and rebuild nodes
    select(gNodesEl).selectAll('*').remove();
    const nodeAll = select(gNodesEl).selectAll('g.enode')
      .data(nodes, (d) => d.mid)
      .enter().append('g')
      .attr('class', 'enode')
      .attr('opacity', (d) => d.isDeceased ? 0.5 : 1)
      .style('cursor', 'pointer');

    nodeAll.filter((d) => d.isFocus).append('circle')
      .attr('r', (d) => d.r + 9)
      .attr('fill', 'none')
      .attr('stroke', 'var(--parivar-accent)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.55);

    // Hidden ring for the start of a Kinship Path (Person X)
    nodeAll.append('circle')
      .attr('class', 'kinship-start-ring')
      .attr('r', (d) => d.r + 9)
      .attr('fill', 'none')
      .attr('stroke', 'var(--parivar-accent)')
      .attr('stroke-width', 2) 
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0);

    nodeAll.append('circle')
      .attr('class', 'main-bubble')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => d.isDeceased ? 'var(--parivar-deceased-bg)' : 'var(--parivar-accent-bg)')
      .attr('stroke', (d) => d.isFocus ? 'var(--parivar-accent)' : 'var(--bs-border-color)')
      .attr('stroke-width', (d) => d.isFocus ? 3 : 1.5)
      .attr('filter', (d) => d.isFocus ? 'url(#parivar-glow)' : null);

    nodeAll.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d) => d.isDeceased ? 'var(--parivar-deceased)' : 'var(--parivar-accent-text)')
      .attr('font-size', (d) => Math.round(d.r * 0.5))
      .attr('font-weight', '500')
      .style('user-select', 'none').style('pointer-events', 'none')
      .text((d) => initialsOf(d.name));

    nodeAll.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.r + 14)
      .attr('font-size', 11)
      .attr('fill', 'var(--bs-body-color)')
      .style('user-select', 'none').style('pointer-events', 'none')
      .text((d) => trunc(d.name));

    nodeAll.filter((d) => d.isDeceased).append('text')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => d.r - 1)
      .attr('y', (d) => -d.r + 9)
      .attr('font-size', 9)
      .attr('fill', 'var(--parivar-deceased)')
      .style('user-select', 'none').style('pointer-events', 'none')
      .text('✦');

    const drag = d3Drag()
      .on('start', (event, d) => {
        event.sourceEvent.stopPropagation();
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        if (d.mid !== focusMidRef.current) { d.fx = null; d.fy = null; }
      });
    nodeAll.call(drag);

    nodeAll
      .on('mouseover.ex', (event, d) => {
        if (shortestPathRef.current.length > 0) return;
        const nb = neighborMapRef.current.get(d.mid) ?? new Set();
        nodeAll.attr('opacity', (nd) =>
          nd.mid === d.mid || nb.has(nd.mid) ? (nd.isDeceased ? 0.5 : 1) : 0.15
        );
        edgeAll.attr('opacity', (el) => {
          const s = typeof el.source === 'object' ? el.source.mid : el.source;
          const t = typeof el.target === 'object' ? el.target.mid : el.target;
          return s === d.mid || t === d.mid ? 0.9 : 0.07;
        });
      })
      .on('mouseout.ex', () => {
        if (shortestPathRef.current.length > 0) return;
        nodeAll.attr('opacity', (d) => d.isDeceased ? 0.5 : 1);
        edgeAll.attr('opacity', 0.55);
      })
      .on('click.ex', (event, d) => {
        event.stopPropagation();
        navigateRef.current(`/${d.mid}`);
      });

    sim.on('tick', () => {
      nodeAll.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      edgeAll.attr('d', (d) => {
        const x1 = d.source.x ?? 0, y1 = d.source.y ?? 0;
        const x2 = d.target.x ?? 0, y2 = d.target.y ?? 0;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const off = Math.min(len * 0.18, 30);
        return `M ${x1},${y1} Q ${mx + (-dy / len) * off},${my + (dx / len) * off} ${x2},${y2}`;
      });
    });

    return () => { sim.stop(); };
  }, [filteredMembers, focusMid]);

  // ── Highlight Path via D3 Attributes (MUST BE BELOW SIMULATION) ─────────────
  useEffect(() => {
    const gNodesEl = gNodesRef.current;
    const gEdgesEl = gEdgesRef.current;
    if (!gNodesEl || !gEdgesEl) return;

    const pathSet = new Set(shortestPath);
    const isActive = pathSet.size > 0;

    // Track exact edges used in the path so we don't accidentally highlight cross-connections
    const pathEdges = new Set();
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const u = shortestPath[i];
      const v = shortestPath[i+1];
      pathEdges.add(`${Math.min(u, v)}-${Math.max(u, v)}`);
    }

    select(gNodesEl).selectAll('g.enode')
      .transition().duration(300)
      .attr('opacity', (d) => isActive ? (pathSet.has(d.mid) ? 1 : 0.15) : (d.isDeceased ? 0.5 : 1));

    select(gNodesEl).selectAll('g.enode circle.main-bubble')
      .transition().duration(300)
      .attr('stroke', (d) => isActive && pathSet.has(d.mid) ? 'var(--parivar-accent)' : (d.isFocus ? 'var(--parivar-accent)' : 'var(--bs-border-color)'))
      .attr('stroke-width', (d) => isActive && pathSet.has(d.mid) ? 3 : (d.isFocus ? 3 : 1.5))
      .attr('filter', (d) => isActive && pathSet.has(d.mid) ? 'url(#parivar-glow)' : (d.isFocus ? 'url(#parivar-glow)' : null));

    select(gEdgesEl).selectAll('path.eedge')
      .transition().duration(300)
      .attr('opacity', (d) => {
        if (!isActive) return 0.55;
        const s = typeof d.source === 'object' ? d.source.mid : d.source;
        const t = typeof d.target === 'object' ? d.target.mid : d.target;
        const edgeKey = `${Math.min(s, t)}-${Math.max(s, t)}`;
        return pathEdges.has(edgeKey) ? 1 : 0.05;
      })
      .attr('stroke', (d) => {
        const s = typeof d.source === 'object' ? d.source.mid : d.source;
        const t = typeof d.target === 'object' ? d.target.mid : d.target;
        const edgeKey = `${Math.min(s, t)}-${Math.max(s, t)}`;
        if (isActive && pathEdges.has(edgeKey)) return 'var(--parivar-accent)';
        return d.type === 'spouse' ? 'var(--parivar-accent)' : 'var(--bs-border-color)';
      })
      .attr('stroke-width', (d) => {
        const s = typeof d.source === 'object' ? d.source.mid : d.source;
        const t = typeof d.target === 'object' ? d.target.mid : d.target;
        const edgeKey = `${Math.min(s, t)}-${Math.max(s, t)}`;
        return isActive && pathEdges.has(edgeKey) ? 3 : 1.5;
      })
      .attr('filter', (d) => {
        const s = typeof d.source === 'object' ? d.source.mid : d.source;
        const t = typeof d.target === 'object' ? d.target.mid : d.target;
        const edgeKey = `${Math.min(s, t)}-${Math.max(s, t)}`;
        return isActive && pathEdges.has(edgeKey) ? 'url(#parivar-glow)' : null;
      });

    // Reveal the hidden ring for Person X
    select(gNodesEl).selectAll('g.enode circle.kinship-start-ring')
      .transition().duration(300)
      .attr('opacity', (d) => isActive && kinshipX && d.mid === kinshipX.mid ? 0.8 : 0);

  }, [shortestPath, filteredMembers, kinshipX]);

  // ── Sidebar helpers ───────────────────────────────────────────────────────────

  const xSearchResults = useMemo(() => {
    const q = searchX.trim().toLowerCase();
    if (!q) return [];
    return allMembers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allMembers, searchX]);

  const ySearchResults = useMemo(() => {
    const q = searchY.trim().toLowerCase();
    if (!q) return [];
    return allMembers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allMembers, searchY]);

  // ── Node Snapping Logic ───────────────────────────────────────────────────────
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return filteredMembers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 10);
  }, [filteredMembers, globalSearch]);

  const handleSnapToPerson = (targetMember) => {
    setGlobalSearch(''); 
    setSidebarOpen(false); 

    const svgEl = svgRef.current;
    const z = zoomRef.current;
    const sim = simRef.current;

    if (!svgEl || !z || !sim) return;

    // 1. Find the target node's current physical coordinates
    const targetNode = sim.nodes().find((n) => n.mid === targetMember.mid);
    if (!targetNode) return;

    // 2. Calculate the center of the user's screen
    const cx = svgEl.clientWidth / 2;
    const cy = svgEl.clientHeight / 2;
    const targetScale = 1.5;

    // 3. Calculate the D3 transform to center the camera
    const transform = zoomIdentity
      .translate(cx, cy)
      .scale(targetScale)
      .translate(-targetNode.x, -targetNode.y);

    // 4. Smoothly fly the camera to the destination
    select(svgEl)
      .transition()
      .duration(750) 
      .call(z.transform, transform);

    // 5. Spawn the temporary expanding Halo effect!
    const gNodesEl = gNodesRef.current;
    if (gNodesEl) {
      // Find the specific HTML group  for the person we searched
      const targetG = select(gNodesEl)
        .selectAll('g.enode')
        .filter(d => d.mid === targetMember.mid);
      
      if (!targetG.empty()) {
        const nodeData = targetG.datum();
        
        // Wait 400ms for the camera to start moving, then fire the ping
        targetG.append('circle')
          .attr('r', nodeData.r)
          .attr('fill', 'none')
          .attr('stroke', 'var(--parivar-accent)')
          .attr('stroke-width', 4)
          .attr('opacity', 1)
          .transition()
          .delay(400) // Delay so it triggers as the camera arrives
          .duration(1200) // The animation lasts 1.2 seconds
          .attr('r', nodeData.r + 60) // The halo expands outward by 60px
          .attr('opacity', 0) // Fade to invisible
          .remove(); // D3 automatically deletes the element when the animation finishes
      }
    }
  };

  const effectiveDegrees = degrees ?? maxDegrees;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: '1 1 0', position: 'relative', overflow: 'hidden' }}>
      {/* Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: 'block', background: 'var(--bs-body-bg)' }}
      >
        <defs>
          <filter id="parivar-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g ref={gRef}>
          <g ref={gEdgesRef} />
          <g ref={gNodesRef} />
        </g>
      </svg>

      {/* Responsive Layout Styles for Graph Controls */}
      <style>{`
        .explore-controls {
          position: absolute; /* Default to inside the canvas for mobile */
          top: 16px;
          z-index: 10;
        }
        .explore-controls.left { left: 16px; }
        .explore-controls.right { right: 16px; }
        
        /* On md screens (980x) and larger, snap them up into the global header */
        @media (min-width: 980px) {
          .explore-controls {
            position: fixed;
            top: 24px;
            z-index: 10;
          }
          .explore-controls.left { left: 20px; }
          .explore-controls.right { right: 20px; }
        }
      `}</style>

      {/* Hamburger */}
      <button
        type="button"
        aria-label="Graph controls"
        onClick={() => setSidebarOpen(true)}
        className="d-flex align-items-center justify-content-center explore-controls left"
        style={{
          background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
          borderRadius: 8, padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
          cursor: 'pointer',
        }}
      >
        <IconMenu2 size={18} className="text-body-secondary" />
      </button>

      {/* Status pill */}
      {!loading && !error && filteredMembers.length > 0 && (
        <div
          className="explore-controls right"
          style={{
            background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
            borderRadius: 20, padding: '5px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: 12, color: 'var(--bs-secondary-color)',
            fontWeight: '500'
          }}
        >
          {filteredMembers.length} members
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="text-body-secondary small"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 15 }}
        >
          Loading family…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 15, background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
            borderRadius: 8, padding: 20, maxWidth: 320,
          }}
        >
          <div className="fw-medium mb-1">Couldn't load family</div>
          <div className="small text-body-secondary">{error}</div>
        </div>
      )}

      {/* Offcanvas backdrop */}
      {sidebarOpen && (
        <div
          className="offcanvas-backdrop fade show"
          style={{ zIndex: 1040 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Offcanvas sidebar */}
      <div
        className={`offcanvas offcanvas-start${sidebarOpen ? ' show' : ''}`}
        style={{ zIndex: 1045, maxWidth: 300, visibility: sidebarOpen ? 'visible' : 'hidden' }}
        tabIndex="-1"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title fs-6">Graph controls</h5>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        <div className="offcanvas-body d-flex flex-column gap-4 overflow-auto pb-4">
          
          {/* Snap to Person Search */}
          <div>
            <div className="parivar-section-label">Locate Person</div>
            <div className="position-relative mb-3">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search visible members..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              {globalSearch && globalSearchResults.length > 0 && (
                <div className="position-absolute w-100 mt-1 border rounded bg-body shadow-sm overflow-hidden" style={{ zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {globalSearchResults.map((m) => (
                    <button
                      key={m.mid}
                      type="button"
                      className="d-block w-100 text-start px-2 py-1 small border-0 bg-transparent text-body"
                      style={{ borderBottom: '1px solid var(--bs-border-color)' }}
                      onClick={() => handleSnapToPerson(m)}
                    >
                      <div>{m.name}</div>
                      {m.location && <div className="small text-body-secondary">{m.location}</div>}
                    </button>
                  ))}
                </div>
              )}
              {globalSearch && globalSearchResults.length === 0 && (
                <div className="position-absolute w-100 mt-1 border rounded bg-body shadow-sm p-2 small text-body-secondary" style={{ zIndex: 10 }}>
                  No visible members found. Increase degrees to see more.
                </div>
              )}
            </div>
          </div>

          {/* Kinship Finder */}
          <div>
            <div className="parivar-section-label">Find Relationship</div>
            
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="position-relative">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Person X..."
                  value={kinshipX ? kinshipX.name : searchX}
                  onChange={(e) => { setKinshipX(null); setSearchX(e.target.value); }}
                />
                {searchX && !kinshipX && xSearchResults.length > 0 && (
                  <div className="position-absolute w-100 mt-1 border rounded bg-body shadow-sm overflow-hidden" style={{ zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
                    {xSearchResults.map((m) => (
                      <button
                        key={m.mid} type="button"
                        className="d-block w-100 text-start px-2 py-1 small border-0 bg-transparent text-body"
                        style={{ borderBottom: '1px solid var(--bs-border-color)' }}
                        onClick={() => { setKinshipX(m); setSearchX(''); }}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="position-relative">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Person Y..."
                  value={kinshipY ? kinshipY.name : searchY}
                  onChange={(e) => { setKinshipY(null); setSearchY(e.target.value); }}
                />
                {searchY && !kinshipY && ySearchResults.length > 0 && (
                  <div className="position-absolute w-100 mt-1 border rounded bg-body shadow-sm overflow-hidden" style={{ zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
                    {ySearchResults.map((m) => (
                      <button
                        key={m.mid} type="button"
                        className="d-block w-100 text-start px-2 py-1 small border-0 bg-transparent text-body"
                        style={{ borderBottom: '1px solid var(--bs-border-color)' }}
                        onClick={() => { setKinshipY(m); setSearchY(''); }}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {kinshipText && (
              <div 
                className="mt-3 px-3 py-2 rounded d-inline-block w-100" 
                style={{ 
                  background: 'var(--parivar-accent-bg)', 
                  border: '1px solid rgba(0,0,0,0.05)' 
                }}
              >
                <div className="fw-semibold" style={{ color: 'var(--parivar-accent)', lineHeight: '1.4' }}>
                  {kinshipX && kinshipY && kinshipX.mid === kinshipY.mid
                    ? 'Yeh wahi vyakti hai'
                    : kinshipText.hi === 'Koi Rishta Nahi' 
                      ? 'Koi Rishta Nahi' 
                      : (kinshipX && kinshipY 
                          ? `${kinshipY.name.split(' ')[0]} ${kinshipX.name.split(' ')[0]} ke ${kinshipText.hi} hai` 
                          : kinshipText.hi)}
                </div>
                <div className="small text-body-secondary mt-1" style={{ lineHeight: '1.4' }}>
                  {kinshipX && kinshipY && kinshipX.mid === kinshipY.mid
                    ? 'Selected the same person.'
                    : kinshipText.en}
                </div>
              </div>
            )}
          </div>

          <hr className="m-0" />

          {/* Degrees */}
          <div>
            <div className="parivar-section-label">Degrees of separation</div>
            <div className="small text-body-secondary mb-2">
              {effectiveDegrees} degrees &middot; {countAtDegrees} of {allMembers.length} members
            </div>
            
            <input
              type="range"
              className="form-range"
              min={1}
              max={maxDegrees}
              step={1}
              value={effectiveDegrees}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDegrees(val);
                // As the user manually drags the slider, remember their custom position
                if (val < maxDegrees) setSavedDegrees(val); 
              }}
            />
            
            <button
              type="button"
              className={`btn btn-sm mt-2 w-100 ${effectiveDegrees === maxDegrees ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
              onClick={() => {
                if (effectiveDegrees === maxDegrees) {
                  // Un-toggle: Restore previous view
                  setDegrees(Math.min(savedDegrees, maxDegrees));
                } else {
                  // Toggle ON: Save current and expand
                  setSavedDegrees(effectiveDegrees);
                  setDegrees(maxDegrees);
                }
              }}
            >
              Show everyone
            </button>
          </div>

          {/* Filters */}
          <div>
            <div className="parivar-section-label">Filters</div>
            <div className="d-flex flex-column gap-2">
              <div className="form-check form-switch">
                <input
                  className="form-check-input" type="checkbox"
                  id="ex-hide-deceased" checked={hideDeceased}
                  onChange={(e) => setHideDeceased(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="ex-hide-deceased">
                  Hide deceased
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input" type="checkbox"
                  id="ex-hide-inlaws" checked={hideInLaws}
                  onChange={(e) => setHideInLaws(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="ex-hide-inlaws">
                  Hide in-laws
                </label>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div>
            <div className="parivar-section-label">Legend</div>
            <div className="d-flex flex-column gap-2 small">
              {[
                {
                  svg: (
                    <svg width="26" height="26">
                      <circle cx="13" cy="13" r="9" fill="var(--parivar-accent-bg)" stroke="var(--parivar-accent)" strokeWidth="3" />
                      <circle cx="13" cy="13" r="13" fill="none" stroke="var(--parivar-accent)" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
                    </svg>
                  ),
                  label: 'You (focus)',
                },
                {
                  svg: (
                    <svg width="26" height="26">
                      <circle cx="13" cy="13" r="9" fill="var(--parivar-accent-bg)" stroke="var(--bs-border-color)" strokeWidth="1.5" />
                    </svg>
                  ),
                  label: 'Living member',
                },
                {
                  svg: (
                    <svg width="26" height="26">
                      <circle cx="13" cy="13" r="9" fill="var(--parivar-deceased-bg)" stroke="var(--parivar-deceased)" strokeWidth="1.5" opacity="0.5" />
                    </svg>
                  ),
                  label: 'Deceased',
                },
                {
                  svg: (
                    <svg width="36" height="14">
                      <line x1="2" y1="7" x2="34" y2="7" stroke="var(--bs-border-color)" strokeWidth="1.5" />
                    </svg>
                  ),
                  label: 'Parent / child',
                },
                {
                  svg: (
                    <svg width="36" height="14">
                      <line x1="2" y1="7" x2="34" y2="7" stroke="var(--parivar-accent)" strokeWidth="1.5" strokeDasharray="5 3" />
                    </svg>
                  ),
                  label: 'Spouse',
                },
              ].map(({ svg, label }) => (
                <div key={label} className="d-flex align-items-center gap-2">
                  <div style={{ flexShrink: 0 }}>{svg}</div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-3 border-top">
            <Link
              to="/directory"
              className="text-body-secondary small text-decoration-none"
              onClick={() => setSidebarOpen(false)}
            >
              &larr; Back to directory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}