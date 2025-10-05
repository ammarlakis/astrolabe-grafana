/**
 * Graph layout using ELK (Eclipse Layout Kernel)
 * Provides hierarchical DAG layout for Kubernetes resources
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import { Kind } from '../types';

const elk = new ELK();

// ---- Config -----------------------------------------------------------------

const DEBUG = false;

// Horizontal gap between columns after we snap lanes (px).
// Set this larger than your widest visual adornments (badges/handles/shadows).
const LANE_GAP = 180;

// Root layout options (elkjs requires string values)
const ROOT_OPTS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',

  // We provide explicit per-node layer IDs
  'org.eclipse.elk.layered.layering.strategy': 'INTERACTIVE',

  // Spacing knobs
  'elk.spacing.nodeNode': '100', // vertical gap within same lane
  'elk.spacing.edgeEdge': '80',
  'elk.spacing.componentComponent': '120',

  // Horizontal gap guidance for ELK (we still snap later)
  'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '140',
  'org.eclipse.elk.layered.spacing.edgeNodeBetweenLayers': '80',

  // Placement & crossings
  'org.eclipse.elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'org.eclipse.elk.layered.cycleBreaking.strategy': 'GREEDY',
  'org.eclipse.elk.layered.crossingMinimization.semiInteractive': 'true',

  // Avoid ELK squeezing after placement
  'org.eclipse.elk.layered.compaction.postCompaction.enabled': 'false',

  // Routing
  'elk.edgeRouting': 'POLYLINE',
  'org.eclipse.elk.layered.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
};

// ---- Lane mapping ------------------------------------------------------------

/** Map Kubernetes resource kind → desired lane index (before compaction). */
function getLane(kind: Kind): number {
  if (kind === Kind.Ingress || kind === Kind.Gateway) {
    return 0;
  }
  if (
    [
      Kind.Service,
      Kind.Deployment,
      Kind.Job,
      Kind.CronJob,
      Kind.StatefulSet,
      Kind.DaemonSet,
    ].includes(kind)
  ) {
    return 1;
  }
  if ([Kind.EndpointSlice, Kind.ReplicaSet].includes(kind)) {
    return 2;
  }
  if (kind === Kind.Pod) {
    return 3;
  }
  if (kind === Kind.PersistentVolumeClaim) {
    return 4;
  }
  if (kind === Kind.PersistentVolume) {
    return 5;
  }
  return 2; // sensible default
}

/** Build a compact 0..N-1 remap from used original lanes (sorted numerically). */
function buildLaneRemap(usedLanes: number[]): Map<number, number> {
  const uniqSorted = [...new Set(usedLanes)].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  uniqSorted.forEach((lane, i) => remap.set(lane, i));
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.table(uniqSorted.map((l) => ({ original: l, compact: remap.get(l) })));
  }
  return remap;
}

// ---- Helpers ----------------------------------------------------------------

/** Get measured node size from React Flow if present; fall back to defaults. */
function getNodeSize(n: Node, fallbackW = 220, fallbackH = 120): { w: number; h: number } {
  // RF sets `width`/`height` post-render; some setups expose `measured`.
  const anyNode = n as any;
  const w = Math.ceil(anyNode.width ?? anyNode.measured?.width ?? fallbackW);
  const h = Math.ceil(anyNode.height ?? anyNode.measured?.height ?? fallbackH);
  return { w, h };
}

/** After ELK computes coordinates, snap X by lane to fixed columns to prevent overlap. */
function snapColumnsByLane(laid: any, fallbackGap = LANE_GAP) {
  const laneOf: Record<string, number> = {};
  const laneMaxW: number[] = [];

  for (const c of laid.children ?? []) {
    const lid = c.layoutOptions?.['org.eclipse.elk.layered.layering.layerId'];
    if (lid == null) {
      continue;
    }
    const lane = Number(lid);
    laneOf[c.id] = lane;
    const w = Math.ceil(c.width ?? 0);
    laneMaxW[lane] = Math.max(laneMaxW[lane] ?? 0, w);
  }

  const laneX: number[] = [];
  let cursor = 0;
  for (let lane = 0; lane < laneMaxW.length; lane++) {
    laneX[lane] = cursor;
    cursor += (laneMaxW[lane] ?? 0) + fallbackGap;
  }

  for (const c of laid.children ?? []) {
    const ln = laneOf[c.id];
    if (ln != null) {
      c.x = laneX[ln];
    }
  }

  // Recenter to start at x=0
  const minX = Math.min(...(laid.children ?? []).map((c: any) => c.x ?? 0));
  if (Number.isFinite(minX) && minX !== 0) {
    for (const c of laid.children ?? []) {
      c.x = (c.x ?? 0) - minX;
    }
  }

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.table(
      (laid.children ?? []).map((c: any) => ({
        id: c.id,
        lane: Number(c.layoutOptions?.['org.eclipse.elk.layered.layering.layerId']),
        x: Math.round(c.x ?? 0),
        w: Math.round(c.width ?? 0),
        right: Math.round((c.x ?? 0) + (c.width ?? 0)),
      }))
    );
  }
}

// Minimum vertical gap between nodes in the same lane (px)
const LANE_VGAP = 40; // tune to your card shadows/handles

function resolveVerticalCollisionsByLane(laid: any, vgap = LANE_VGAP) {
  // 1) bucket children by lane
  const buckets = new Map<number, any[]>();
  for (const c of laid.children ?? []) {
    const lid = c.layoutOptions?.['org.eclipse.elk.layered.layering.layerId'];
    if (lid == null) {
      continue;
    }
    const lane = Number(lid);
    if (!buckets.has(lane)) {
      buckets.set(lane, []);
    }
    buckets.get(lane)!.push(c);
  }

  // 2) for each lane: sort by y, then sweep down and separate
  for (const [_, items] of buckets) {
    items.sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    let cursor = -Infinity;
    for (const c of items) {
      const h = Math.ceil(c.height ?? 0);
      const desiredTop = Math.max(c.y ?? 0, cursor);
      c.y = desiredTop;
      cursor = desiredTop + h + vgap;
    }

    // Optional nicety: recenter the lane vertically (keeps diff minimal)
    // Compute old vs new center and shift all to preserve overall placement
    const oldMin = Math.min(...items.map(c => (c._oldY ?? c.y)));
    const oldMax = Math.max(...items.map(c => (c._oldY ?? c.y) + (c.height ?? 0)));
    const newMin = Math.min(...items.map(c => c.y));
    const newMax = Math.max(...items.map(c => c.y + (c.height ?? 0)));
    const oldCenter = (oldMin + oldMax) / 2;
    const newCenter = (newMin + newMax) / 2;
    const delta = oldCenter - newCenter;
    if (Number.isFinite(delta)) {
      for (const c of items) {
        c.y = (c.y ?? 0) + delta;
      }
    }
  }
}

// ---- Main -------------------------------------------------------------------

export async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  // 1) Original lane per node (0..5), then compact to 0..N-1 used lanes.
  const originalLaneByNode = new Map<string, number>();
  const usedOriginal: number[] = [];
  for (const n of nodes) {
    const kind = (n.data as any)?.resource?.kind as Kind;
    const lane = getLane(kind);
    originalLaneByNode.set(n.id, lane);
    usedOriginal.push(lane);
  }
  const remap = buildLaneRemap(usedOriginal);

  // 2) Build ELK graph with measured sizes and compact layer ids.
  const children = nodes.map((n) => {
    const original = originalLaneByNode.get(n.id)!;
    const compact = remap.get(original)!; // 0..N-1
    const { w, h } = getNodeSize(n);

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`child ${n.id} original=${original} -> compact=${compact} size=${w}x${h}`);
    }

    return {
      id: n.id,
      width: w,
      height: h,
      layoutOptions: {
        // MUST be this key; elk.layered.* will be ignored
        'org.eclipse.elk.layered.layering.layerId': String(compact),
      },
    };
  });

  const elkGraph = {
    id: 'root',
    layoutOptions: ROOT_OPTS,
    children,
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  // 3) Layout with ELK, then snap columns to enforce clean lane separation.
  let laid: any;
  try {
    laid = await elk.layout(elkGraph as any);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('ELK layout error; falling back to grid:', err);
    const fallbackNodes = nodes.map((n, i) => ({
      ...n,
      position: { x: (i % 5) * 250, y: Math.floor(i / 5) * 160 },
    }));
    return { nodes: fallbackNodes, edges };
  }
  for (const c of laid.children ?? []) {
    c._oldY = c.y;
  }
  snapColumnsByLane(laid, LANE_GAP);
  resolveVerticalCollisionsByLane(laid, LANE_VGAP);
  
  // snapColumnsByLane(laid, LANE_GAP);

  
  // 4) Copy positions back to React Flow nodes.
  const layoutedNodes = nodes.map((n) => {
    const c = laid.children?.find((ch: any) => ch.id === n.id);
    return {
      ...n,
      position: { x: c?.x ?? 0, y: c?.y ?? 0 },
    };
  });

  if (DEBUG) {
    // Verify gaps are non-negative and ≥ LANE_GAP
    const rows = (laid.children ?? []).map((c: any) => ({
      lane: Number(c.layoutOptions?.['org.eclipse.elk.layered.layering.layerId']),
      x: c.x ?? 0,
      right: (c.x ?? 0) + (c.width ?? 0),
    }));
    rows.sort((a: any, b: any) => a.lane - b.lane || a.x - b.x);
    const perLane: Record<number, { minX: number; maxRight: number }> = {};
    for (const r of rows) {
      const s = perLane[r.lane] ?? { minX: Infinity, maxRight: -Infinity };
      s.minX = Math.min(s.minX, r.x);
      s.maxRight = Math.max(s.maxRight, r.right);
      perLane[r.lane] = s;
    }
    const lanes = Object.keys(perLane)
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    for (let i = 0; i < lanes.length - 1; i++) {
      const A = perLane[lanes[i]];
      const B = perLane[lanes[i + 1]];
      // eslint-disable-next-line no-console
      console.log(`gap ${lanes[i]}->${lanes[i + 1]}: ${Math.round(B.minX - A.maxRight)}px`);
    }
  }

  return { nodes: layoutedNodes, edges };
}
