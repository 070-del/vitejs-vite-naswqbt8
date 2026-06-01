import React, { useEffect, useMemo, useRef, useState } from "react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const STORAGE_KEY = "ceiling-takeoff-ai-app-v3";
const DRAW_W = 960;
const DRAW_H = 560;
const MOBILE_BREAKPOINT = 900;

const defaultSettings = {
  channelPitch: 900,
  doubleBarPitch: 900,
  singleBarPitch: 455,
  boardW: 910,
  boardH: 1820,
  boltPitch: 900,
  boltLength: 1000,
  channelStock: 3000,
  doubleBarStock: 4000,
  singleBarStock: 4000,
  screwPerBoard: 36,
  edgeToCenter: 150,
  channelDirection: "horizontal",
};

const S = {
  page: { minHeight: "100vh", background: "#f3f5f7", padding: 16, fontFamily: "Arial, sans-serif", color: "#111827" },
  wrap: { maxWidth: 1380, margin: "0 auto" },
  card: { background: "#fff", border: "1px solid #dbe2ea", borderRadius: 18, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  rowBetween: { display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  sub: { color: "#667085", fontSize: 14, lineHeight: 1.5 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontSize: 14, background: "#fff" },
  btn: { border: 0, borderRadius: 14, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 42 },
  btnPrimary: { background: "#111827", color: "#fff" },
  btnSecondary: { background: "#fff", color: "#111827", border: "1px solid #cbd5e1" },
  btnDanger: { background: "#dc2626", color: "#fff" },
  small: { fontSize: 12, color: "#667085", lineHeight: 1.5 },
  sectionTitle: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  pill: { display: "inline-flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 999, background: "#eef2f7" },
  pillNum: { width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 },
  badgeDark: { background: "#111827", color: "#fff" },
  badgeLight: { background: "#dbe2ea", color: "#111827" },
  badgeOff: { background: "#edf2f7", color: "#94a3b8" },
  drawBox: { position: "relative", height: "60vh", minHeight: 320, border: "1px dashed #cbd5e1", borderRadius: 20, overflow: "hidden", background: "#fff", touchAction: "none" },
  svgBox: { width: "100%", height: "100%", display: "block" },
  softBox: { background: "#f8fafc", borderRadius: 16, padding: 12 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: "#475467", marginBottom: 6 },
  dimCard: { background: "#f8fafc", borderRadius: 16, padding: 12, border: "1px solid #e5e7eb" },
  resultItem: { border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: "#fff" },
  errorBox: { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 16, padding: 12 },
  okBox: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 16, padding: 12 },
  drawerBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 20 },
  drawer: { position: "fixed", top: 0, right: 0, width: "100%", maxWidth: 420, height: "100%", background: "#fff", boxShadow: "-8px 0 24px rgba(0,0,0,0.15)", zIndex: 21, display: "flex", flexDirection: "column" },
  drawerHead: { padding: 16, borderBottom: "1px solid #e5e7eb" },
  drawerBody: { padding: 16, overflow: "auto", flex: 1, display: "grid", gap: 12 },
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

function Button({ children, variant = "primary", style = {}, disabled = false, ...props }) {
  const extra = variant === "secondary" ? S.btnSecondary : variant === "danger" ? S.btnDanger : S.btnPrimary;
  return (
    <button
      style={{ ...S.btn, ...extra, ...style, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}

function IntInput({ value, onChange, placeholder = "0" }) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, "");
        onChange(v === "" ? "" : String(parseInt(v, 10)));
      }}
      inputMode="numeric"
      placeholder={placeholder}
      style={S.input}
    />
  );
}

function roundInt(v) {
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function almostEqual(a, b, tol = 1) {
  return Math.abs(a - b) <= tol;
}

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function lineDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return dist(point, start);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const px = start.x + t * dx;
  const py = start.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = lineDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function dedupeNeighbors(points, tol = 3) {
  const out = [];
  for (const p of points) {
    if (!out.length || dist(out[out.length - 1], p) > tol) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function closePolygon(points) {
  if (!points.length) return [];
  const out = points.slice();
  const first = out[0];
  const last = out[out.length - 1];
  if (dist(first, last) > 6) out.push({ ...first });
  return out;
}

function removeTinySegmentsClosed(points, minLen = 12) {
  if (points.length < 4) return points;
  let out = points.slice();
  let changed = true;
  while (changed && out.length > 4) {
    changed = false;
    const next = [out[0]];
    for (let i = 1; i < out.length; i += 1) {
      const prev = next[next.length - 1];
      if (dist(prev, out[i]) >= minLen || i === out.length - 1) next.push(out[i]);
      else changed = true;
    }
    out = closePolygon(dedupeNeighbors(next));
  }
  return out;
}

function mergeCollinearClosed(points) {
  if (points.length < 4) return points;
  const open = points.slice(0, -1);
  let out = open.slice();
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    const merged = [];
    for (let i = 0; i < out.length; i += 1) {
      const prev = out[(i - 1 + out.length) % out.length];
      const curr = out[i];
      const next = out[(i + 1) % out.length];
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const collinear = (almostEqual(dx1, 0, 2) && almostEqual(dx2, 0, 2)) || (almostEqual(dy1, 0, 2) && almostEqual(dy2, 0, 2));
      if (!collinear) merged.push(curr);
      else changed = true;
    }
    out = merged;
  }
  return closePolygon(out);
}

function simplifyToOrthogonal(rawPoints) {
  if (!rawPoints || rawPoints.length < 6) return null;
  let pts = dedupeNeighbors(rawPoints, 8);
  if (pts.length < 4) return null;
  pts = closePolygon(pts);
  let epsilon = 14;
  let simplified = rdp(pts, epsilon);
  while (simplified.length - 1 > 26 && epsilon < 60) {
    epsilon += 6;
    simplified = rdp(pts, epsilon);
  }
  simplified = closePolygon(dedupeNeighbors(simplified, 10));
  if (simplified.length < 4) return null;
  const ortho = [{ ...simplified[0] }];
  for (let i = 1; i < simplified.length; i += 1) {
    const prev = ortho[ortho.length - 1];
    const next = simplified[i];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.abs(dx) >= Math.abs(dy)) ortho.push({ x: next.x, y: prev.y });
    else ortho.push({ x: prev.x, y: next.y });
  }
  let cleaned = closePolygon(dedupeNeighbors(ortho, 10));
  cleaned = removeTinySegmentsClosed(cleaned, 14);
  cleaned = mergeCollinearClosed(cleaned);
  if (cleaned.length < 5) return null;
  if (cleaned.length - 1 > 26) {
    const sampled = [];
    const open = cleaned.slice(0, -1);
    const step = Math.ceil(open.length / 26);
    for (let i = 0; i < open.length; i += step) sampled.push(open[i]);
    cleaned = closePolygon(sampled);
    cleaned = mergeCollinearClosed(cleaned);
  }
  return cleaned.length >= 5 ? cleaned : null;
}

function getEdges(points) {
  if (!points || points.length < 4) return [];
  const edges = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "R" : "L") : dy >= 0 ? "D" : "U";
    edges.push({
      from,
      to,
      dir,
      index: edges.length,
      label: LETTERS[edges.length] || `E${edges.length + 1}`,
      mid: { x: roundInt((from.x + to.x) / 2), y: roundInt((from.y + to.y) / 2) },
    });
  }
  return edges;
}

function bboxOf(points) {
  if (!points || !points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: roundInt(maxX - minX), height: roundInt(maxY - minY) };
}

function shoelaceArea(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return sum / 2;
}

function reconstructByLengths(edges, dims) {
  let x = 0;
  let y = 0;
  const pts = [{ x, y }];
  let perimeter = 0;
  for (const edge of edges) {
    const len = roundInt(Number(dims[edge.label] || 0));
    perimeter += len;
    if (edge.dir === "R") x += len;
    if (edge.dir === "L") x -= len;
    if (edge.dir === "D") y += len;
    if (edge.dir === "U") y -= len;
    pts.push({ x, y });
  }
  const closed = pts.slice();
  if (x !== 0 || y !== 0) closed.push({ x: 0, y: 0 });
  const area = roundInt(Math.abs(shoelaceArea(closed)));
  const box = bboxOf(closed);
  return { points: closed, area, perimeter, width: box.width, height: box.height, closureErrorX: x, closureErrorY: y };
}

function computeCenters(span, pitch, edge) {
  const s = roundInt(span);
  const p = Math.max(1, roundInt(pitch));
  const e = Math.max(0, roundInt(edge));
  if (s <= 0) return [];
  if (s <= e * 2) return [roundInt(s / 2)];
  const inner = s - e * 2;
  const gaps = Math.max(0, Math.floor(inner / p));
  const remain = inner - gaps * p;
  const start = e + roundInt(remain / 2);
  return Array.from({ length: gaps + 1 }, (_, i) => start + i * p);
}

function countJoints(lineLength, stockLength, lineCount) {
  const len = Math.max(0, roundInt(lineLength));
  const stock = Math.max(1, roundInt(stockLength));
  const count = Math.max(0, roundInt(lineCount));
  const perLine = Math.max(0, Math.ceil(len / stock) - 1);
  return perLine * count;
}

function findNearestDistance(a, list) {
  if (!list.length) return Infinity;
  let min = Infinity;
  for (const n of list) min = Math.min(min, Math.abs(a - n));
  return min;
}

function validateSettings(settings) {
  const mustBePositiveKeys = [
    "channelPitch",
    "doubleBarPitch",
    "singleBarPitch",
    "boardW",
    "boardH",
    "boltPitch",
    "boltLength",
    "channelStock",
    "doubleBarStock",
    "singleBarStock",
    "screwPerBoard",
  ];
  const problems = [];
  mustBePositiveKeys.forEach((key) => {
    if (roundInt(Number(settings[key])) <= 0) problems.push(key);
  });
  return problems;
}

function createMaterialReport(shape, dims, settings) {
  const edges = getEdges(shape);
  if (!edges.length) return null;

  const missing = edges.filter((e) => !roundInt(Number(dims[e.label] || 0))).map((e) => e.label);
  const settingsProblems = validateSettings(settings);
  const geometry = reconstructByLengths(edges, dims);
  const width = Math.max(geometry.width, 0);
  const height = Math.max(geometry.height, 0);
  const area = geometry.area;
  const perimeter = geometry.perimeter;
  const closureError = Math.abs(geometry.closureErrorX) + Math.abs(geometry.closureErrorY);

  if (settingsProblems.length) {
    return {
      geometry,
      missing,
      error: "設定に 0 の項目があります",
      items: [],
    };
  }

  const runSpan = settings.channelDirection === "horizontal" ? width : height;
  const crossSpan = settings.channelDirection === "horizontal" ? height : width;

  const channelCenters = computeCenters(crossSpan, settings.channelPitch, settings.edgeToCenter);
  const doubleCenters = computeCenters(runSpan, settings.doubleBarPitch, settings.edgeToCenter);
  const singleAll = computeCenters(runSpan, settings.singleBarPitch, settings.edgeToCenter);
  const singleCenters = singleAll.filter((v) => findNearestDistance(v, doubleCenters) > 60);
  const boltCenters = computeCenters(runSpan, settings.boltPitch, settings.edgeToCenter);

  const channelCount = channelCenters.length;
  const doubleCount = doubleCenters.length;
  const singleCount = singleCenters.length;
  const boltCount = channelCount * boltCenters.length;
  const hangerCount = boltCount;
  const nutCount = boltCount * 2;
  const boardCount = Math.max(0, Math.ceil(area / Math.max(1, settings.boardW * settings.boardH)));
  const screwCount = boardCount * Math.max(0, roundInt(settings.screwPerBoard));

  const channelLen = runSpan;
  const doubleLen = crossSpan;
  const singleLen = crossSpan;

  const channelJoint = countJoints(channelLen, settings.channelStock, channelCount);
  const doubleJoint = countJoints(doubleLen, settings.doubleBarStock, doubleCount);
  const singleJoint = countJoints(singleLen, settings.singleBarStock, singleCount);

  const channelEdge = channelCenters.length ? `${channelCenters[0]}ミリ / ${Math.max(0, crossSpan - channelCenters[channelCenters.length - 1])}ミリ` : "0ミリ / 0ミリ";
  const doubleEdge = doubleCenters.length ? `${doubleCenters[0]}ミリ / ${Math.max(0, runSpan - doubleCenters[doubleCenters.length - 1])}ミリ` : "0ミリ / 0ミリ";
  const singleEdge = singleCenters.length ? `${singleCenters[0]}ミリ / ${Math.max(0, runSpan - singleCenters[singleCenters.length - 1])}ミリ` : "0ミリ / 0ミリ";

  return {
    geometry,
    missing,
    error: null,
    items: [
      { name: "ボルト", value: `${roundInt(settings.boltLength)}ミリ × ${boltCount}本` },
      { name: "チャンネル", value: `${channelLen}ミリ × ${channelCount}本` },
      { name: "ダブルバー", value: `${doubleLen}ミリ × ${doubleCount}本` },
      { name: "シングルバー", value: `${singleLen}ミリ × ${singleCount}本` },
      { name: "ボード", value: `${roundInt(settings.boardW)}ミリ × ${roundInt(settings.boardH)}ミリ × ${boardCount}枚` },
      { name: "ハンガー", value: `${hangerCount}個` },
      { name: "ナット", value: `${nutCount}個` },
      { name: "ビス", value: `${screwCount}本` },
      { name: "チャンネルJOINT", value: `${channelJoint}個` },
      { name: "ダブルバーJOINT", value: `${doubleJoint}個` },
      { name: "シングルバージョイント", value: `${singleJoint}個` },
      { name: "端部から中心までの寸法", value: `チャンネル ${channelEdge} / ダブルバー ${doubleEdge} / シングルバー ${singleEdge}` },
      {
        name: "必要事項",
        value: `面積 ${area}平方ミリ / 外周 ${perimeter}ミリ / 閉合差 ${closureError}ミリ / 未入力 ${missing.length ? missing.join(", ") : "なし"}`,
      },
    ],
  };
}

function polylineString(points) {
  return (points || []).map((p) => `${p.x},${p.y}`).join(" ");
}

function StepPill({ active, done, num, label }) {
  const badge = active ? S.badgeDark : done ? S.badgeLight : S.badgeOff;
  return (
    <div style={S.pill}>
      <div style={{ ...S.pillNum, ...badge }}>{num}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#111827" : "#667085" }}>{label}</div>
    </div>
  );
}

function Field({ label, children, suffix = "" }) {
  return (
    <div>
      <div style={S.fieldLabel}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {children}
        {suffix ? <span style={S.small}>{suffix}</span> : null}
      </div>
    </div>
  );
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: raw.id || uniqueId(),
    projectName: raw.projectName || "",
    updatedAt: raw.updatedAt || new Date().toISOString(),
    drawing: Array.isArray(raw.drawing) ? raw.drawing : [],
    shape: Array.isArray(raw.shape) ? raw.shape : null,
    dims: raw.dims && typeof raw.dims === "object" ? raw.dims : {},
    settings: { ...defaultSettings, ...(raw.settings || {}) },
  };
}

export default function CeilingTakeoffAiApp() {
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [drawing, setDrawing] = useState([]);
  const [shape, setShape] = useState(null);
  const [dims, setDims] = useState({});
  const [settings, setSettings] = useState(defaultSettings);
  const [records, setRecords] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [drawingNow, setDrawingNow] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [message, setMessage] = useState("");
  const boardRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) {
        const normalized = saved.map(normalizeRecord).filter(Boolean);
        setRecords(normalized);
      }
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const edges = useMemo(() => getEdges(shape), [shape]);
  const report = useMemo(() => createMaterialReport(shape, dims, settings), [shape, dims, settings]);
  const hasDims = edges.length > 0;
  const dimsComplete = hasDims && edges.every((e) => roundInt(Number(dims[e.label] || 0)) > 0);
  const canShowResult = !!shape;

  function getPointFromEvent(e) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clientX = typeof e.clientX === "number" ? e.clientX : 0;
    const clientY = typeof e.clientY === "number" ? e.clientY : 0;
    const x = ((clientX - rect.left) / rect.width) * DRAW_W;
    const y = ((clientY - rect.top) / rect.height) * DRAW_H;
    return {
      x: Math.max(0, Math.min(DRAW_W, roundInt(x))),
      y: Math.max(0, Math.min(DRAW_H, roundInt(y))),
    };
  }

  function handlePointerDown(e) {
    const p = getPointFromEvent(e);
    if (!p) return;
    setMessage("");
    setDrawingNow(true);
    setDrawing([p]);
  }

  function handlePointerMove(e) {
    if (!drawingNow) return;
    const p = getPointFromEvent(e);
    if (!p) return;
    setDrawing((prev) => {
      if (!prev.length) return [p];
      if (dist(prev[prev.length - 1], p) < 4) return prev;
      return [...prev, p];
    });
  }

  function handlePointerUp() {
    setDrawingNow(false);
  }

  function resetAll() {
    setDrawing([]);
    setShape(null);
    setDims({});
    setCurrentId(null);
    setProjectName("");
    setSettings(defaultSettings);
    setStep(1);
    setMessage("");
  }

  function handleAiNormalize() {
    const nextShape = simplifyToOrthogonal(drawing);
    if (!nextShape) {
      setMessage("形をもう少し大きく、一周するように描いてください");
      return;
    }
    const nextEdges = getEdges(nextShape);
    if (!nextEdges.length) {
      setMessage("辺が読み取れませんでした");
      return;
    }
    const nextDims = {};
    for (const e of nextEdges) nextDims[e.label] = dims[e.label] || "";
    setShape(nextShape);
    setDims(nextDims);
    setStep(2);
    setMessage("");
  }

  function handleGoResult() {
    if (!shape) return;
    setStep(3);
  }

  function saveRecord() {
    if (!shape) {
      setMessage("先に形を作成してください");
      return;
    }
    const payload = {
      id: currentId || uniqueId(),
      projectName: projectName || `案件-${formatDateTime(new Date().toISOString())}`,
      updatedAt: new Date().toISOString(),
      drawing,
      shape,
      dims,
      settings,
    };
    setCurrentId(payload.id);
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === payload.id);
      const merged = exists ? prev.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...prev];
      return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
    setMessage("保存しました");
  }

  function loadRecord(record) {
    const normalized = normalizeRecord(record);
    if (!normalized) return;
    setProjectName(normalized.projectName);
    setDrawing(normalized.drawing);
    setShape(normalized.shape);
    setDims(normalized.dims);
    setSettings(normalized.settings);
    setCurrentId(normalized.id);
    setStep(normalized.shape ? 2 : 1);
    setDrawerOpen(false);
    setMessage("");
  }

  function deleteRecord(id) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (currentId === id) setCurrentId(null);
  }

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => `${r.projectName || ""} ${r.updatedAt || ""}`.toLowerCase().includes(q));
  }, [records, search]);

  const twoCol = isMobile ? "1fr" : "minmax(0, 1.4fr) minmax(300px, 0.6fr)";
  const stepTwoCol = isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(320px, 0.9fr)";
  const stepThreeCol = isMobile ? "1fr" : "minmax(320px, 0.9fr) minmax(0, 1.1fr)";
  const twoFieldCol = isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))";

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ ...S.rowBetween, marginBottom: 12 }}>
          <div>
            <div style={{ ...S.title, fontSize: isMobile ? 24 : 28 }}>天井拾い出しAI</div>
            <div style={S.sub}>手書き → 整形 → 寸法入力 → 資材結果</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", width: isMobile ? "100%" : "auto", flexWrap: "wrap" }}>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="案件名"
              style={{ ...S.input, width: isMobile ? "100%" : 180 }}
            />
            <Button variant="secondary" onClick={() => setDrawerOpen(true)} style={{ width: isMobile ? "100%" : "auto" }}>
              保存データ
            </Button>
          </div>
        </div>

        {message ? <div style={{ ...S.okBox, marginBottom: 12 }}>{message}</div> : null}

        <Card style={{ marginBottom: 12 }}>
          <div style={S.row}>
            <StepPill num={1} label="手書き" active={step === 1} done={step > 1} />
            <StepPill num={2} label="整形と寸法" active={step === 2} done={step > 2} />
            <StepPill num={3} label="結果" active={step === 3} done={false} />
          </div>
        </Card>

        {step === 1 && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: twoCol }}>
            <Card>
              <div style={{ ...S.rowBetween, marginBottom: 12 }}>
                <div>
                  <div style={S.sectionTitle}>1ページ目 手書き入力</div>
                  <div style={S.sub}>天井の形を指かマウスで大まかに囲ってください</div>
                </div>
                <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                  <Button variant="secondary" onClick={() => setDrawing([])} style={{ flex: 1 }}>
                    クリア
                  </Button>
                  <Button onClick={handleAiNormalize} disabled={drawing.length < 6} style={{ flex: 1 }}>
                    AIで整形
                  </Button>
                </div>
              </div>

              <div
                ref={boardRef}
                style={{ ...S.drawBox, height: isMobile ? "52vh" : "60vh" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <svg viewBox={`0 0 ${DRAW_W} ${DRAW_H}`} style={S.svgBox}>
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="url(#grid)" />
                  {drawing.length > 1 ? <polyline fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polylineString(drawing)} /> : null}
                </svg>
                {!drawing.length && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", textAlign: "center", padding: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>ここに形を手書き</div>
                      <div style={{ fontSize: 14 }}>閉じた形を一周すると整形しやすいです</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div>
                <div style={S.sectionTitle}>設定</div>
                <div style={S.sub}>現場に合わせてピッチを修正できます</div>
              </div>
              <div style={{ ...S.softBox, marginTop: 12, marginBottom: 12 }}>少数なし / 単位はすべてカタカナのミリ / 保存データは右上から確認編集</div>
              <div style={{ display: "grid", gridTemplateColumns: twoFieldCol, gap: 12 }}>
                <Field label="チャンネルピッチ" suffix="ミリ">
                  <IntInput value={String(settings.channelPitch)} onChange={(v) => setSettings((s) => ({ ...s, channelPitch: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="ダブルバーピッチ" suffix="ミリ">
                  <IntInput value={String(settings.doubleBarPitch)} onChange={(v) => setSettings((s) => ({ ...s, doubleBarPitch: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="シングルバーピッチ" suffix="ミリ">
                  <IntInput value={String(settings.singleBarPitch)} onChange={(v) => setSettings((s) => ({ ...s, singleBarPitch: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="端部から中心" suffix="ミリ">
                  <IntInput value={String(settings.edgeToCenter)} onChange={(v) => setSettings((s) => ({ ...s, edgeToCenter: roundInt(Number(v || 0)) }))} />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: stepTwoCol }}>
            <Card>
              <div style={{ ...S.rowBetween, marginBottom: 12 }}>
                <div>
                  <div style={S.sectionTitle}>2ページ目 整形と記号</div>
                  <div style={S.sub}>読み取った辺に A から順に記号を付けています</div>
                </div>
                <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                  <Button variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                    戻る
                  </Button>
                  <Button onClick={handleGoResult} style={{ flex: 1 }}>
                    結果へ
                  </Button>
                </div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, overflow: "hidden", background: "#f8fafc" }}>
                <svg viewBox={`0 0 ${DRAW_W} ${DRAW_H}`} style={{ width: "100%", height: isMobile ? "42vh" : "60vh", minHeight: 280, display: "block" }}>
                  <defs>
                    <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="url(#grid2)" />
                  {shape ? <polygon points={polylineString(shape)} fill="#dbeafe" stroke="#111827" strokeWidth="4" /> : null}
                  {edges.map((edge) => (
                    <g key={edge.label}>
                      <circle cx={edge.mid.x} cy={edge.mid.y} r="16" fill="#111827" />
                      <text x={edge.mid.x} y={edge.mid.y + 5} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="700">
                        {edge.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </Card>

            <Card>
              <div style={{ marginBottom: 12 }}>
                <div style={S.sectionTitle}>寸法入力</div>
                <div style={S.sub}>整数のみ。単位はすべてミリ</div>
              </div>
              <div style={{ maxHeight: isMobile ? "none" : "48vh", overflow: "auto", display: "grid", gap: 12, gridTemplateColumns: twoFieldCol, marginBottom: 12 }}>
                {edges.map((edge) => (
                  <div key={edge.label} style={S.dimCard}>
                    <div style={{ ...S.rowBetween, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>{edge.label}</div>
                      <div style={S.small}>{edge.dir === "R" || edge.dir === "L" ? "横" : "縦"}</div>
                    </div>
                    <IntInput value={dims[edge.label] || ""} onChange={(v) => setDims((d) => ({ ...d, [edge.label]: v }))} />
                    <div style={{ ...S.small, marginTop: 4 }}>ミリ</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: twoFieldCol, gap: 12 }}>
                <Field label="チャンネル方向">
                  <select value={settings.channelDirection} onChange={(e) => setSettings((s) => ({ ...s, channelDirection: e.target.value }))} style={S.input}>
                    <option value="horizontal">横流し</option>
                    <option value="vertical">縦流し</option>
                  </select>
                </Field>
                <Field label="吊りボルト長さ" suffix="ミリ">
                  <IntInput value={String(settings.boltLength)} onChange={(v) => setSettings((s) => ({ ...s, boltLength: roundInt(Number(v || 0)) }))} />
                </Field>
              </div>

              {!dimsComplete ? <div style={{ ...S.errorBox, marginTop: 12 }}>未入力の辺があります。結果は概算です。</div> : null}
            </Card>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: stepThreeCol }}>
            <Card>
              <div style={{ ...S.rowBetween, marginBottom: 12 }}>
                <div>
                  <div style={S.sectionTitle}>3ページ目 結果</div>
                  <div style={S.sub}>保存できます</div>
                </div>
                <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                  <Button variant="secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>
                    戻る
                  </Button>
                  <Button onClick={saveRecord} style={{ flex: 1 }}>
                    保存
                  </Button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: twoFieldCol, gap: 12, marginBottom: 12 }}>
                <Field label="チャンネル材長" suffix="ミリ">
                  <IntInput value={String(settings.channelStock)} onChange={(v) => setSettings((s) => ({ ...s, channelStock: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="ダブルバー材長" suffix="ミリ">
                  <IntInput value={String(settings.doubleBarStock)} onChange={(v) => setSettings((s) => ({ ...s, doubleBarStock: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="シングルバー材長" suffix="ミリ">
                  <IntInput value={String(settings.singleBarStock)} onChange={(v) => setSettings((s) => ({ ...s, singleBarStock: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="ビス本数 1枚当たり">
                  <IntInput value={String(settings.screwPerBoard)} onChange={(v) => setSettings((s) => ({ ...s, screwPerBoard: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="ボード幅" suffix="ミリ">
                  <IntInput value={String(settings.boardW)} onChange={(v) => setSettings((s) => ({ ...s, boardW: roundInt(Number(v || 0)) }))} />
                </Field>
                <Field label="ボード長さ" suffix="ミリ">
                  <IntInput value={String(settings.boardH)} onChange={(v) => setSettings((s) => ({ ...s, boardH: roundInt(Number(v || 0)) }))} />
                </Field>
              </div>

              <div style={{ ...S.softBox, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>入力形状</div>
                <svg viewBox={`0 0 ${DRAW_W} ${DRAW_H}`} style={{ width: "100%", height: isMobile ? 220 : 260, background: "#fff", borderRadius: 16 }}>
                  {shape ? <polygon points={polylineString(shape)} fill="#dbeafe" stroke="#111827" strokeWidth="4" /> : null}
                  {edges.map((edge) => (
                    <g key={edge.label}>
                      <circle cx={edge.mid.x} cy={edge.mid.y} r="14" fill="#111827" />
                      <text x={edge.mid.x} y={edge.mid.y + 5} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">
                        {edge.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </Card>

            <Card>
              <div style={{ ...S.sectionTitle, marginBottom: 12 }}>資材結果</div>
              {report?.error ? <div style={{ ...S.errorBox, marginBottom: 12 }}>{report.error}</div> : null}
              {!canShowResult ? <div style={S.errorBox}>先に形を作成してください</div> : null}
              <div style={{ display: "grid", gap: 10 }}>
                {(report?.items || []).map((item) => (
                  <div key={item.name} style={S.resultItem}>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ marginTop: 4, lineHeight: 1.6 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {drawerOpen ? <div style={S.drawerBg} onClick={() => setDrawerOpen(false)} /> : null}
      <div style={{ ...S.drawer, transform: drawerOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.2s ease" }}>
        <div style={S.drawerHead}>
          <div style={{ ...S.rowBetween, marginBottom: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>保存データ</div>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              閉じる
            </Button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="検索" style={S.input} />
        </div>
        <div style={S.drawerBody}>
          <Button
            variant="secondary"
            onClick={() => {
              setDrawerOpen(false);
              resetAll();
            }}
          >
            新規作成
          </Button>
          {filteredRecords.length ? (
            filteredRecords.map((record) => (
              <div key={record.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{record.projectName || "案件"}</div>
                <div style={{ ...S.small, marginTop: 4 }}>{formatDateTime(record.updatedAt)}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button variant="secondary" style={{ flex: 1 }} onClick={() => loadRecord(record)}>
                    確認編集
                  </Button>
                  <Button variant="danger" style={{ flex: 1 }} onClick={() => deleteRecord(record.id)}>
                    削除
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 16, padding: 24, textAlign: "center", color: "#98a2b3" }}>
              保存データはまだありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}