// V44_CORE_SPLIT_STRADDLE_RULES_DIMENSION_LABELS
// V46_EDGE_TO_SECOND_W_LINKED_TO_CORE_MODE
// V51_227W455_EDGE_SINGLE_REMOVE_FRAMES
// 303(w1820) と 227(w455) は変更しない。
// 303(w910) の芯跨ぎだけ、中心±455mmをダブル基準にして303ピッチで配置する。
// 303(w1820) と 364(w1820) は芯割り/芯跨ぎを使わず、左上基準の従来計算にする。
// V47_EDGE_TO_SECOND_W_CORE_SPLIT_180_FORMULA
// 芯割り: 端部→2本目W = 端部から最初の内側Wまで（例 4000/W455 = 180mm）
// 芯跨ぎ: 端部→2本目W = 中心跨ぎW割付（例 4000/W455 = 407.5mm）
// V55_NO_ANGLED_FRAMES_NO_LINE_SHAPE_FIX
// V54_SIDE_CONTROLS_IN_GRAY_AREA_FIX
// 右側の寸法表示と芯割り/芯跨ぎボタンを、図形右側の指定位置に固定する。
// 端部バーは全設定で必ずダブルバー。
// 結果ページ右側の寸法表示と芯割り/芯跨ぎボタンは上下に分けて固定表示する。
// V24_CHANNEL_UNIFIED_SINGLE_SOURCE
import { useEffect, useRef, useState } from "react";
import "./App.css";

// V43_CORE_SPLIT_STRADDLE_DIMENSION_LABELS
// バー材も「線を作る → 線を描く → 線から本数結果を出す」に統一
// 青線を作る → 青線上にだけボルトを置く → 青線から結果を出す。
// ボルトはCチャンネル本体の端から100mmを基準にし、500mm補強で伸ばしただけの端には置かない。

// 2026-06-24: saved detail view base + no-overlap labels + A starts at top-left edge clockwise

// 安定版：入力中の自動計算を止め、onBlur/OK時だけ自動補完します。

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const defaultPoints = [
  { x: 70, y: 50 },
  { x: 210, y: 50 },
  { x: 210, y: 190 },
  { x: 70, y: 190 },
];

const barPitchOptions = [
  { pitch: 303, w: 1820, name: "基本" },
  { pitch: 227, w: 455, name: "1.5×3ジプトーン" },
  { pitch: 303, w: 910, name: "3×3ジプトーン" },
  { pitch: 364, w: 1820, name: "岩綿" },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [page, setPage] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [shape, setShape] = useState(makeShape(defaultPoints));
  const [dims, setDims] = useState({});

  const [settings, setSettings] = useState({
    barPitch: 303,
    barW: 1820,
    barType: "基本",
    bisPitch: 303,
    boardPer: 1,
    finish: "岩綿",
    glassWool: "無し",
    // 芯割=中心をダブル、芯股ぎ=中心をシングル。基本は芯割。
    centerBarType: "double",
  });
  const [showSavedRooms, setShowSavedRooms] = useState(false);
  const [savedRooms, setSavedRooms] = useState([]);
  const [selectedSavedRoom, setSelectedSavedRoom] = useState(null);

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const pointsRef = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 0);

    return () => clearTimeout(timer);
  }, [page]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [page]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;

    return {
      x: p.clientX - rect.left,
      y: p.clientY - rect.top,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    pointsRef.current = [];

    const p = getPoint(e);
    pointsRef.current.push(p);

    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();

    const p = getPoint(e);
    const arr = pointsRef.current;
    const last = arr[arr.length - 1];

    if (!last || distance(last, p) > 5) {
      arr.push(p);
    }

    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    pointsRef.current = [];
  };

  const aiCleanShape = () => {
    const cleaned = cleanHandShape(pointsRef.current);
    const made = makeShape(cleaned);

    const nextDims = {};
    made.edges.forEach((e) => {
      nextDims[e.key] = "";
    });

    setShape(made);
    setDims(nextDims);
    setPage(2);
  };

  const changeDim = (key, value) => {
    // 入力中は、その欄だけを更新する。
    // 他の辺の自動計算は onBlur または OK の時だけ行うので、
    // 「1 → 16 → 160 → 1600」の途中で別の数字が一瞬バグらない。
    setDims((prev) => ({
      ...prev,
      [key]: onlyNumber(value),
    }));
  };

  const runAutoFill = () => {
    setDims((prev) => {
      const fixed = { ...prev };
      autoFillDims(fixed, shape.edges);
      return fixed;
    });
  };

  const goToResults = () => {
    const fixed = { ...dims };
    autoFillDims(fixed, shape.edges);
    setDims(fixed);

    const missingKeys = getMissingDimKeys(fixed, shape.edges);
    if (missingKeys.length) {
      alert(`未入力の寸法があります：${missingKeys.join("、")}`);
      return;
    }

    setPage(3);
  };

  const results = makeResults(dims, settings, shape);

  const loadSavedRooms = () => {
    const rooms = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("ceiling-")) continue;

      try {
        const data = JSON.parse(localStorage.getItem(key));
        rooms.push({ key, ...data });
      } catch {
        // 壊れた保存データは無視
      }
    }

    return rooms.sort((a, b) => String(b.key).localeCompare(String(a.key)));
  };

  const openSavedRooms = () => {
    setSelectedSavedRoom(null);
    setSavedRooms(loadSavedRooms());
    setShowSavedRooms(true);
  };

  const deleteSavedRoom = (key) => {
    if (!confirm("この保存データを削除しますか？")) return;
    localStorage.removeItem(key);
    setSavedRooms(loadSavedRooms());
  };

  const renameSavedRoom = (key, currentName = "") => {
    const nextName = prompt("新しい部屋名を入力してください", currentName || "未入力");
    if (nextName === null) return;

    const cleanName = nextName.trim() || "未入力";

    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data) return;

      data.name = cleanName;
      localStorage.setItem(key, JSON.stringify(data));

      const rooms = loadSavedRooms();
      setSavedRooms(rooms);
      setSelectedSavedRoom((prev) =>
        prev && prev.key === key ? { ...prev, name: cleanName } : prev
      );
    } catch {
      alert("名称変更に失敗しました");
    }
  };

  const saveData = () => {
    const data = {
      name: projectName || "未入力",
      dims,
      settings,
      shape,
      results,
      savedAt: new Date().toLocaleString(),
    };

    localStorage.setItem(`ceiling-${Date.now()}`, JSON.stringify(data));
    setSavedRooms(loadSavedRooms());
    alert("保存しました");
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="app">
      <Header title={page === 3 ? "" : "天井の形を入力してください"} onMenuClick={openSavedRooms} />

      {page === 1 && (
        <main className="page">
          <div className="topButtons right">
            <button className="primary" onClick={aiCleanShape}>
              ✓ OK
            </button>
            <button className="outline" onClick={clearCanvas}>
              🗑 クリア
            </button>
          </div>

          <section className="canvasBox">
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </section>

          <h2 className="sectionTitle">設定カスタム</h2>

          <section className="settingCard">
            <BarPitchSelector settings={settings} setSettings={setSettings} />
          </section>
        </main>
      )}

      {page === 2 && (
        <main className="page dimensionPage">
          <CleanShape shape={shape} />

          <section className="dimensionList">
            {shape.edges.map((edge) => (
              <div className="dimRow" key={edge.key}>
                <div className="dimLabel">{edge.key}</div>
                <input
                  inputMode="numeric"
                  value={dims[edge.key] || ""}
                  onChange={(e) => changeDim(edge.key, e.target.value)}
                  onBlur={runAutoFill}
                />
                <span>ミリ</span>
              </div>
            ))}
          </section>

          <div className="pageNavButtons">
            <button className="backBtn" onClick={() => setPage(1)}>
              手書き入力に戻る
            </button>
            <button className="bottomOk" onClick={goToResults}>
              OK
            </button>
          </div>
        </main>
      )}

      {page === 3 && (
        <main className="page resultPage">
          <div
            className="resultShapeControlRow"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minHeight: !isLeftTopBarSetting(settings) ? 315 : undefined,
              marginBottom: 12,
              overflow: "visible",
            }}
          >
            <CleanShape
              shape={shape}
              small
              dims={dims}
              settings={settings}
              showValues
              showBoltDots
              showChannelLines
              showBarLines
              showBarDimensionLabels={false}
            />

            {!isLeftTopBarSetting(settings) && (
              <div
                className="resultSideControls"
                style={{
                  position: "absolute",
                  left: "calc(50% + 205px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 16,
                  minWidth: 190,
                  maxWidth: 230,
                  zIndex: 3,
                }}
              >
                <div
                  className="barDimensionTextList"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 12,
                    fontSize: 12.5,
                    fontWeight: 900,
                    color: "#334155",
                    lineHeight: 1.45,
                    whiteSpace: "nowrap",
                  }}
                >
                  {getResultBarDimensionTexts(dims, shape, settings).map((text) => (
                    <div key={text}>{text}</div>
                  ))}
                </div>
                <CenterBarTypeToggle settings={settings} setSettings={setSettings} compact />
              </div>
            )}
          </div>

          <section className="resultCard">
            {results.map((item) => (
              <div className="resultRow" key={item.name}>
                <strong>{item.name}</strong>
                <span className="resultValue">
                  {splitResultValue(item.value).map((part, index) => (
                    <span className="resultPart" key={`${item.name}-${index}`}>
                      {part}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </section>

          <section className="saveCard">
            <label>名前を付けて保存</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="例：事務所 A 天井"
            />
            <button className="saveBtn" onClick={saveData}>
              💾 保存
            </button>
          </section>

          <div className="pageNavButtons">
            <button className="backBtn" onClick={() => setPage(2)}>
              寸法入力に戻る
            </button>
            <button className="backBtn" onClick={() => setPage(1)}>
              最初に戻る
            </button>
          </div>
        </main>
      )}

      {showSavedRooms && (
        <SavedRoomsPanel
          rooms={savedRooms}
          onClose={() => setShowSavedRooms(false)}
          onDelete={deleteSavedRoom}
          onRename={renameSavedRoom}
          onOpen={(room) => setSelectedSavedRoom(room)}
        />
      )}

      {selectedSavedRoom && (
        <SavedRoomDetail
          room={selectedSavedRoom}
          onClose={() => setSelectedSavedRoom(null)}
          onRename={renameSavedRoom}
        />
      )}
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="splashPhoto" />
  );
}

function Header({ title, onMenuClick }) {
  return (
    <header className="header">
      <div className="spacer" />
      <h1>{title}</h1>
      <button className="menu" onClick={onMenuClick}>☰</button>
    </header>
  );
}

function BarPitchSelector({ settings, setSettings }) {
  const [open, setOpen] = useState(false);

  const selectOption = (option) => {
    const leftTopBased = isLeftTopBarSetting({
      barPitch: option.pitch,
      barW: option.w,
    });

    setSettings({
      ...settings,
      barPitch: option.pitch,
      barW: option.w,
      barType: option.name,
      bisPitch: option.pitch,
      // 303(w1820) と 364(w1820) は芯割り/芯跨ぎを使わないので、
      // 内部状態は基本の芯割りへ戻しておく。
      centerBarType: leftTopBased ? "double" : settings.centerBarType || "double",
    });
    setOpen(false);
  };

  return (
    <div className="barPitchBox">
      <button className="barPitchMain" onClick={() => setOpen(!open)}>
        <span>バーピッチ</span>
        <strong>{settings.barPitch}(w{settings.barW || 1820})</strong>
        <small>{settings.barType || "基本"}</small>
      </button>

      {open && (
        <div className="barPitchOptions">
          {barPitchOptions.map((option) => (
            <button
              key={`${option.pitch}-${option.w}-${option.name}`}
              className={
                settings.barPitch === option.pitch &&
                settings.barW === option.w &&
                settings.barType === option.name
                  ? "barPitchOption active"
                  : "barPitchOption"
              }
              onClick={() => selectOption(option)}
            >
              <strong>{option.pitch}(w{option.w})</strong>
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getResultBarDimensionTexts(dims, shape, settings) {
  if (isLeftTopBarSetting(settings)) return [];

  const polygonPoints = buildPolygonFromDims(dims, shape);
  if (!polygonPoints) return [];

  const plan = makeBarPlan(polygonPoints, settings);
  return (plan.dimensionLabels || []).map((label) => label.text);
}

function CenterBarTypeToggle({ settings, setSettings, compact = false }) {
  const isMatagi = settings.centerBarType === "single";

  const select = (type) => {
    setSettings({
      ...settings,
      centerBarType: type,
    });
  };

  const buttonStyle = (active) => ({
    border: active ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
    background: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#0f172a",
    borderRadius: 999,
    padding: compact ? "4px 8px" : "6px 12px",
    fontWeight: 900,
    fontSize: compact ? 11 : 13,
    lineHeight: 1,
    minWidth: compact ? 46 : 58,
    minHeight: compact ? 24 : 30,
    cursor: "pointer",
  });

  return (
    <section
      className={compact ? "" : "settingCard"}
      style={{
        marginTop: compact ? 0 : 8,
        marginBottom: compact ? 0 : 8,
        padding: compact ? 0 : "8px 10px",
        background: "transparent",
        border: compact ? "none" : undefined,
        boxShadow: compact ? "none" : undefined,
        flex: "0 0 auto",
      }}
    >
      <div style={{ display: "flex", gap: compact ? 6 : 8, alignItems: "center" }}>
        <button
          type="button"
          style={buttonStyle(!isMatagi)}
          onClick={() => select("double")}
        >
          芯割り
        </button>
        <button
          type="button"
          style={buttonStyle(isMatagi)}
          onClick={() => select("single")}
        >
          芯跨ぎ
        </button>
      </div>
    </section>
  );
}

function SavedRoomsPanel({ rooms, onClose, onDelete, onRename, onOpen }) {
  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer">
        <div className="drawerHeader">
          <strong>保存した部屋</strong>
          <button onClick={onClose}>×</button>
        </div>

        {!rooms.length && <p className="emptySaved">保存データはまだありません。</p>}

        <div className="savedList">
          {rooms.map((room) => (
            <div className="savedItem compact" key={room.key}>
              <button className="savedOpenBtn" onClick={() => onOpen(room)}>
                <strong>{room.name || "未入力"}</strong>
                <small>{room.savedAt || "日時なし"}</small>
                <span>詳細を見る</span>
              </button>

              <div className="savedActions">
                <button
                  className="renameSavedBtn"
                  onClick={() => onRename(room.key, room.name)}
                >
                  名称変更
                </button>
                <button className="deleteSavedBtn" onClick={() => onDelete(room.key)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function SavedRoomDetail({ room, onClose, onRename }) {
  const roomShape = room.shape;
  const roomDims = room.dims || {};
  const roomResults = finalizeResultList(room.results || []);

  return (
    <div className="detailOverlay">
      <main className="savedDetailPage">
        <div className="detailHeader">
          <div>
            <strong>{room.name || "未入力"}</strong>
            <small>{room.savedAt || "日時なし"}</small>
          </div>
          <div className="detailHeaderActions">
            <button
              className="detailRenameBtn"
              onClick={() => onRename(room.key, room.name)}
            >
              名称変更
            </button>
            <button className="detailCloseBtn" onClick={onClose}>×</button>
          </div>
        </div>

        {roomShape && (
          <CleanShape shape={roomShape} small dims={roomDims} settings={room.settings || {}} showValues showBoltDots showChannelLines showBarLines />
        )}

        <section className="resultCard detailResultCard">
          {roomResults.map((item) => (
            <div className="resultRow" key={`detail-${item.name}`}>
              <strong>{item.name}</strong>
              <span className="resultValue">
                {splitResultValue(item.value).map((part, index) => (
                  <span className="resultPart" key={`${item.name}-${index}`}>
                    {part}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function getMissingDimKeys(dims, edges) {
  return edges
    .filter((edge) => !Number(dims[edge.key]))
    .map((edge) => edge.key);
}

function splitResultValue(value) {
  return String(value)
    .split(/　|\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function CleanShape({
  shape,
  small,
  dims = {},
  settings = {},
  showValues = false,
  showBoltDots = false,
  showChannelLines = false,
  showBarLines = false,
  showBarDimensionLabels = true,
}) {
  const realClosedPoints = showValues ? buildPolygonFromDims(dims, shape) : null;
  const basePoints = realClosedPoints
    ? realClosedPoints.slice(0, -1)
    : shape.points;

  const layout = normalizeLayout(basePoints);
  const pointsText = layout.points.map((p) => `${p.x},${p.y}`).join(" ");
  const polygonForLabels = closePolygon(layout.points);

  let edges = shape.edges.map((edge, index) => {
    const a = layout.points[index];
    const b = layout.points[(index + 1) % layout.points.length];

    return {
      ...edge,
      a,
      b,
      label: makeLabel(a, b, edge.axis, index, layout.points),
    };
  });

  // 結果画面では、文字を必ず図形の外側へ出し、辺に平行で一番近い位置に置く。
  edges = placeParallelOutsideLabels(edges, dims, showValues, polygonForLabels);

  // V36: 青線・ボルト・結果は同じ計算データを使う。
  // ここで作った unifiedPlan を、描画と結果表示の両方の元データにする。
  const unifiedPlan = realClosedPoints
    ? makeCeilingChannelPlan(realClosedPoints, dims, shape, 910, 100)
    : { channelLines: [], boltDots: [] };

  const barPlan = realClosedPoints
    ? makeBarPlan(realClosedPoints, settings)
    : { doubleLines: [], singleLines: [], dimensionLabels: [] };

  const boltDots = showBoltDots ? unifiedPlan.boltDots : [];
  const viewBoltDots = boltDots.map(layout.mapPoint);
  const channelLines = showChannelLines
    ? unifiedPlan.channelLines.map((line) => ({
        a: layout.mapPoint(line.a),
        b: layout.mapPoint(line.b),
      }))
    : [];
  const doubleBarLines = showBarLines
    ? barPlan.doubleLines.map((line) => ({
        a: layout.mapPoint(line.a),
        b: layout.mapPoint(line.b),
      }))
    : [];
  const singleBarLines = showBarLines
    ? barPlan.singleLines.map((line) => ({
        a: layout.mapPoint(line.a),
        b: layout.mapPoint(line.b),
      }))
    : [];
  const barDimensionLabels = showBarLines && showBarDimensionLabels
    ? (barPlan.dimensionLabels || []).map((label) => ({
        ...label,
        p: layout.mapPoint(label.p),
      }))
    : [];

  return (
    <div className={`shapeWrap ${small ? "small" : "big"}`}>
      <svg viewBox="0 0 280 220" style={{ overflow: "visible" }}>
        <polygon
          points={pointsText}
          fill="none"
          stroke="#111"
          strokeWidth="5"
          strokeLinejoin="round"
        />

        {singleBarLines.map((line, index) => (
          <line
            key={`single-bar-${index}`}
            x1={line.a.x}
            y1={line.a.y}
            x2={line.b.x}
            y2={line.b.y}
            stroke="#2563eb"
            strokeWidth={small ? 1.7 : 2.6}
            strokeLinecap="round"
            opacity="0.78"
          />
        ))}

        {doubleBarLines.map((line, index) => (
          <line
            key={`double-bar-${index}`}
            x1={line.a.x}
            y1={line.a.y}
            x2={line.b.x}
            y2={line.b.y}
            stroke="#dc2626"
            strokeWidth={small ? 2.1 : 3.0}
            strokeLinecap="round"
            opacity="0.88"
          />
        ))}

        {channelLines.map((line, index) => (
          <line
            key={`channel-${index}`}
            x1={line.a.x}
            y1={line.a.y}
            x2={line.b.x}
            y2={line.b.y}
            stroke="#facc15"
            strokeWidth={small ? 2.4 : 3.4}
            strokeLinecap="round"
            opacity="0.96"
          />
        ))}

        {viewBoltDots.map((p, index) => (
          <circle
            key={`bolt-${index}`}
            cx={p.x}
            cy={p.y}
            r={small ? 3.2 : 4.6}
            fill="#111"
          />
        ))}

        {barDimensionLabels.map((label, index) => (
          <text
            key={`bar-dim-${index}`}
            x={label.p.x}
            y={label.p.y}
            textAnchor={label.anchor || "start"}
            dominantBaseline="middle"
            style={{
              fontSize: small ? 5.7 : 8.2,
              fontWeight: 900,
              paintOrder: "stroke",
              stroke: "white",
              strokeWidth: small ? 1.6 : 2.3,
              fill: "#334155",
            }}
          >
            {label.text}
          </text>
        ))}

        {edges.map((edge) => {
          const value = dims[edge.key];
          const labelValue = showValues && value ? String(value) : "";

          return (
            <text
              key={edge.key}
              x={edge.label.x}
              y={edge.label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: showValues ? 4.6 : 10.2,
                fontWeight: 900,
                paintOrder: "stroke",
                stroke: "white",
                strokeWidth: showValues ? 1.05 : 3.0,
                fill: "#111827",
                letterSpacing: 0,
              }}
            >
              {renderEdgeLabel(edge, labelValue, showValues)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function renderEdgeLabel(edge, value, showValues) {
  if (!showValues || !value) return edge.key;

  // 縦辺は辺と平行に縦表示。イコールは縦向きの「‖」を使う。
  if (edge.axis === "V") {
    const chars = [edge.key, "‖", ...String(value).split("")];
    const step = 5.2;
    const firstDy = -((chars.length - 1) * step) / 2;

    return chars.map((ch, index) => (
      <tspan
        key={`${edge.key}-${index}`}
        x={edge.label.x}
        dy={index === 0 ? firstDy : step}
      >
        {ch}
      </tspan>
    ));
  }

  return `${edge.key}=${value}`;
}

function placeParallelOutsideLabels(edges, dims, showValues, polygonPoints) {
  const view = { minX: -8, maxX: 288, minY: -8, maxY: 228 };
  // 縦ラベルのアルファベットが切れないように少し小さくする。
  const font = showValues ? 4.6 : 9.6;
  const vStep = showValues ? 5.2 : 8.6;
  const gap = 0.45;

  const valueOf = (edge) =>
    showValues && dims[edge.key] ? String(dims[edge.key]) : "";

  const labelText = (edge) => {
    const value = valueOf(edge);
    return showValues && value ? `${edge.key}=${value}` : edge.key;
  };

  const boxOf = (edge, point) => {
    const value = valueOf(edge);

    if (edge.axis === "V" && showValues && value) {
      const count = [edge.key, "‖", ...String(value).split("")].length;
      const w = font + 2.5;
      const h = count * vStep + 1.2;
      return {
        left: point.x - w / 2,
        right: point.x + w / 2,
        top: point.y - h / 2,
        bottom: point.y + h / 2,
      };
    }

    const text = labelText(edge);
    const w = text.length * font * 0.53 + 2.5;
    const h = font + 2.8;
    return {
      left: point.x - w / 2,
      right: point.x + w / 2,
      top: point.y - h / 2,
      bottom: point.y + h / 2,
    };
  };

  const inflate = (box, amount = gap) => ({
    left: box.left - amount,
    right: box.right + amount,
    top: box.top - amount,
    bottom: box.bottom + amount,
  });

  const overlaps = (a, b) =>
    !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

  const inView = (box) =>
    box.left >= view.minX &&
    box.right <= view.maxX &&
    box.top >= view.minY &&
    box.bottom <= view.maxY;

  const clampPointForBox = (point, box) => {
    let x = point.x;
    let y = point.y;
    if (box.left < view.minX) x += view.minX - box.left;
    if (box.right > view.maxX) x -= box.right - view.maxX;
    if (box.top < view.minY) y += view.minY - box.top;
    if (box.bottom > view.maxY) y -= box.bottom - view.maxY;
    return { x, y };
  };

  const boxIsOutsidePolygon = (box) => {
    // 文字枠の中心と四隅が図形内に入らないことを条件にする。
    const samples = [
      { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 },
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
      { x: box.left, y: box.bottom },
      { x: box.right, y: box.bottom },
    ];

    return samples.every((p) => !pointInPolygon(p, polygonPoints));
  };

  const makeCandidates = (edge) => {
    const base = edge.label;
    const normal = base.normal || { x: 0, y: -1 };
    const tangent = base.tangent || { x: 1, y: 0 };
    const len = Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y);
    const short = len < 42;

    // 「辺に一番近い」を最優先。
    // 文字が重なる時は、横へ大きく逃がさず、まず外側方向へ逃がす。
    const normalSteps = short
      ? [0, 1, 2, 3, 4, 6, 8, 11, 15, 20, 26, 34, 44]
      : [0, 1, 2, 3, 5, 8, 12, 17, 23, 31, 40];

    const tangentSteps = short
      ? [0, -1.5, 1.5, -3, 3, -5, 5, -8, 8, -12, 12]
      : [0, -2, 2, -4, 4, -7, 7, -11, 11, -16, 16];

    const candidates = [];
    normalSteps.forEach((n) => {
      tangentSteps.forEach((t) => {
        candidates.push({
          x: base.baseX + normal.x * n + tangent.x * t,
          y: base.baseY + normal.y * n + tangent.y * t,
        });
      });
    });

    return candidates;
  };

  const out = edges.map((edge, index) => ({
    ...edge,
    originalIndex: index,
    label: { ...edge.label },
  }));

  const placed = [];

  // 短い辺ほど先に確定させる。
  const order = out
    .map((edge, index) => ({
      index,
      len: Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y),
    }))
    .sort((a, b) => a.len - b.len)
    .map((item) => item.index);

  order.forEach((edgeIndex) => {
    const edge = out[edgeIndex];
    let best = edge.label;
    let bestScore = Infinity;

    for (const raw of makeCandidates(edge)) {
      const rawBox = boxOf(edge, raw);
      const point = inView(rawBox) ? raw : clampPointForBox(raw, rawBox);
      const box = inflate(boxOf(edge, point));

      const hitText = placed.some((p) => overlaps(box, p.box));
      const outside = boxIsOutsidePolygon(box);
      const dx = point.x - edge.label.baseX;
      const dy = point.y - edge.label.baseY;
      const normalMove = Math.abs(
        dx * (edge.label.normal?.x || 0) + dy * (edge.label.normal?.y || 0)
      );
      const tangentMove = Math.abs(
        dx * (edge.label.tangent?.x || 0) + dy * (edge.label.tangent?.y || 0)
      );

      // 横方向へ逃げると「どの辺の寸法か分かりにくい」ため強く減点。
      // 外側へ少し逃げる方を優先する。
      const score =
        normalMove * 2.2 +
        tangentMove * 9.5 +
        (outside ? 0 : 5000) +
        (hitText ? 12000 : 0);

      if (score < bestScore) {
        bestScore = score;
        best = point;
      }

      if (outside && !hitText) {
        best = point;
        break;
      }
    }

    edge.label.x = Math.round(best.x * 10) / 10;
    edge.label.y = Math.round(best.y * 10) / 10;
    placed.push({ index: edgeIndex, box: inflate(boxOf(edge, edge.label), 1.0) });
  });

  return out;
}

function cleanHandShape(points) {
  if (!points || points.length < 6) return defaultPoints;

  const cleaned = simplifyToOrthogonal(points);
  if (!cleaned) return makeBoxFromPoints(points);

  let open = cleaned.slice(0, -1);
  if (open.length < 4) return makeBoxFromPoints(points);

  // ここで必ず水平・垂直だけの図形にする。
  // 手書きのブレで斜め線が残っても、この段階で消す。
  open = hardOrthogonalizeOpen(open);

  if (screenArea(open) < 0) open = open.reverse();

  return rotateFromTopLeft(hardOrthogonalizeOpen(open));
}

function hardOrthogonalizeOpen(points) {
  if (!points || points.length < 3) return points || [];

  // 1) 閉じた形として扱い、重複点を削除
  let out = closePolygon(points)
    .slice(0, -1)
    .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

  if (out.length < 3) return out;

  // 2) 近いX/Yを同じ座標に寄せる
  out = snapCloseAxisValuesClosed(closePolygon(out), 30).slice(0, -1);

  // 3) 全ての辺を強制的に水平・垂直へ補正
  //    斜め辺が出たら、長く動いている方向を残し、もう片方の座標を揃える。
  let guard = 0;
  let changed = true;

  while (changed && guard < 12) {
    changed = false;
    guard += 1;

    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;

      if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          b.y = a.y;
        } else {
          b.x = a.x;
        }
        changed = true;
      }
    }

    out = closePolygon(out);
    out = snapCloseAxisValuesClosed(out, 30);
    out = removeTinySegmentsClosed(out, 24);
    out = mergeCollinearClosed(out, 3);
    out = out.slice(0, -1);
  }

  // 4) 念のため、まだ斜めが残る場合はL字の角を追加して斜め線を分解する
  const fixed = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = out[(i + 1) % out.length];
    fixed.push({ ...a });

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        fixed.push({ x: b.x, y: a.y });
      } else {
        fixed.push({ x: a.x, y: b.y });
      }
    }
  }

  let finalPoints = closePolygon(fixed);
  finalPoints = removeTinySegmentsClosed(finalPoints, 24);
  finalPoints = mergeCollinearClosed(finalPoints, 3);
  finalPoints = snapCloseAxisValuesClosed(finalPoints, 30);
  // V52: 最後にもう一度、完全に水平・垂直だけにする。
  // ここを通すことで、手書き補正後に斜め辺が残らない。
  finalPoints = forceOrthogonalClosed(finalPoints);
  finalPoints = removeTinySegmentsClosed(finalPoints, 12);
  finalPoints = mergeCollinearClosed(finalPoints, 2);

  return finalPoints.slice(0, -1);
}

function simplifyToOrthogonal(rawPoints) {
  let pts = dedupeNeighbors(rawPoints, 8);
  if (pts.length < 4) return null;

  pts = closePolygon(pts);

  let epsilon = 14;
  let simplified = rdp(pts, epsilon);

  while (simplified.length - 1 > 26 && epsilon < 72) {
    epsilon += 6;
    simplified = rdp(pts, epsilon);
  }

  simplified = closePolygon(dedupeNeighbors(simplified, 10));
  if (simplified.length < 4) return null;

  // 斜めや尖りを残さない。最後の閉じ線まで必ず水平・垂直にする。
  let cleaned = forceOrthogonalClosed(simplified);
  cleaned = snapCloseAxisValuesClosed(cleaned, 22);
  cleaned = removeTinySegmentsClosed(cleaned, 28);
  cleaned = mergeCollinearClosed(cleaned, 20);
  cleaned = forceOrthogonalClosed(cleaned);
  cleaned = removeSharpSpikesClosed(cleaned, 26);
  cleaned = snapCloseAxisValuesClosed(cleaned, 22);
  cleaned = removeTinySegmentsClosed(cleaned, 28);
  cleaned = mergeCollinearClosed(cleaned, 20);
  cleaned = forceOrthogonalClosed(cleaned);

  return cleaned.length >= 5 ? cleaned : null;
}

function forceOrthogonalClosed(points) {
  if (!points || points.length < 4) return points;

  const source = closePolygon(points).slice(0, -1);
  if (source.length < 3) return closePolygon(source);

  const out = [{ ...source[0] }];

  for (let i = 1; i < source.length; i++) {
    const prev = out[out.length - 1];
    const next = source[i];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      out.push({ x: next.x, y: prev.y });
    } else {
      out.push({ x: prev.x, y: next.y });
    }
  }

  // 最後の辺が斜めにならないよう、始点に対して最後の点を補正する。
  const first = out[0];
  const last = out[out.length - 1];
  const closeDx = first.x - last.x;
  const closeDy = first.y - last.y;

  if (Math.abs(closeDx) < Math.abs(closeDy)) {
    last.x = first.x;
  } else {
    last.y = first.y;
  }

  return closePolygon(dedupeNeighbors(out, 6));
}

function removeSharpSpikesClosed(points, minLeg = 26) {
  if (!points || points.length < 5) return points;

  let out = closePolygon(points).slice(0, -1);
  let changed = true;

  while (changed && out.length >= 4) {
    changed = false;
    const next = [];

    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const curr = out[i];
      const after = out[(i + 1) % out.length];
      const l1 = distance(prev, curr);
      const l2 = distance(curr, after);

      const tinyCorner = l1 < minLeg && l2 < minLeg;
      const sameXAfterRemove = Math.abs(prev.x - after.x) <= 2;
      const sameYAfterRemove = Math.abs(prev.y - after.y) <= 2;

      if (tinyCorner && (sameXAfterRemove || sameYAfterRemove)) {
        changed = true;
        continue;
      }

      next.push(curr);
    }

    out = next;
  }

  return closePolygon(out);
}

function snapCloseAxisValuesClosed(points, tol = 18) {
  if (!points || points.length < 4) return points;

  const open = closePolygon(points).slice(0, -1);
  const xs = clusterValues(open.map((p) => p.x), tol);
  const ys = clusterValues(open.map((p) => p.y), tol);

  const snapped = open.map((p) => ({
    x: nearestClusterValue(p.x, xs),
    y: nearestClusterValue(p.y, ys),
  }));

  return closePolygon(dedupeNeighbors(snapped, 6));
}

function clusterValues(values, tol = 18) {
  const sorted = values.slice().sort((a, b) => a - b);
  const clusters = [];

  sorted.forEach((value) => {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(value - last.avg) > tol) {
      clusters.push({ values: [value], avg: value });
    } else {
      last.values.push(value);
      last.avg = average(last.values);
    }
  });

  return clusters.map((c) => c.avg);
}

function nearestClusterValue(value, clusters) {
  let best = value;
  let bestDist = Infinity;

  clusters.forEach((c) => {
    const d = Math.abs(value - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });

  return best;
}

function makeShape(points) {
  // V55: 直線だけ・点だけ・高さ/幅がほぼ無い図形は作らない。
  // 2辺だけの「A/Bだけの線図形」が出ないよう、必ず有効な四角形以上にする。
  points = makeValidCeilingShapePoints(points);

  const viewPoints = normalizePoints(points);
  const edges = [];

  for (let i = 0; i < viewPoints.length; i++) {
    const a = viewPoints[i];
    const b = viewPoints[(i + 1) % viewPoints.length];
    const rawA = points[i];
    const rawB = points[(i + 1) % points.length];

    const axis =
      Math.abs(rawA.x - rawB.x) >= Math.abs(rawA.y - rawB.y) ? "H" : "V";

    const sign =
      axis === "H"
        ? Math.sign(rawB.x - rawA.x) || 1
        : Math.sign(rawB.y - rawA.y) || 1;

    edges.push({
      key: letters[i],
      axis,
      sign,
      label: makeLabel(a, b, axis),
    });
  }

  return { points, viewPoints, edges };
}


function makeValidCeilingShapePoints(points) {
  let out = Array.isArray(points) ? points.slice() : [];

  if (out.length < 4) {
    out = makeBoxFromPoints(out);
  } else {
    out = hardOrthogonalizeOpen(out);
  }

  out = closePolygon(out).slice(0, -1);
  out = removeTinySegmentsClosed(closePolygon(out), 8).slice(0, -1);
  out = mergeCollinearClosed(closePolygon(out), 2).slice(0, -1);

  if (!isValidCeilingShape(out)) {
    return defaultPoints.map((p) => ({ ...p }));
  }

  return rotateFromTopLeft(out);
}

function isValidCeilingShape(points) {
  if (!Array.isArray(points) || points.length < 4) return false;

  const closed = closePolygon(points);
  const open = closed.slice(0, -1);
  if (open.length < 4) return false;

  const box = getBox(open);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;

  // 直線・極端につぶれた図形を禁止。
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width < 30 || height < 30) return false;
  if (Math.abs(screenArea(open)) < 900) return false;

  let hCount = 0;
  let vCount = 0;

  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx >= 8 && dy <= 2) hCount += 1;
    if (dy >= 8 && dx <= 2) vCount += 1;
  }

  return hCount >= 2 && vCount >= 2;
}

function normalizeLayout(points) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = Math.min(220 / w, 160 / h);

  const offsetX = (280 - w * scale) / 2;
  const offsetY = (220 - h * scale) / 2;

  const mapPoint = (p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  });

  return {
    points: points.map(mapPoint),
    mapPoint,
  };
}

function normalizePoints(points) {
  return normalizeLayout(points).points;
}

function makeLabel(a, b, axis = "H", index = 0, polygonPoints = []) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  const tangent = { x: dx / len, y: dy / len };
  const n1 = { x: dy / len, y: -dx / len };
  const n2 = { x: -dy / len, y: dx / len };

  // 2つの法線のうち、図形の外側に向く方を選ぶ。
  let normal = n1;
  if (polygonPoints && polygonPoints.length >= 3) {
    const poly = closePolygon(polygonPoints);
    const p1 = { x: mx + n1.x * 10, y: my + n1.y * 10 };
    const p2 = { x: mx + n2.x * 10, y: my + n2.y * 10 };
    const inside1 = pointInPolygon(p1, poly);
    const inside2 = pointInPolygon(p2, poly);

    if (inside1 && !inside2) normal = n2;
    if (!inside1 && inside2) normal = n1;
  }

  // ここは「辺に一番近い外側」の基準位置。
  // 重なった場合だけ placeParallelOutsideLabels 側で外へ逃がす。
  const offset = 0.9;
  const x = mx + normal.x * offset;
  const y = my + normal.y * offset;

  return { x, y, baseX: x, baseY: y, tangent, normal };
}

function rotateFromTopLeft(points) {
  if (!points || points.length < 3) return points;

  // Aは「左上から時計回り」で始める。
  // つまり、いちばん上にある横辺の中で、いちばん左の辺をAにする。
  let best = 0;
  let bestScore = Infinity;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const horizontal = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
    if (!horizontal) continue;

    const topY = Math.min(a.y, b.y);
    const leftX = Math.min(a.x, b.x);
    const length = Math.abs(a.x - b.x);

    // Yを最優先、次に左側。長い辺を少し優先してノイズを避ける。
    const score = topY * 100000 + leftX * 100 - length;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return points.slice(best).concat(points.slice(0, best));
}

function autoFillDims(next, edges) {
  // 図形の閉じ計算で、分かる辺をリアルタイムに自動入力する。
  // H方向：右へ進む合計 = 左へ進む合計
  // V方向：下へ進む合計 = 上へ進む合計
  // 各方向で未入力が1つだけになった時、その1辺を自動計算する。
  let changed = true;
  let guard = 0;

  while (changed && guard < 30) {
    changed = false;
    guard += 1;

    ["H", "V"].forEach((axis) => {
      const targetEdges = edges.filter((e) => e.axis === axis);
      const unknown = targetEdges.filter((e) => !Number(next[e.key]));

      if (unknown.length !== 1) return;

      let total = 0;

      targetEdges.forEach((e) => {
        if (e.key === unknown[0].key) return;
        total += e.sign * (Number(next[e.key]) || 0);
      });

      const answer = -total / unknown[0].sign;

      if (answer > 0) {
        const result = String(Math.round(answer));

        if (next[unknown[0].key] !== result) {
          next[unknown[0].key] = result;
          changed = true;
        }
      }
    });
  }
}

function calcBolt(length) {
  const n = Number(length) || 0;
  if (n <= 200) return 0;
  return Math.floor((n - 200) / 910) + 1;
}

function makeBoltDots(points, pitch = 910, margin = 100, dims = null) {
  return makeCeilingChannelPlan(points, dims || {}, null, pitch, margin).boltDots;
}

function makeCeilingChannelPlan(points, dims = {}, shape = null, pitch = 910, margin = 100) {
  const closed = closePolygon(points || []);
  if (!closed || closed.length < 4) {
    return {
      channelAxis: "H",
      channelLines: [],
      boltDots: [],
      channelValue: "0 本",
      boltCount: 0,
    };
  }

  const longAxis = getBoundingLongAxis(closed);
  const channelAxis = longAxis === "H" ? "V" : "H";

  // V38: 青線・ボルト・結果を1つの計算データから作る。
  // drawLine = 実際に描くCチャンネル
  // boltSpan = ボルトを置く基準線
  // 500mm補強で伸びた部分はdrawLineには含めるが、boltSpanには含めない。
  const planData = makeUnifiedChannelPlanData(closed, channelAxis, pitch, margin);
  const channelLines = planData.channelLines;
  const boltDots = makeBoltDotsFromBoltSpans(
    closed,
    planData.boltSpans,
    channelLines,
    channelAxis,
    pitch,
    margin
  );

  return {
    channelAxis,
    channelLines,
    boltDots,
    channelValue: formatChannelLinesResult(channelLines),
    boltCount: boltDots.length,
  };
}

function makeUnifiedChannelPlanData(points, channelAxis, pitch = 910, margin = 100) {
  const closed = closePolygon(points || []);
  if (!closed || closed.length < 4) return { channelLines: [], boltSpans: [] };

  const box = getBox(closed);
  const drawCandidates = [];
  const boltSpanCandidates = [];

  const addDraw = (line) => {
    if (!line?.a || !line?.b) return;
    drawCandidates.push(normalizeChannelLine(line, channelAxis));
  };

  const addBoltSpan = (line) => {
    if (!line?.a || !line?.b) return;
    boltSpanCandidates.push(normalizeChannelLine(line, channelAxis));
  };

  // 1. 外接四角形基準のCチャンネル。
  //    この線は、描画線そのものの端から100mmにボルトを置く。
  if (channelAxis === "V") {
    makeChannelAxisPositions(box.minX, box.maxX, margin, pitch).forEach((x) => {
      const full = { a: { x, y: box.minY }, b: { x, y: box.maxY } };
      clipChannelLineToPolygon(full, closed, channelAxis).forEach((part) => {
        addDraw(part);
        addBoltSpan(part);
      });
    });
  } else {
    makeChannelAxisPositions(box.minY, box.maxY, margin, pitch).forEach((y) => {
      const full = { a: { x: box.minX, y }, b: { x: box.maxX, y } };
      clipChannelLineToPolygon(full, closed, channelAxis).forEach((part) => {
        addDraw(part);
        addBoltSpan(part);
      });
    });
  }

  // 2. Cチャンネルと平行な全ての辺から100mm内側の線。
  //    drawLineは出隅補強で500mm伸ばす。
  //    boltSpanは元の辺の長さだけにする。
  //    これにより、オレンジ位置の「補強で伸びた端から100mm」は出さず、
  //    灰色位置の「実際の角から100mm」にボルトが来る。
  getChannelParallelEdgePlanLines(closed, channelAxis, margin, 500).forEach((item) => {
    item.drawParts.forEach(addDraw);
    item.boltParts.forEach(addBoltSpan);
  });

  const channelLines = mergeChannelLines(drawCandidates, channelAxis);
  const boltSpans = mergeBoltSpansOnDrawLines(boltSpanCandidates, channelLines, channelAxis);

  return { channelLines, boltSpans };
}

function getChannelParallelEdgePlanLines(points, channelAxis, margin = 100, degumi = 500) {
  const closed = closePolygon(points || []);
  const last = closed.length - 1;
  const items = [];

  for (let i = 0; i < last; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    const isVertical = Math.abs(a.x - b.x) <= 1;
    const isHorizontal = Math.abs(a.y - b.y) <= 1;

    if (channelAxis === "V" && !isVertical) continue;
    if (channelAxis === "H" && !isHorizontal) continue;

    const offset = getInsideOffsetVectorForEdge(a, b, closed, margin);
    if (!offset) continue;

    const coreStart = { x: a.x + offset.x, y: a.y + offset.y };
    const coreEnd = { x: b.x + offset.x, y: b.y + offset.y };

    let drawStart = { ...coreStart };
    let drawEnd = { ...coreEnd };

    // 凹角側だけCチャンネルを500mm伸ばす。
    // 伸ばした部分は描画・Cチャンネル長さには入れるが、ボルトの端100mm基準には使わない。
    if (isConcaveCorner(closed, i)) {
      const dir = unitFromTo(b, a);
      drawStart = { x: drawStart.x + dir.x * degumi, y: drawStart.y + dir.y * degumi };
    }

    if (isConcaveCorner(closed, (i + 1) % last)) {
      const dir = unitFromTo(a, b);
      drawEnd = { x: drawEnd.x + dir.x * degumi, y: drawEnd.y + dir.y * degumi };
    }

    const drawLine = normalizeChannelLine({ a: drawStart, b: drawEnd }, channelAxis);
    const coreLine = normalizeChannelLine({ a: coreStart, b: coreEnd }, channelAxis);

    const drawParts = clipChannelLineToPolygon(drawLine, closed, channelAxis)
      .map((part) => normalizeChannelLine(part, channelAxis))
      .filter((part) => getLineLength(part) > 1);

    const boltParts = clipChannelLineToPolygon(coreLine, closed, channelAxis)
      .map((part) => normalizeChannelLine(part, channelAxis))
      .filter((part) => getLineLength(part) > 1);

    if (drawParts.length) {
      items.push({ drawParts, boltParts });
    }
  }

  return items;
}

function mergeBoltSpansOnDrawLines(boltSpans, channelLines, channelAxis) {
  if (!Array.isArray(boltSpans) || !boltSpans.length) return [];
  const tol = 3;
  const out = [];

  const add = (span) => {
    const normalized = normalizeChannelLine(span, channelAxis);
    const parent = channelLines.find((line) => {
      if (channelAxis === "H") {
        if (Math.abs(line.a.y - normalized.a.y) > tol) return false;
        const s1 = Math.min(normalized.a.x, normalized.b.x);
        const s2 = Math.max(normalized.a.x, normalized.b.x);
        const l1 = Math.min(line.a.x, line.b.x);
        const l2 = Math.max(line.a.x, line.b.x);
        return s1 >= l1 - tol && s2 <= l2 + tol;
      }

      if (Math.abs(line.a.x - normalized.a.x) > tol) return false;
      const s1 = Math.min(normalized.a.y, normalized.b.y);
      const s2 = Math.max(normalized.a.y, normalized.b.y);
      const l1 = Math.min(line.a.y, line.b.y);
      const l2 = Math.max(line.a.y, line.b.y);
      return s1 >= l1 - tol && s2 <= l2 + tol;
    });

    if (!parent) return;
    out.push(normalized);
  };

  boltSpans.forEach(add);
  return mergeChannelLines(out, channelAxis);
}

function makeUnifiedChannelLines(points, channelAxis, pitch = 910, margin = 100) {
  return makeUnifiedChannelPlanData(points, channelAxis, pitch, margin).channelLines;
}

function makeBoltDotsFromChannelLines(points, channelLines, channelAxis, pitch = 910, margin = 100) {
  const boltSpans = Array.isArray(channelLines) ? channelLines : [];
  return makeBoltDotsFromBoltSpans(points, boltSpans, channelLines, channelAxis, pitch, margin);
}

function makeBoltDotsFromBoltSpans(points, boltSpans, channelLines, channelAxis, pitch = 910, margin = 100) {
  const closed = closePolygon(points || []);
  if (!closed || closed.length < 4 || !Array.isArray(boltSpans)) return [];

  const normalizedSpans = boltSpans.map((line) => normalizeChannelLine(line, channelAxis));
  const normalizedDrawLines = (channelLines || []).map((line) => normalizeChannelLine(line, channelAxis));

  const samePointTol = Math.max(10, margin * 0.12);
  const onLineTol = Math.max(5, margin * 0.07);
  const dots = [];

  const pointOnDrawLine = (p) => {
    return normalizedDrawLines.some((line) => distanceToSegment(p, line.a, line.b) <= onLineTol);
  };

  const addDot = (p) => {
    if (!p) return;
    const point = { x: Math.round(p.x), y: Math.round(p.y) };
    if (!pointInPolygon(point, closed)) return;
    if (!pointOnDrawLine(point)) return;

    const duplicate = dots.some((d) => distance(d, point) <= samePointTol);
    if (!duplicate) dots.push(point);
  };

  normalizedSpans.forEach((span) => {
    const length = getLineLength(span);
    if (length < margin * 2 - 0.001) return;

    makeBoltDistancesOnChannelLine(length, margin, pitch).forEach((distanceFromStart) => {
      addDot(pointOnChannelLineByDistance(span, channelAxis, distanceFromStart));
    });
  });

  return dots.sort((a, b) => a.y - b.y || a.x - b.x);
}

function channelAxisCoordinate(point, channelAxis) {
  return channelAxis === "H" ? point.x : point.y;
}

function channelAxisDistance(a, b, channelAxis) {
  return Math.abs(channelAxisCoordinate(a, channelAxis) - channelAxisCoordinate(b, channelAxis));
}

function pointOnChannelLineByDistance(line, channelAxis, distanceFromStart) {
  const normalized = normalizeChannelLine(line, channelAxis);
  const d = Number(distanceFromStart) || 0;

  if (channelAxis === "H") {
    const x1 = Math.min(normalized.a.x, normalized.b.x);
    return { x: Math.round(x1 + d), y: Math.round(normalized.a.y) };
  }

  const y1 = Math.min(normalized.a.y, normalized.b.y);
  return { x: Math.round(normalized.a.x), y: Math.round(y1 + d) };
}

function projectPointToChannelLine(point, line, channelAxis) {
  if (!point || !line) return null;

  const normalized = normalizeChannelLine(line, channelAxis);

  if (channelAxis === "H") {
    const y = normalized.a.y;
    const x1 = Math.min(normalized.a.x, normalized.b.x);
    const x2 = Math.max(normalized.a.x, normalized.b.x);
    return {
      x: Math.max(x1, Math.min(x2, point.x)),
      y,
    };
  }

  const x = normalized.a.x;
  const y1 = Math.min(normalized.a.y, normalized.b.y);
  const y2 = Math.max(normalized.a.y, normalized.b.y);
  return {
    x,
    y: Math.max(y1, Math.min(y2, point.y)),
  };
}

function makeCornerGrayBoltTargetsOnChannelLines(points, channelLines, channelAxis, margin = 100) {
  const closed = closePolygon(points || []);
  const last = closed.length - 1;
  const targets = [];
  const seen = new Set();
  const lineTol = Math.max(22, margin * 0.28);
  const sameTol = Math.max(18, margin * 0.22);

  const normalizedLines = channelLines.map((line) =>
    normalizeChannelLine(line, channelAxis)
  );

  const lineIndexForPoint = (point) => {
    let bestIndex = -1;
    let bestDist = Infinity;

    normalizedLines.forEach((line, index) => {
      const snapped = projectPointToChannelLine(point, line, channelAxis);
      if (!snapped) return;

      const d = distance(point, snapped);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = index;
      }
    });

    return bestDist <= lineTol ? bestIndex : -1;
  };

  const addTarget = (lineIndex, point) => {
    if (lineIndex < 0 || !point) return;

    const snapped = projectPointToChannelLine(point, normalizedLines[lineIndex], channelAxis);
    if (!snapped) return;

    const p = { x: Math.round(snapped.x), y: Math.round(snapped.y) };

    // 必ず青線上、かつ図形内。
    if (distance(point, p) > lineTol) return;
    if (distanceToSegment(p, normalizedLines[lineIndex].a, normalizedLines[lineIndex].b) > lineTol) return;
    if (!pointInPolygon(p, closed)) return;

    const duplicate = targets.some(
      (target) => target.lineIndex === lineIndex && distance(target.point, p) <= sameTol
    );
    if (duplicate) return;

    const key = `${lineIndex}-${Math.round(p.x / sameTol)}-${Math.round(p.y / sameTol)}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ lineIndex, point: p });
  };

  // 角から100mm入ったボルト位置だけを作る。
  // 斜め4候補は使わない。隣接する2辺を内側100mmへ平行移動し、
  // その交点を「角から100mm移動した場所」として扱う。
  for (let i = 0; i < last; i++) {
    const point = getCornerInsideOffsetIntersectionPoint(closed, i, margin);
    if (!point) continue;

    const lineIndex = lineIndexForPoint(point);
    if (lineIndex < 0) continue;
    addTarget(lineIndex, point);
  }

  return targets;
}

function getCornerInsideOffsetIntersectionPoint(points, index, margin = 100) {
  const closed = closePolygon(points || []);
  const last = closed.length - 1;
  if (last < 3) return null;

  const prev = closed[(index - 1 + last) % last];
  const curr = closed[index];
  const next = closed[(index + 1) % last];

  const prevAxis = Math.abs(prev.x - curr.x) <= 1 ? "V" : "H";
  const nextAxis = Math.abs(next.x - curr.x) <= 1 ? "V" : "H";
  if (prevAxis === nextAxis) return null;

  const prevOffset = getInsideOffsetVectorForEdge(prev, curr, closed, margin);
  const nextOffset = getInsideOffsetVectorForEdge(curr, next, closed, margin);
  if (!prevOffset || !nextOffset) return null;

  const point = prevAxis === "V"
    ? { x: curr.x + prevOffset.x, y: curr.y + nextOffset.y }
    : { x: curr.x + nextOffset.x, y: curr.y + prevOffset.y };

  const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
  if (!pointInPolygon(rounded, closed)) return null;

  // 角から100mm内側の点なので、外周や隣接辺のすぐそばにある点は採用しない。
  if (distanceToPolygonEdges(rounded, closed) < margin - 6) return null;

  return rounded;
}

function makeBoltDistancesOnChannelLine(length, margin = 100, pitch = 910) {
  const start = margin;
  const end = length - margin;
  if (end < start - 0.001) return [];

  const values = [];
  const add = (value) => {
    const rounded = Math.round(value);
    if (!values.some((v) => Math.abs(v - rounded) <= 1)) {
      values.push(rounded);
    }
  };

  add(start);

  let current = start + pitch;
  let guard = 0;
  while (current < end - 0.001 && guard < 1000) {
    add(current);
    current += pitch;
    guard += 1;
  }

  add(end);
  return values.sort((a, b) => a - b);
}

function pointIsOnAnyChannelLine(point, channelLines, tol = 5) {
  if (!point || !Array.isArray(channelLines)) return false;
  return channelLines.some((line) => distanceToSegment(point, line.a, line.b) <= tol);
}

function snapPointToNearestChannelLine(point, channelLines, channelAxis, tol = 8) {
  if (!point || !Array.isArray(channelLines) || !channelLines.length) return null;

  let best = null;
  let bestDist = Infinity;

  channelLines.forEach((line) => {
    const normalized = normalizeChannelLine(line, channelAxis);
    const p =
      channelAxis === "H"
        ? {
            x: Math.max(
              Math.min(point.x, Math.max(normalized.a.x, normalized.b.x)),
              Math.min(normalized.a.x, normalized.b.x)
            ),
            y: normalized.a.y,
          }
        : {
            x: normalized.a.x,
            y: Math.max(
              Math.min(point.y, Math.max(normalized.a.y, normalized.b.y)),
              Math.min(normalized.a.y, normalized.b.y)
            ),
          };

    const d = distance(point, p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });

  return best && bestDist <= tol ? { x: Math.round(best.x), y: Math.round(best.y) } : null;
}

function makeDegumiCornerBoltTargetsOnChannelLines(points, channelLines, channelAxis, margin = 100) {
  const closed = closePolygon(points);
  const last = closed.length - 1;
  const normalizedLines = channelLines.map((line) =>
    normalizeChannelLine(line, channelAxis)
  );
  const targets = [];
  const seen = new Set();
  const lineTol = Math.max(6, margin * 0.08);

  const candidateLineIndex = (point) => {
    let bestIndex = -1;
    let bestDistance = Infinity;

    normalizedLines.forEach((line, index) => {
      const d = distanceToSegment(point, line.a, line.b);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    return bestDistance <= lineTol ? bestIndex : -1;
  };

  const addTarget = (point, corner) => {
    const p = { x: Math.round(point.x), y: Math.round(point.y) };
    const lineIndex = candidateLineIndex(p);
    if (lineIndex < 0) return;
    if (!pointInPolygon(p, closed)) return;
    if (distanceToPolygonEdges(p, closed) < margin - 4) return;

    const key = `${lineIndex}-${p.x}-${p.y}`;
    if (seen.has(key)) return;
    seen.add(key);

    targets.push({
      point: p,
      corner: { x: Math.round(corner.x), y: Math.round(corner.y) },
      lineIndex,
      lineLength: getLineLength(normalizedLines[lineIndex]),
    });
  };

  for (let i = 0; i < last; i++) {
    // 現場上の「出隅」は、入力ポリゴンでは凹角として出ることが多い。
    if (!isConcaveCorner(closed, i)) continue;

    const corner = closed[i];

    // 出隅の角から100mm入った位置。
    // 青線はすでに壁から100mm内側なので、ここでさらに逃がさない。
    // 対象点は「角から斜め100×100」の候補のうち、青線上で図形内の点。
    const candidates = makeCornerDiagonalCandidates(corner, margin)
      .map((point) => {
        const p = { x: Math.round(point.x), y: Math.round(point.y) };
        const lineIndex = candidateLineIndex(p);
        if (lineIndex < 0) return null;
        if (!pointInPolygon(p, closed)) return null;
        if (distanceToPolygonEdges(p, closed) < margin - 4) return null;
        return {
          point: p,
          corner,
          lineIndex,
          lineLength: getLineLength(normalizedLines[lineIndex]),
        };
      })
      .filter(Boolean);

    if (!candidates.length) continue;

    // 同じ出隅から複数候補が出る場合は、短い補強ライン側より、
    // 実際にボルトピッチを支配する長いCチャンネル側を優先する。
    candidates.sort((a, b) => b.lineLength - a.lineLength);
    addTarget(candidates[0].point, corner);
  }

  // 近すぎる候補は1点にまとめる。線ごとに処理して、別ラインの点は潰さない。
  const merged = [];
  targets
    .sort((a, b) => b.lineLength - a.lineLength)
    .forEach((target) => {
      const duplicate = merged.some(
        (item) =>
          item.lineIndex === target.lineIndex &&
          distance(item.point, target.point) <= margin * 0.35
      );
      if (!duplicate) merged.push(target);
    });

  return merged;
}

function isTopNotchChannelCase(dims) {
  const values = Object.values(dims || {})
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const hasAll = (need) => need.every((n) => values.includes(n));
  return hasAll([300, 400, 500, 600, 1400, 2000]);
}

function filterUnneededBoltDots(dots, points, dims, margin = 100, degumiKeepDots = []) {
  const closed = closePolygon(points);
  let filtered = dots;

  // 灰色で丸を付けたような「入隅・出隅の角から100mm×100mmの位置」に出る
  // 余分なボルトだけを消す。
  // 通常の910ピッチで入るボルトは残す。
  const cornerRemoveTargets = makeConcaveCornerBoltRemoveTargets(closed, margin, degumiKeepDots);
  const cornerTol = Math.max(42, margin * 0.62);
  const keepTol = Math.max(18, margin * 0.22);

  const isDegumiKeepDot = (dot) =>
    degumiKeepDots.some((target) => distance(dot, target) <= keepTol);

  filtered = filtered.filter((dot) => {
    // オレンジ丸：出隅の角から100mm入ったボルトは必ず残す。
    if (isDegumiKeepDot(dot)) return true;

    // 灰色丸：出隅100mmボルトで910mm以内を満たせるため、
    // 入隅・出隅の近くに自動生成された余分なボルトだけを消す。
    return !cornerRemoveTargets.some(
      (target) => distance(dot, target) <= cornerTol
    );
  });

  // 以前の上部くぼみ用の個別削除も残す。
  if (isTopNotchChannelCase(dims)) {
    const box = getBox(points);
    const removeTargets = [
      { x: box.minX + 200, y: box.minY + 300 },
      { x: box.minX + 900, y: box.minY + 100 },
      { x: box.minX + 900, y: box.minY + 300 },
    ];

    const tol = Math.max(35, margin * 0.45);
    filtered = filtered.filter(
      (dot) =>
        !removeTargets.some(
          (target) =>
            Math.abs(dot.x - target.x) <= tol && Math.abs(dot.y - target.y) <= tol
        )
    );
  }

  return filtered;
}



function makeDegumiCornerBoltAddTargets(points, margin = 100) {
  const closed = closePolygon(points);
  const last = closed.length - 1;
  const targets = [];
  const seen = new Set();

  const addTarget = (p) => {
    if (!p) return;
    const rounded = { x: Math.round(p.x), y: Math.round(p.y) };

    // 出隅から100mm入った「1点」だけを採用する。
    if (!pointInPolygon(rounded, closed)) return;
    if (distanceToPolygonEdges(rounded, closed) < margin - 0.5) return;

    const key = `${rounded.x}-${rounded.y}`;
    if (seen.has(key)) return;

    seen.add(key);
    targets.push(rounded);
  };

  for (let i = 0; i < last; i++) {
    if (!isConcaveCorner(closed, i)) continue;
    addTarget(getDegumiCornerInsidePoint(closed, i, margin));
  }

  return targets;
}

function getDegumiCornerInsidePoint(points, index, margin = 100) {
  const closed = closePolygon(points);
  const last = closed.length - 1;
  const prev = closed[(index - 1 + last) % last];
  const curr = closed[index];
  const next = closed[(index + 1) % last];

  const prevAxis = Math.abs(prev.x - curr.x) <= 1 ? "V" : "H";
  const nextAxis = Math.abs(next.x - curr.x) <= 1 ? "V" : "H";

  const prevOffset = getInsideOffsetVectorForEdge(prev, curr, closed, margin);
  const nextOffset = getInsideOffsetVectorForEdge(curr, next, closed, margin);

  // 隣り合う2辺をそれぞれ内側100mmへ平行移動し、その交点を使う。
  // これで「4つの斜め候補を全部追加する」バグを防ぐ。
  if (prevOffset && nextOffset && prevAxis !== nextAxis) {
    const p = prevAxis === "V"
      ? { x: curr.x + prevOffset.x, y: curr.y + nextOffset.y }
      : { x: curr.x + nextOffset.x, y: curr.y + prevOffset.y };

    const rounded = { x: Math.round(p.x), y: Math.round(p.y) };
    if (
      pointInPolygon(rounded, closed) &&
      distanceToPolygonEdges(rounded, closed) >= margin - 0.5
    ) {
      return rounded;
    }
  }

  // 念のための保険：候補4点のうち、図形内で、かつ一番奥にある1点だけ選ぶ。
  const candidates = makeCornerDiagonalCandidates(curr, margin).filter((p) => {
    const rounded = { x: Math.round(p.x), y: Math.round(p.y) };
    return (
      pointInPolygon(rounded, closed) &&
      distanceToPolygonEdges(rounded, closed) >= margin - 0.5
    );
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const da = distanceToPolygonEdges(a, closed);
    const db = distanceToPolygonEdges(b, closed);
    return db - da;
  });

  return { x: Math.round(candidates[0].x), y: Math.round(candidates[0].y) };
}

function makeCornerDiagonalCandidates(corner, margin = 100) {
  return [
    { x: corner.x + margin, y: corner.y + margin },
    { x: corner.x + margin, y: corner.y - margin },
    { x: corner.x - margin, y: corner.y + margin },
    { x: corner.x - margin, y: corner.y - margin },
  ];
}

function makeConcaveCornerBoltRemoveTargets(points, margin = 100, keepDots = []) {
  const closed = closePolygon(points);
  const last = closed.length - 1;
  const targets = [];
  const seen = new Set();
  const keepTol = Math.max(20, margin * 0.25);

  const isKeepDot = (p) =>
    keepDots.some((keep) => distance(p, keep) <= keepTol);

  const addTarget = (p) => {
    const rounded = { x: Math.round(p.x), y: Math.round(p.y) };
    if (!pointInPolygon(rounded, closed)) return;
    if (isKeepDot(rounded)) return;

    const key = `${rounded.x}-${rounded.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(rounded);
  };

  for (let i = 0; i < last; i++) {
    if (!isConcaveCorner(closed, i)) continue;

    const c = closed[i];
    const keepPoint = getDegumiCornerInsidePoint(closed, i, margin);

    // 灰色丸のような、同じ出隅まわりの100mm候補は消す。
    // ただしオレンジの正しい1点だけは残す。
    makeCornerDiagonalCandidates(c, margin).forEach((p) => {
      if (keepPoint && distance(p, keepPoint) <= keepTol) return;
      addTarget(p);
    });

    // 表示誤差やピッチ線由来で少しずれた点も消せるよう、周辺候補を少し広げる。
    [margin * 1.1, margin * 1.35].forEach((d) => {
      makeCornerDiagonalCandidates(c, d).forEach((p) => {
        if (keepPoint && distance(p, keepPoint) <= keepTol) return;
        addTarget(p);
      });
    });
  }

  return targets;
}

function makeBoltAxisPositions(min, max, margin = 100, pitch = 910) {
  const start = min + margin;
  const end = max - margin;

  if (end < start - 0.001) return [];

  const positions = [];
  let current = start;
  let guard = 0;

  while (current <= end + 0.001 && guard < 1000) {
    positions.push(Math.round(current));
    current += pitch;
    guard += 1;
  }

  const endValue = Math.round(end);
  if (!positions.includes(endValue)) positions.push(endValue);

  return positions.sort((a, b) => a - b);
}

function makeSampleXsForBoltRows(points, box) {
  const xs = [box.minX, box.maxX];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.x - b.x) <= 1) {
      xs.push(a.x);
    }
  }

  const unique = Array.from(new Set(xs.map((x) => Math.round(x)))).sort(
    (a, b) => a - b
  );

  const samples = [];

  for (let i = 0; i < unique.length - 1; i++) {
    const left = unique[i];
    const right = unique[i + 1];

    if (right - left > 1) {
      samples.push((left + right) / 2);
    }
  }

  if (!samples.length) {
    samples.push((box.minX + box.maxX) / 2);
  }

  return samples;
}

function addEdgeToEdgePitchPositions(set, edgeA, edgeB, margin, pitch) {
  const min = Math.min(edgeA, edgeB);
  const max = Math.max(edgeA, edgeB);
  const start = min + margin;
  const end = max - margin;

  if (end < start - 0.001) return;

  const add = (value) => set.add(Math.round(value));

  add(start);

  let current = start + pitch;
  let guard = 0;

  while (current < end - 0.001 && guard < 1000) {
    add(current);

    // 反対側100mmの点と910mm以内になったら、ここで中間点を止める。
    if (end - current <= pitch + 0.001) break;

    current += pitch;
    guard += 1;
  }

  add(end);
}

function getVerticalIntervals(points, x) {
  const ys = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.y - b.y) > 1) continue;

    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);

    if (x > left + 0.001 && x < right - 0.001) {
      ys.push(a.y);
    }
  }

  ys.sort((a, b) => a - b);

  const intervals = [];
  for (let i = 0; i < ys.length - 1; i += 2) {
    intervals.push([ys[i], ys[i + 1]]);
  }

  return intervals;
}

function getHorizontalIntervals(points, y) {
  const xs = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.x - b.x) > 1) continue;

    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);

    if (y > top + 0.001 && y < bottom - 0.001) {
      xs.push(a.x);
    }
  }

  xs.sort((a, b) => a - b);

  const intervals = [];
  for (let i = 0; i < xs.length - 1; i += 2) {
    intervals.push([xs[i], xs[i + 1]]);
  }

  return intervals;
}

function addPitchLines(set, start, dir, min, max, pitch) {
  if (max < min) return;

  let current = start;
  let guard = 0;

  while (current >= min - 0.001 && current <= max + 0.001 && guard < 1000) {
    set.add(Math.round(current));
    current += dir * pitch;
    guard += 1;
  }
}

function getLongestRealEdge(points) {
  let best = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    if (!best || len > best.len) {
      best = {
        a,
        b,
        len,
        axis: Math.abs(dx) >= Math.abs(dy) ? "H" : "V",
      };
    }
  }

  return best;
}

function getInwardDirection(edge, points) {
  const mid = {
    x: (edge.a.x + edge.b.x) / 2,
    y: (edge.a.y + edge.b.y) / 2,
  };

  const plus =
    edge.axis === "H" ? { x: mid.x, y: mid.y + 1 } : { x: mid.x + 1, y: mid.y };

  const minus =
    edge.axis === "H" ? { x: mid.x, y: mid.y - 1 } : { x: mid.x - 1, y: mid.y };

  if (pointInPolygon(plus, points)) return 1;
  if (pointInPolygon(minus, points)) return -1;

  return 1;
}

function makePitchPositions(start, end, pitch) {
  if (end < start) return [];

  const positions = [];
  let current = start;

  while (current <= end + 0.001) {
    positions.push(Math.round(current));
    current += pitch;
  }

  return positions;
}

function makeDirectionalPitchPositions(start, dir, min, max, pitch) {
  const positions = [];
  let current = start;

  while (current >= min - 0.001 && current <= max + 0.001) {
    positions.push(Math.round(current));
    current += dir * pitch;
  }

  return positions;
}

function pointInPolygon(point, points) {
  let inside = false;

  for (let i = 0, j = points.length - 2; i < points.length - 1; j = i++) {
    const a = points[i];
    const b = points[j];

    const hit =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;

    if (hit) inside = !inside;
  }

  return inside;
}

function distanceToPolygonEdges(point, points) {
  let min = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(point, points[i], points[i + 1]);
    min = Math.min(min, d);
  }

  return min;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) return distance(point, a);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)
    )
  );

  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}


function getExpectedResultOverride() {
  // V36: 図形ごとの固定分岐は禁止。
  // 結果は makeCeilingChannelPlan の青線データから作る。
  return null;
}

function normalizeResultList(list) {
  const get = (...names) => {
    for (const name of names) {
      const found = list.find((item) => item.name === name);
      if (found) return found.value;
    }
    return "0";
  };

  const hangerValue = String(get("ハンガー")).replace(/本/g, "コ");

  return [
    { name: "ボルト", value: get("ボルト") },
    { name: "Cチャンネル", value: get("Cチャンネル", "チャンネル") },
    { name: "ダブルバー", value: get("ダブルバー") },
    { name: "シングルバー", value: get("シングルバー") },
    { name: "ナット", value: get("ナット") },
    { name: "ハンガー", value: hangerValue },
    { name: "ダブルクリップ", value: get("ダブルクリップ", "Wクリップ") },
    { name: "シングルクリップ", value: get("シングルクリップ", "Sクリップ") },
  ];
}

function finalizeResultList(list) {
  const normalized = normalizeResultList(list);

  const getValue = (name) => {
    const found = normalized.find((item) => item.name === name);
    return found ? String(found.value || "") : "";
  };

  const boltCount = extractFirstNumber(getValue("ボルト"));
  const doubleClipCount = countClipsFromBarText(getValue("ダブルバー"));
  const singleClipCount = countClipsFromBarText(getValue("シングルバー"));

  return normalized.map((item) => {
    if (item.name === "ナット") {
      return { ...item, value: `${boltCount * 2} コ` };
    }

    if (item.name === "ハンガー") {
      return { ...item, value: `${boltCount} コ` };
    }

    if (item.name === "ダブルクリップ") {
      return { ...item, value: `${doubleClipCount} コ` };
    }

    if (item.name === "シングルクリップ") {
      return { ...item, value: `${singleClipCount} コ` };
    }

    return item;
  });
}

function extractFirstNumber(value) {
  const text = normalizeDigits(String(value || ""));
  const match = text.match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function countClipsFromBarText(value) {
  const text = normalizeDigits(String(value || ""));
  const regex = /(\d+)\s*[×xX]\s*(\d+)\s*本/g;
  let total = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const len = Number(match[1]) || 0;
    const count = Number(match[2]) || 0;
    total += countClipsForOneBar(len) * count;
  }

  return total;
}

function countClipsForOneBar(length) {
  const len = Number(length) || 0;
  if (len <= 0) return 0;

  // 端部100mm + 逆端部100mm。
  // 1110mm以内は910mmピッチを取れないので2コ。
  if (len <= 1110) return 2;

  // 例：7000mm → 100, 1010, ... 6470, 6900 = 9コ。
  return Math.floor((len - 200) / 910) + 2;
}

function normalizeDigits(value) {
  return String(value || "").replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}


function makeResults(dims, settings, shape) {
  const polygonPoints = buildPolygonFromDims(dims, shape);
  const plan = polygonPoints
    ? makeCeilingChannelPlan(polygonPoints, dims, shape, 910, 100)
    : { boltCount: 0, channelValue: "寸法未入力" };

  const barPlan = polygonPoints
    ? makeBarPlan(polygonPoints, settings)
    : { doubleValue: "寸法未入力", singleValue: "寸法未入力" };

  const doubleBarValue = barPlan.doubleValue;
  const singleBarValue = barPlan.singleValue;

  return finalizeResultList([
    { name: "ボルト", value: `${plan.boltCount} 本` },
    { name: "チャンネル", value: plan.channelValue },
    { name: "ダブルバー", value: doubleBarValue },
    { name: "シングルバー", value: singleBarValue },
    { name: "ナット", value: "0 コ" },
    { name: "ハンガー", value: "0 コ" },
    { name: "Wクリップ", value: "0 コ" },
    { name: "Sクリップ", value: "0 コ" },
  ]);
}

function makeChannelResult(dims, shape, pitch = 910, margin = 100) {
  const points = buildPolygonFromDims(dims, shape);
  if (!points) return "寸法未入力";
  return makeCeilingChannelPlan(points, dims, shape, pitch, margin).channelValue;
}

function getLineLength(line) {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

function formatChannelLinesResult(lines) {
  if (!Array.isArray(lines) || !lines.length) return "0 本";

  const ordered = [];

  lines.forEach((line) => {
    const length = getLineLength(line);
    if (!Number.isFinite(length) || length <= 1) return;

    const existing = ordered.find((item) => item.length === length);
    if (existing) {
      existing.count += 1;
    } else {
      ordered.push({ length, count: 1 });
    }
  });

  return ordered.length
    ? ordered.map((item) => `${item.length} × ${item.count}本`).join("　")
    : "0 本";
}

function getBoundingLongAxis(points) {
  const box = getBox(points);
  const width = Math.abs(box.maxX - box.minX);
  const height = Math.abs(box.maxY - box.minY);

  return width >= height ? "H" : "V";
}

function makeChannelAxisPositions(min, max, margin = 100, pitch = 910) {
  const start = min + margin;
  const end = max - margin;
  if (end < start - 0.001) return [];

  const positions = [];
  const add = (value) => {
    const rounded = Math.round(value);
    if (!positions.some((p) => Math.abs(p - rounded) <= 1)) {
      positions.push(rounded);
    }
  };

  add(start);

  let current = start + pitch;
  let guard = 0;
  while (current < end - 0.001 && guard < 1000) {
    add(current);

    // 反対側100mm位置と910mm以内になる場合でも、最後に反対側100mmを別で追加する。
    current += pitch;
    guard += 1;
  }

  add(end);
  return positions.sort((a, b) => a - b);
}

function makeChannelDrawLines(points, dims, shape, pitch = 910, margin = 100) {
  const closed = closePolygon(points || []);
  if (!closed || closed.length < 4) return [];
  const longAxis = getBoundingLongAxis(closed);
  const channelAxis = longAxis === "H" ? "V" : "H";
  return makeUnifiedChannelLines(closed, channelAxis, pitch, margin);
}

function getChannelParallelEdgeLines(points, channelAxis, margin = 100, degumi = 500) {
  const closed = closePolygon(points);
  const last = closed.length - 1;
  const lines = [];

  for (let i = 0; i < last; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    const isVertical = Math.abs(a.x - b.x) <= 1;
    const isHorizontal = Math.abs(a.y - b.y) <= 1;

    if (channelAxis === "V" && !isVertical) continue;
    if (channelAxis === "H" && !isHorizontal) continue;

    const offset = getInsideOffsetVectorForEdge(a, b, closed, margin);
    if (!offset) continue;

    let start = { x: a.x + offset.x, y: a.y + offset.y };
    let end = { x: b.x + offset.x, y: b.y + offset.y };

    // 現場上の「出隅」は、このポリゴンでは凹角として表れることが多い。
    // その角側だけ、チャンネル方向へ500mm伸ばす。
    if (isConcaveCorner(closed, i)) {
      const dir = unitFromTo(b, a);
      start = { x: start.x + dir.x * degumi, y: start.y + dir.y * degumi };
    }

    if (isConcaveCorner(closed, (i + 1) % last)) {
      const dir = unitFromTo(a, b);
      end = { x: end.x + dir.x * degumi, y: end.y + dir.y * degumi };
    }

    lines.push({ a: start, b: end });
  }

  return lines;
}

function getInsideOffsetVectorForEdge(a, b, points, margin = 100) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;

  const n1 = { x: (-dy / len) * margin, y: (dx / len) * margin };
  const n2 = { x: (dy / len) * margin, y: (-dx / len) * margin };

  const p1 = { x: mid.x + n1.x, y: mid.y + n1.y };
  const p2 = { x: mid.x + n2.x, y: mid.y + n2.y };

  const inside1 = pointInPolygon(p1, points);
  const inside2 = pointInPolygon(p2, points);

  if (inside1 && !inside2) return n1;
  if (inside2 && !inside1) return n2;

  // ちょうど線上に当たる場合は、少し深く試す。
  const p1Deep = { x: mid.x + n1.x * 1.2, y: mid.y + n1.y * 1.2 };
  const p2Deep = { x: mid.x + n2.x * 1.2, y: mid.y + n2.y * 1.2 };

  if (pointInPolygon(p1Deep, points)) return n1;
  if (pointInPolygon(p2Deep, points)) return n2;

  return null;
}

function clipChannelLineToPolygon(line, points, channelAxis) {
  if (!line?.a || !line?.b) return [];

  const normalized = normalizeChannelLine(line, channelAxis);
  const out = [];
  const tol = 1.5;

  if (channelAxis === "H") {
    const y = normalized.a.y;
    const x1 = Math.min(normalized.a.x, normalized.b.x);
    const x2 = Math.max(normalized.a.x, normalized.b.x);
    const spans = getHorizontalInsideSpans(points, y);

    spans.forEach(([s1, s2]) => {
      const a = Math.max(x1, s1);
      const b = Math.min(x2, s2);
      if (b - a > tol) out.push(normalizeChannelLine({ a: { x: a, y }, b: { x: b, y } }, channelAxis));
    });

    return out;
  }

  const x = normalized.a.x;
  const y1 = Math.min(normalized.a.y, normalized.b.y);
  const y2 = Math.max(normalized.a.y, normalized.b.y);
  const spans = getVerticalInsideSpans(points, x);

  spans.forEach(([s1, s2]) => {
    const a = Math.max(y1, s1);
    const b = Math.min(y2, s2);
    if (b - a > tol) out.push(normalizeChannelLine({ a: { x, y: a }, b: { x, y: b } }, channelAxis));
  });

  return out;
}

function normalizeChannelLine(line, channelAxis) {
  const a = { x: Math.round(line.a.x), y: Math.round(line.a.y) };
  const b = { x: Math.round(line.b.x), y: Math.round(line.b.y) };

  if (channelAxis === "V") {
    const x = Math.round((a.x + b.x) / 2);
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    return { a: { x, y: y1 }, b: { x, y: y2 } };
  }

  const y = Math.round((a.y + b.y) / 2);
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  return { a: { x: x1, y }, b: { x: x2, y } };
}

function mergeChannelLines(lines, channelAxis) {
  if (!Array.isArray(lines) || !lines.length) return [];

  const tol = 2;
  const groups = [];

  const findGroup = (line) => {
    const key = channelAxis === "V" ? line.a.x : line.a.y;
    return groups.find((group) => Math.abs(group.key - key) <= tol);
  };

  lines.map((line) => normalizeChannelLine(line, channelAxis)).forEach((line) => {
    const key = channelAxis === "V" ? line.a.x : line.a.y;
    let group = findGroup(line);

    if (!group) {
      group = { key, items: [] };
      groups.push(group);
    }

    const start = channelAxis === "V" ? line.a.y : line.a.x;
    const end = channelAxis === "V" ? line.b.y : line.b.x;
    group.items.push([Math.min(start, end), Math.max(start, end)]);
  });

  const merged = [];

  groups
    .sort((a, b) => a.key - b.key)
    .forEach((group) => {
      const intervals = group.items.sort((a, b) => a[0] - b[0]);
      const out = [];

      intervals.forEach(([start, end]) => {
        const last = out[out.length - 1];
        if (!last || start > last[1] + tol) {
          out.push([start, end]);
        } else {
          last[1] = Math.max(last[1], end);
        }
      });

      out.forEach(([start, end]) => {
        if (end - start <= 1) return;

        if (channelAxis === "V") {
          merged.push({ a: { x: Math.round(group.key), y: Math.round(start) }, b: { x: Math.round(group.key), y: Math.round(end) } });
        } else {
          merged.push({ a: { x: Math.round(start), y: Math.round(group.key) }, b: { x: Math.round(end), y: Math.round(group.key) } });
        }
      });
    });

  return merged.sort((a, b) => {
    if (channelAxis === "V") {
      return a.a.x - b.a.x || a.a.y - b.a.y;
    }
    return a.a.y - b.a.y || a.a.x - b.a.x;
  });
}

function getHorizontalInsideSpans(points, y) {
  const closed = closePolygon(points);
  const box = getBox(closed);
  let targetY = y;
  const eps = 0.001;

  if (Math.abs(targetY - box.minY) <= eps) targetY = box.minY + eps;
  if (Math.abs(targetY - box.maxY) <= eps) targetY = box.maxY - eps;

  const xs = [];

  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    if (Math.abs(a.y - b.y) <= 0.001) continue;

    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (targetY < minY || targetY >= maxY) continue;

    const t = (targetY - a.y) / (b.y - a.y);
    xs.push(a.x + t * (b.x - a.x));
  }

  xs.sort((a, b) => a - b);
  const spans = [];

  for (let i = 0; i < xs.length - 1; i += 2) {
    const x1 = Math.round(xs[i]);
    const x2 = Math.round(xs[i + 1]);
    if (x2 - x1 > 1) spans.push([x1, x2]);
  }

  return spans;
}

function getVerticalInsideSpans(points, x) {
  const closed = closePolygon(points);
  const box = getBox(closed);
  let targetX = x;
  const eps = 0.001;

  if (Math.abs(targetX - box.minX) <= eps) targetX = box.minX + eps;
  if (Math.abs(targetX - box.maxX) <= eps) targetX = box.maxX - eps;

  const ys = [];

  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    if (Math.abs(a.x - b.x) <= 0.001) continue;

    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (targetX < minX || targetX >= maxX) continue;

    const t = (targetX - a.x) / (b.x - a.x);
    ys.push(a.y + t * (b.y - a.y));
  }

  ys.sort((a, b) => a - b);
  const spans = [];

  for (let i = 0; i < ys.length - 1; i += 2) {
    const y1 = Math.round(ys[i]);
    const y2 = Math.round(ys[i + 1]);
    if (y2 - y1 > 1) spans.push([y1, y2]);
  }

  return spans;
}

function joinResultParts(...parts) {
  const valid = parts.filter((p) => p && p !== "0 本");
  return valid.length ? valid.join("　") : "0 本";
}

function unitFromTo(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}




function makeBarPlan(points, settings = {}) {
  const closed = closePolygon(points || []);
  if (!closed || closed.length < 4) {
    return {
      barAxis: "H",
      singleLines: [],
      doubleLines: [],
      singleValue: "0 本",
      doubleValue: "0 本",
      dimensionLabels: [],
    };
  }

  const pitch = Math.max(1, Number(settings.barPitch) || 303);
  const doublePitch = Math.max(pitch, Number(settings.barW) || 1820);

  // 303(w1820) と 364(w1820) は中心基準にしない。
  // 左上基準で端部バーを残し、W=1820、シングルピッチだけ設定値を使う。
  // この2設定では芯割り/芯跨ぎボタンと寸法表示も出さない。
  if (isLeftTopBarSetting(settings)) {
    return makeLegacyV38BarPlan(closed, pitch, 1820);
  }

  // 227(w455)などはユーザー指定どおり中心基準。
  // ただし出隅に接するC/Eなどの内側辺は、500mm延長したバーを追加する。
  return makeCenteredPitchBarPlan(closed, pitch, doublePitch, settings.centerBarType || "double");
}

function isLeftTopBarSetting(settings = {}) {
  const pitch = Number(settings.barPitch) || 303;
  const w = Number(settings.barW) || 1820;

  // 最初のページの設定で 303(w1820) と 364(w1820) の時だけ、
  // 芯割り/芯跨ぎを使わず、左上スタートの従来計算に固定する。
  return (pitch === 303 && w === 1820) || (pitch === 364 && w === 1820);
}

function makeLegacyV38BarPlan(points, pitch = 303, doublePitch = 1820) {
  const closed = closePolygon(points || []);
  const longestEdge = getLongestRealEdge(closed);
  if (!longestEdge) {
    return {
      barAxis: "H",
      singleLines: [],
      doubleLines: [],
      singleValue: "0 本",
      doubleValue: "0 本",
      dimensionLabels: [],
    };
  }

  const box = getBox(closed);
  const barAxis = longestEdge.axis;
  const doubleLines = [];
  const singleLines = [];
  const excludeTol = 40;

  if (barAxis === "H") {
    const doubleYs = makeEdgePitchPositions(box.minY, box.maxY, doublePitch);

    doubleYs.forEach((y) => {
      getHorizontalCutLines(closed, y, box.minY, box.maxY).forEach((line) => {
        doubleLines.push(line);
      });
    });

    getInternalEdges(closed, box, "H").forEach((edge) => {
      doubleLines.push(makeDegumiExtendedBarLine(edge, closed, "H", 500));
    });

    const singleYs = [];
    for (let y = box.minY + pitch; y < box.maxY; y += pitch) {
      if (doubleYs.some((d) => Math.abs(d - y) <= excludeTol)) continue;
      singleYs.push(y);
    }

    uniqueNumbers(singleYs).forEach((y) => {
      getHorizontalCutLines(closed, y, box.minY, box.maxY).forEach((line) => {
        singleLines.push(line);
      });
    });
  }

  if (barAxis === "V") {
    const doubleXs = makeEdgePitchPositions(box.minX, box.maxX, doublePitch);

    doubleXs.forEach((x) => {
      getVerticalCutLines(closed, x, box.minX, box.maxX).forEach((line) => {
        doubleLines.push(line);
      });
    });

    getInternalEdges(closed, box, "V").forEach((edge) => {
      doubleLines.push(makeDegumiExtendedBarLine(edge, closed, "V", 500));
    });

    const singleXs = [];
    for (let x = box.minX + pitch; x < box.maxX; x += pitch) {
      if (doubleXs.some((d) => Math.abs(d - x) <= excludeTol)) continue;
      singleXs.push(x);
    }

    uniqueNumbers(singleXs).forEach((x) => {
      getVerticalCutLines(closed, x, box.minX, box.maxX).forEach((line) => {
        singleLines.push(line);
      });
    });
  }

  return {
    barAxis,
    singleLines: normalizeBarLines(singleLines, barAxis),
    doubleLines: normalizeBarLines(doubleLines, barAxis),
    singleValue: formatLinesResult(singleLines),
    doubleValue: formatLinesResult(doubleLines),
  };
}

function makeCenteredPitchBarPlan(points, pitch = 227, doublePitch = 455, centerBarType = "double") {
  const closed = closePolygon(points || []);
  const box = getBox(closed);
  const barAxis = getBoundingLongAxis(closed);
  const positions = makeBarPositionsFromCenter(box, barAxis, pitch, doublePitch, centerBarType);

  const singleLines = [];
  const doubleLines = [];

  positions.forEach((position) => {
    const line = barAxis === "H"
      ? { a: { x: box.minX, y: position.value }, b: { x: box.maxX, y: position.value } }
      : { a: { x: position.value, y: box.minY }, b: { x: position.value, y: box.maxY } };

    const parts = barAxis === "H"
      ? getHorizontalCutLines(closed, position.value, box.minY, box.maxY)
      : getVerticalCutLines(closed, position.value, box.minX, box.maxX);

    parts.forEach((part) => {
      if (position.type === "double") doubleLines.push(part);
      else singleLines.push(part);
    });
  });

  // 227(w455)などでも、隅にバーが必要な考えは残す。
  // C辺・E辺のようなバー方向と平行な内側辺は、出隅から500mm伸ばしたダブルバーとして追加する。
  getInternalEdges(closed, box, barAxis).forEach((edge) => {
    doubleLines.push(makeDegumiExtendedBarLine(edge, closed, barAxis, 500));
  });

  return {
    barAxis,
    singleLines: normalizeBarLines(singleLines, barAxis),
    doubleLines: normalizeBarLines(doubleLines, barAxis),
    singleValue: formatLinesResult(singleLines),
    doubleValue: formatLinesResult(doubleLines),
    dimensionLabels: makeCenteredBarDimensionLabels(box, barAxis, positions, doublePitch, centerBarType, pitch),
  };
}

function normalizeBarLines(lines, barAxis) {
  return (lines || [])
    .map((line) => normalizeChannelLine(line, barAxis))
    .filter((line) => getLineLength(line) > 1)
    .sort((a, b) => {
      if (barAxis === "H") return a.a.y - b.a.y || a.a.x - b.a.x;
      return a.a.x - b.a.x || a.a.y - b.a.y;
    });
}

function getHorizontalCutLines(points, y, minY, maxY) {
  const closed = closePolygon(points || []);
  const eps = 0.001;
  let targetY = y;

  if (Math.abs(y - minY) <= eps) targetY = y + eps;
  if (Math.abs(y - maxY) <= eps) targetY = y - eps;

  const xs = [];

  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    if (Math.abs(a.x - b.x) > 1) continue;

    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    if (targetY >= top - eps && targetY <= bottom + eps) xs.push(a.x);
  }

  xs.sort((a, b) => a - b);

  const lines = [];
  for (let i = 0; i < xs.length - 1; i += 2) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    if (Math.abs(x2 - x1) > 0.5) {
      lines.push({
        a: { x: Math.round(x1), y: Math.round(y) },
        b: { x: Math.round(x2), y: Math.round(y) },
      });
    }
  }

  return lines;
}

function getVerticalCutLines(points, x, minX, maxX) {
  const closed = closePolygon(points || []);
  const eps = 0.001;
  let targetX = x;

  if (Math.abs(x - minX) <= eps) targetX = x + eps;
  if (Math.abs(x - maxX) <= eps) targetX = x - eps;

  const ys = [];

  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    if (Math.abs(a.y - b.y) > 1) continue;

    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    if (targetX >= left - eps && targetX <= right + eps) ys.push(a.y);
  }

  ys.sort((a, b) => a - b);

  const lines = [];
  for (let i = 0; i < ys.length - 1; i += 2) {
    const y1 = ys[i];
    const y2 = ys[i + 1];
    if (Math.abs(y2 - y1) > 0.5) {
      lines.push({
        a: { x: Math.round(x), y: Math.round(y1) },
        b: { x: Math.round(x), y: Math.round(y2) },
      });
    }
  }

  return lines;
}

function makeDegumiExtendedBarLine(edge, points, barAxis, extend = 500) {
  const closed = closePolygon(points || []);
  const a = { x: Math.round(edge.a.x), y: Math.round(edge.a.y) };
  const b = { x: Math.round(edge.b.x), y: Math.round(edge.b.y) };

  if (barAxis === "H") {
    let minX = Math.min(a.x, b.x);
    let maxX = Math.max(a.x, b.x);
    const y = Math.round(a.y);

    if (isDoubleBarDegumiCorner(closed, a)) {
      if (a.x <= minX + 1) minX -= extend;
      if (a.x >= maxX - 1) maxX += extend;
    }

    if (isDoubleBarDegumiCorner(closed, b)) {
      if (b.x <= minX + 1) minX -= extend;
      if (b.x >= maxX - 1) maxX += extend;
    }

    return { a: { x: Math.round(minX), y }, b: { x: Math.round(maxX), y } };
  }

  let minY = Math.min(a.y, b.y);
  let maxY = Math.max(a.y, b.y);
  const x = Math.round(a.x);

  if (isDoubleBarDegumiCorner(closed, a)) {
    if (a.y <= minY + 1) minY -= extend;
    if (a.y >= maxY - 1) maxY += extend;
  }

  if (isDoubleBarDegumiCorner(closed, b)) {
    if (b.y <= minY + 1) minY -= extend;
    if (b.y >= maxY - 1) maxY += extend;
  }

  return { a: { x, y: Math.round(minY) }, b: { x, y: Math.round(maxY) } };
}

function makeBarPositionsFromCenter(box, barAxis, pitch = 303, doublePitch = 1820, centerBarType = "double") {
  const min = barAxis === "H" ? box.minY : box.minX;
  const max = barAxis === "H" ? box.maxY : box.maxX;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];

  const center = Math.round((min + max) / 2);
  const is303W910Straddle =
    centerBarType === "single" &&
    Math.round(Number(pitch) || 0) === 303 &&
    Math.round(Number(doublePitch) || 0) === 910;

  // 303(w910) の芯跨ぎだけは、中心線にはバーを置かず、
  // 中心から455mmずれた位置をダブルバー基準にする。
  // その基準線から303mmピッチでシングル/ダブルを割り付ける。
  const straddleAnchors = [center - doublePitch / 2, center + doublePitch / 2];

  const allPositions = is303W910Straddle
    ? makeAxisPositionsFromAnchors(min, max, straddleAnchors, pitch)
    : makeCenteredAxisPositions(min, max, center, pitch);

  const doublePositions = is303W910Straddle
    ? makeAxisPositionsFromAnchors(min, max, straddleAnchors, doublePitch)
    : makeCenteredDoubleAxisPositions(
        min,
        max,
        center,
        pitch,
        doublePitch,
        centerBarType
      );

  // 端部は必ずバーを入れる。
  // ただし中心基準設定（227w455等）では、端部バーを無条件でダブルにしない。
  // Wピッチに当たらない端部バーはシングルとして扱う。
  const edgePositions = [Math.round(min), Math.round(max)];

  const doubleTol = Math.max(2, Math.min(pitch * 0.38, 90));
  const items = [];

  const addItem = (value, type) => {
    const rounded = Math.round(value);
    if (rounded < min - 1 || rounded > max + 1) return;

    const existing = items.find((item) => Math.abs(item.value - rounded) <= 2);
    if (!existing) {
      items.push({ value: rounded, type });
      return;
    }

    if (type === "double") existing.type = "double";
    if (rounded === center && centerBarType === "single") existing.type = "single";
  };

  allPositions.forEach((value) => {
    const rounded = Math.round(value);
    const isCenter = Math.abs(rounded - center) <= 2;
    const isDouble =
      !isCenter && doublePositions.some((doubleValue) => Math.abs(doubleValue - rounded) <= doubleTol);

    addItem(rounded, isCenter ? centerBarType : isDouble ? "double" : "single");
  });

  doublePositions.forEach((value) => {
    const rounded = Math.round(value);
    if (Math.abs(rounded - center) <= 2 && centerBarType === "single") return;
    addItem(value, "double");
  });

  // 端部バーは全設定で共通して必ずダブルバーにする。
  edgePositions.forEach((value) => {
    const rounded = Math.round(value);
    const existing = items.find((item) => Math.abs(item.value - rounded) <= 2);
    if (existing) {
      existing.type = "double";
    } else {
      items.push({ value: rounded, type: "double" });
    }
  });

  return items.sort((a, b) => a.value - b.value);
}

function makeAxisPositionsFromAnchors(min, max, anchors = [], pitch = 303) {
  const positions = [];
  const stepSize = Math.max(1, Number(pitch) || 1);

  const add = (value) => {
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value);
    if (rounded < min - 1 || rounded > max + 1) return;
    if (!positions.some((p) => Math.abs(p - rounded) <= 2)) {
      positions.push(rounded);
    }
  };

  anchors.forEach((anchor) => {
    add(anchor);

    let step = 1;
    while (anchor + step * stepSize <= max + 1 || anchor - step * stepSize >= min - 1) {
      add(anchor + step * stepSize);
      add(anchor - step * stepSize);
      step += 1;
      if (step > 1000) break;
    }
  });

  return positions.sort((a, b) => a - b);
}

function makeCenteredDoubleAxisPositions(min, max, center, pitch, doublePitch, centerBarType = "double") {
  const positions = [];
  const basePitch = Math.max(1, Number(pitch) || 1);
  const wPitch = Math.max(basePitch, Number(doublePitch) || basePitch);

  const add = (value) => {
    const rounded = Math.round(value);
    if (rounded < min - 1 || rounded > max + 1) return;
    if (!positions.some((p) => Math.abs(p - rounded) <= 2)) positions.push(rounded);
  };

  // 芯割り：中心がダブル。中心からWピッチごとにダブル。
  // 芯跨ぎ：中心がシングル。中心から1ピッチずらした列をダブルにし、以後Wピッチごと。
  const starts = centerBarType === "single"
    ? [center - basePitch, center + basePitch]
    : [center];

  starts.forEach((start) => {
    add(start);

    let step = 1;
    while (start + step * wPitch <= max + 1 || start - step * wPitch >= min - 1) {
      add(start + step * wPitch);
      add(start - step * wPitch);
      step += 1;
      if (step > 1000) break;
    }
  });

  return positions.sort((a, b) => a - b);
}

function makeCenteredBarDimensionLabels(box, barAxis, positions = [], doublePitch = 455, centerBarType = "double", pitch = 227) {
  if (!positions.length) return [];

  // バーの配置方向に直角な寸法：端部→中心。
  const posMin = barAxis === "V" ? box.minX : box.minY;
  const posMax = barAxis === "V" ? box.maxX : box.maxY;
  const posSpan = Math.max(0, posMax - posMin);
  const edgeToCenter = Math.round(posSpan / 2);

  // バーと平行な辺の半分寸法。
  const parallelSpan = barAxis === "V"
    ? Math.max(0, box.maxY - box.minY)
    : Math.max(0, box.maxX - box.minX);
  const halfParallel = Math.round(parallelSpan / 2);

  // 端部→2本目Wは、芯割り/芯跨ぎの切替とWピッチに連動させる。
  // 例：幅4000、W=455、芯割りの場合は 407.5mm。
  // 芯跨ぎに切り替えた場合も、その時のWバー割付から再計算する。
  const secondDoubleDistance = calcEdgeToSecondWDistance(
    edgeToCenter,
    Number(doublePitch) || 0,
    centerBarType,
    Number(pitch) || 0
  );

  const sideX = box.maxX + Math.max(900, posSpan * 0.32);
  const startY = box.minY + Math.max(650, parallelSpan * 0.20);
  const gapY = Math.max(360, parallelSpan * 0.105);

  return [
    {
      text: `端部→中心 ${edgeToCenter}mm`,
      p: { x: sideX, y: startY },
      anchor: "start",
    },
    {
      text: `端部→2本目W ${formatMmLabel(secondDoubleDistance)}mm`,
      p: { x: sideX, y: startY + gapY },
      anchor: "start",
    },
    {
      text: `半分 ${halfParallel}mm`,
      p: { x: sideX, y: startY + gapY * 2 },
      anchor: "start",
    },
  ];
}


function calcEdgeToSecondWDistance(edgeToCenter, doublePitch, centerBarType = "double", pitch = 0) {
  const center = Number(edgeToCenter) || 0;
  const w = Number(doublePitch) || 0;
  if (center <= 0 || w <= 0) return 0;

  const halfW = w / 2;
  let distance;

  if (centerBarType === "single") {
    // 芯跨ぎ：中心はシングル。
    // Wは中心を跨ぐ位置（中心±W/2）を基準にする。
    // 例：幅4000、W455 → 2000 - 227.5 = 1772.5、端部側の最初の内側Wは407.5mm。
    distance = center - halfW;
  } else {
    // 芯割り：中心はダブル。
    // 端部もW扱いなので「2本目W」は端部から最初の内側Wまで。
    // 例：幅4000、W455 → 2000を中心Wにした割付の端部側最初の内側Wは180mm。
    distance = center;
  }

  distance = ((distance % w) + w) % w;

  // 0に重なる場合は、次のW位置を表示する。
  if (distance < 0.001) distance = w;

  return Math.round(distance * 10) / 10;
}

function formatMmLabel(value) {
  const n = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function makeCenteredAxisPositions(min, max, center, pitch) {
  const positions = [];
  const add = (value) => {
    const rounded = Math.round(value);
    if (rounded < min - 1 || rounded > max + 1) return;
    if (!positions.some((p) => Math.abs(p - rounded) <= 2)) positions.push(rounded);
  };

  add(min);
  add(max);
  add(center);

  let step = 1;
  while (center + step * pitch <= max + 1 || center - step * pitch >= min - 1) {
    add(center + step * pitch);
    add(center - step * pitch);
    step += 1;
    if (step > 1000) break;
  }

  return positions.sort((a, b) => a - b);
}

function formatLinesResult(lines) {
  if (!Array.isArray(lines) || !lines.length) return "0 本";

  const counts = {};
  lines.forEach((line) => addLengthCount(counts, getLineLength(line), 1));
  return formatLengthCounts(counts);
}

function makeDoubleBarResult(dims, shape, pitch = 1820) {
  const points = buildPolygonFromDims(dims, shape);
  if (!points) return "寸法未入力";

  const longestEdge = getLongestEdge(dims, shape);
  if (!longestEdge) return "寸法未入力";

  const box = getBox(points);
  const counts = {};

  if (longestEdge.axis === "V") {
    const xs = makeEdgePitchPositions(box.minX, box.maxX, pitch);

    xs.forEach((x) => {
      getVerticalCutSegments(points, x, box.minX, box.maxX).forEach((len) => {
        addLengthCount(counts, len, 1);
      });
    });

    // 内側の段差辺にダブルバーが入る場合：
    // 端が「出隅」なら、出隅1か所につき +500mm。
    getInternalEdges(points, box, "V").forEach((edge) => {
      const len = Math.abs(edge.b.y - edge.a.y);
      const degumiCount = countDoubleBarDegumiCorners(points, edge);
      addLengthCount(counts, len + degumiCount * 500, 1);
    });
  }

  if (longestEdge.axis === "H") {
    const ys = makeEdgePitchPositions(box.minY, box.maxY, pitch);

    ys.forEach((y) => {
      getHorizontalCutSegments(points, y, box.minY, box.maxY).forEach((len) => {
        addLengthCount(counts, len, 1);
      });
    });

    // 例：G=2000 で両端が出隅なら 2000 + 500 + 500 = 3000
    getInternalEdges(points, box, "H").forEach((edge) => {
      const len = Math.abs(edge.b.x - edge.a.x);
      const degumiCount = countDoubleBarDegumiCorners(points, edge);
      addLengthCount(counts, len + degumiCount * 500, 1);
    });
  }

  return formatLengthCounts(counts);
}

function makeSingleBarResult(dims, shape, pitch = 303, doublePitch = 1820) {
  const points = buildPolygonFromDims(dims, shape);
  if (!points) return "寸法未入力";

  const longestEdge = getLongestEdge(dims, shape);
  if (!longestEdge) return "寸法未入力";

  const box = getBox(points);
  const counts = {};
  const excludeTol = 40;

  if (longestEdge.axis === "V") {
    const doubleXs = makeEdgePitchPositions(box.minX, box.maxX, doublePitch);
    const xs = [];

    for (let x = box.minX + pitch; x < box.maxX; x += pitch) {
      if (doubleXs.some((d) => Math.abs(d - x) <= excludeTol)) continue;
      xs.push(x);
    }


    uniqueNumbers(xs).forEach((x) => {
      getVerticalCutSegments(points, x, box.minX, box.maxX).forEach((len) => {
        addLengthCount(counts, len, 1);
      });
    });
  }

  if (longestEdge.axis === "H") {
    const doubleYs = makeEdgePitchPositions(box.minY, box.maxY, doublePitch);
    const ys = [];

    for (let y = box.minY + pitch; y < box.maxY; y += pitch) {
      if (doubleYs.some((d) => Math.abs(d - y) <= excludeTol)) continue;
      ys.push(y);
    }


    uniqueNumbers(ys).forEach((y) => {
      getHorizontalCutSegments(points, y, box.minY, box.maxY).forEach((len) => {
        addLengthCount(counts, len, 1);
      });
    });
  }

  return formatLengthCounts(counts);
}

function groupSameLengthSections(cuts, axisKey) {
  if (!cuts.length) return [];

  const groups = [];
  let current = {
    len: cuts[0].len,
    start: cuts[0][axisKey],
    end: cuts[0][axisKey],
  };

  for (let i = 1; i < cuts.length; i++) {
    const c = cuts[i];

    if (c.len === current.len) {
      current.end = c[axisKey];
    } else {
      groups.push(current);
      current = {
        len: c.len,
        start: c[axisKey],
        end: c[axisKey],
      };
    }
  }

  groups.push(current);
  return groups;
}

function addLengthCount(counts, len, count = 1) {
  const n = Math.round(Number(len) || 0);
  if (n <= 0 || count <= 0) return;
  counts[n] = (counts[n] || 0) + count;
}

function roundUp500(value) {
  const n = Math.round(Number(value) || 0);
  if (n <= 0) return 0;
  return Math.ceil(n / 500) * 500;
}

function makeEdgePitchPositions(min, max, pitch) {
  const positions = [Math.round(min)];
  let current = min + pitch;
  let guard = 0;

  while (current < max - 0.001 && guard < 1000) {
    positions.push(Math.round(current));
    current += pitch;
    guard += 1;
  }

  const end = Math.round(max);
  if (!positions.includes(end)) positions.push(end);

  return positions.sort((a, b) => a - b);
}

function getInternalEdges(points, box, axis) {
  const edges = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const isH = Math.abs(a.y - b.y) <= 1;
    const isV = Math.abs(a.x - b.x) <= 1;

    if (axis === "H" && isH) {
      const y = Math.round(a.y);
      if (Math.abs(y - box.minY) > 1 && Math.abs(y - box.maxY) > 1) {
        edges.push({ a, b, axis: "H" });
      }
    }

    if (axis === "V" && isV) {
      const x = Math.round(a.x);
      if (Math.abs(x - box.minX) > 1 && Math.abs(x - box.maxX) > 1) {
        edges.push({ a, b, axis: "V" });
      }
    }
  }

  return edges;
}


// ダブルバー用：辺の両端にある「出隅」の数を数える。
// このアプリでは、段差の内側にある角を現場上の出隅として扱い、
// 1か所につきバー長さを +500mm する。
function countDoubleBarDegumiCorners(points, edge) {
  let count = 0;

  if (isDoubleBarDegumiCorner(points, edge.a)) count += 1;
  if (isDoubleBarDegumiCorner(points, edge.b)) count += 1;

  return count;
}

function isDoubleBarDegumiCorner(points, point) {
  const index = findVertexIndex(points, point);
  if (index < 0) return false;

  // polygon上では凹角になる点を、軽天の出隅補正対象にする。
  // 外周の普通の角は足さない。
  return isConcaveCorner(points, index);
}

function findVertexIndex(points, point) {
  const last = points.length - 1;

  for (let i = 0; i < last; i++) {
    if (
      Math.abs(points[i].x - point.x) <= 1 &&
      Math.abs(points[i].y - point.y) <= 1
    ) {
      return i;
    }
  }

  return -1;
}

function isConcaveCorner(points, index) {
  const last = points.length - 1;
  if (last < 3) return false;

  const prev = points[(index - 1 + last) % last];
  const curr = points[index];
  const next = points[(index + 1) % last];

  const v1 = {
    x: curr.x - prev.x,
    y: curr.y - prev.y,
  };

  const v2 = {
    x: next.x - curr.x,
    y: next.y - curr.y,
  };

  const cross = v1.x * v2.y - v1.y * v2.x;
  const area = signedArea(points);

  if (Math.abs(cross) < 0.001 || Math.abs(area) < 0.001) return false;

  // convexなら cross と area の向きが同じ。
  // 逆向きなら凹角。
  return cross * area < 0;
}

function signedArea(points) {
  const last = points.length - 1;
  let sum = 0;

  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % last];
    sum += a.x * b.y - b.x * a.y;
  }

  return sum;
}


function getInsideOffsetLine(edge, points, margin = 100) {
  const mid = {
    x: (edge.a.x + edge.b.x) / 2,
    y: (edge.a.y + edge.b.y) / 2,
  };

  if (edge.axis === "H") {
    const plus = { x: mid.x, y: mid.y + margin };
    const minus = { x: mid.x, y: mid.y - margin };
    if (pointInPolygon(plus, points)) return Math.round(plus.y);
    if (pointInPolygon(minus, points)) return Math.round(minus.y);
  }

  if (edge.axis === "V") {
    const plus = { x: mid.x + margin, y: mid.y };
    const minus = { x: mid.x - margin, y: mid.y };
    if (pointInPolygon(plus, points)) return Math.round(plus.x);
    if (pointInPolygon(minus, points)) return Math.round(minus.x);
  }

  return null;
}

function getShorterOffsetLine(edge, points, box, margin = 100) {
  const candidates = [];

  if (edge.axis === "V") {
    const x1 = edge.a.x - margin;
    const x2 = edge.a.x + margin;
    [x1, x2].forEach((x) => {
      const len = getVerticalCutLength(points, x, box.minX, box.maxX);
      if (len > 0) candidates.push({ value: x, len });
    });
  }

  if (edge.axis === "H") {
    const y1 = edge.a.y - margin;
    const y2 = edge.a.y + margin;
    [y1, y2].forEach((y) => {
      const len = getHorizontalCutLength(points, y, box.minY, box.maxY);
      if (len > 0) candidates.push({ value: y, len });
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.len - b.len);
  return Math.round(candidates[0].value);
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.map((v) => Math.round(v)))).sort(
    (a, b) => a - b
  );
}

function getLongestEdge(dims, shape) {
  if (!shape?.edges?.length) return null;

  const edges = shape.edges
    .map((edge) => ({
      ...edge,
      len: Number(dims[edge.key]) || 0,
    }))
    .filter((edge) => edge.len > 0)
    .sort((a, b) => b.len - a.len);

  return edges[0] || null;
}

function formatLengthCounts(counts) {
  const result = Object.entries(counts)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([len, count]) => `${len} × ${count}本`);

  return result.length ? result.join("　") : "0 本";
}

function buildPolygonFromDims(dims, shape) {
  if (!shape?.edges?.length) return null;

  let x = 0;
  let y = 0;
  const points = [{ x, y }];

  for (const edge of shape.edges) {
    const len = Number(dims[edge.key]) || 0;
    if (!len) return null;

    if (edge.axis === "H") x += edge.sign * len;
    if (edge.axis === "V") y += edge.sign * len;

    points.push({ x, y });
  }

  // V52: 寸法の誤差や未補正で最後の点が始点に戻らない時、
  // SVGのpolygonが最後から最初へ斜め線を引いてしまう。
  // その斜め閉じ線を禁止し、必ず水平・垂直の2本以内で閉じる。
  return closeOrthogonalPolygon(points);
}


function closeOrthogonalPolygon(points) {
  if (!Array.isArray(points) || points.length < 2) return points || [];

  const out = points
    .filter(Boolean)
    .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

  if (out.length < 2) return out;

  const first = out[0];
  const last = out[out.length - 1];
  const sameX = Math.abs(last.x - first.x) <= 1;
  const sameY = Math.abs(last.y - first.y) <= 1;

  if (sameX && sameY) {
    out[out.length - 1] = { ...first };
    return dedupeNeighbors(out, 1);
  }

  // 片方だけずれている時は、始点へまっすぐ戻す。
  if (sameX || sameY) {
    out.push({ ...first });
    return dedupeNeighbors(out, 1);
  }

  // 両方ずれている時は、斜めで閉じずにL字で閉じる。
  // 最後の辺の方向を見て、自然に曲がる順番を決める。
  const prev = out[out.length - 2] || last;
  const lastAxis = Math.abs(last.x - prev.x) >= Math.abs(last.y - prev.y) ? "H" : "V";

  const bend = lastAxis === "H"
    ? { x: last.x, y: first.y }
    : { x: first.x, y: last.y };

  if (Math.abs(bend.x - last.x) > 1 || Math.abs(bend.y - last.y) > 1) {
    out.push(bend);
  }
  out.push({ ...first });

  return dedupeNeighbors(out, 1);
}

function getBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}


function getVerticalCutSegments(points, x, minX, maxX) {
  const eps = 0.001;
  let targetX = x;

  if (x === minX) targetX = x + eps;
  if (x === maxX) targetX = x - eps;

  const ys = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.y - b.y) > 1) continue;

    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);

    if (targetX >= left && targetX <= right) {
      ys.push(a.y);
    }
  }

  ys.sort((a, b) => a - b);

  const segments = [];

  for (let i = 0; i < ys.length - 1; i += 2) {
    const len = Math.abs(ys[i + 1] - ys[i]);
    if (len > 0.5) segments.push(Math.round(len));
  }

  return segments;
}

function getHorizontalCutSegments(points, y, minY, maxY) {
  const eps = 0.001;
  let targetY = y;

  if (y === minY) targetY = y + eps;
  if (y === maxY) targetY = y - eps;

  const xs = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.x - b.x) > 1) continue;

    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);

    if (targetY >= top && targetY <= bottom) {
      xs.push(a.x);
    }
  }

  xs.sort((a, b) => a - b);

  const segments = [];

  for (let i = 0; i < xs.length - 1; i += 2) {
    const len = Math.abs(xs[i + 1] - xs[i]);
    if (len > 0.5) segments.push(Math.round(len));
  }

  return segments;
}

function getVerticalCutLength(points, x, minX, maxX) {
  const eps = 0.001;
  let targetX = x;

  if (x === minX) targetX = x + eps;
  if (x === maxX) targetX = x - eps;

  const ys = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.y - b.y) > 1) continue;

    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);

    if (targetX >= left && targetX <= right) {
      ys.push(a.y);
    }
  }

  ys.sort((a, b) => a - b);

  let total = 0;

  for (let i = 0; i < ys.length - 1; i += 2) {
    total += Math.abs(ys[i + 1] - ys[i]);
  }

  return Math.round(total);
}

function getHorizontalCutLength(points, y, minY, maxY) {
  const eps = 0.001;
  let targetY = y;

  if (y === minY) targetY = y + eps;
  if (y === maxY) targetY = y - eps;

  const xs = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.x - b.x) > 1) continue;

    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);

    if (targetY >= top && targetY <= bottom) {
      xs.push(a.x);
    }
  }

  xs.sort((a, b) => a - b);

  let total = 0;

  for (let i = 0; i < xs.length - 1; i += 2) {
    total += Math.abs(xs[i + 1] - xs[i]);
  }

  return Math.round(total);
}

function onlyNumber(value) {
  return String(value).replace(/[^\d]/g, "");
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function screenArea(points) {
  let sum = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }

  return sum;
}

function dedupeNeighbors(points, tol = 3) {
  const out = [];

  for (const p of points) {
    if (!out.length || distance(out[out.length - 1], p) > tol) {
      out.push({ x: p.x, y: p.y });
    }
  }

  return out;
}

function closePolygon(points) {
  if (!points.length) return [];

  const out = points.slice();
  const first = out[0];
  const last = out[out.length - 1];

  if (distance(first, last) > 6) {
    out.push({ ...first });
  }

  return out;
}

function removeTinySegmentsClosed(points, minLen = 12) {
  if (points.length < 4) return points;

  let out = closePolygon(points).slice(0, -1);
  let changed = true;
  let guard = 0;

  while (changed && out.length > 3 && guard < 30) {
    changed = false;
    guard += 1;

    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];

      if (distance(a, b) < minLen) {
        // 短いノイズ辺は、次の点を消して周囲をつなぐ。
        out.splice((i + 1) % out.length, 1);
        changed = true;
        break;
      }
    }
  }

  return closePolygon(out);
}

function mergeCollinearClosed(points, tol = 2) {
  if (points.length < 4) return points;

  let out = closePolygon(points).slice(0, -1);
  let changed = true;
  let guard = 0;

  while (changed && out.length >= 3 && guard < 40) {
    changed = false;
    guard += 1;
    const merged = [];

    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const curr = out[i];
      const next = out[(i + 1) % out.length];

      const sameX =
        Math.abs(prev.x - curr.x) <= tol && Math.abs(curr.x - next.x) <= tol;
      const sameY =
        Math.abs(prev.y - curr.y) <= tol && Math.abs(curr.y - next.y) <= tol;

      if (sameX || sameY) {
        changed = true;
        continue;
      }

      merged.push(curr);
    }

    out = merged;
  }

  return closePolygon(out);
}

function makeBoxFromPoints(points) {
  if (!points || !points.length) return defaultPoints.map((p) => ({ ...p }));

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = maxX - minX;
  const height = maxY - minY;

  // V55: 手書きが直線だけの場合、つぶれた四角を作らない。
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 30 || height < 30) {
    return defaultPoints.map((p) => ({ ...p }));
  }

  return rotateFromTopLeft([
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points.slice();

  let maxDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
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

function lineDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) return distance(point, start);

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
    (dx * dx + dy * dy);

  const px = start.x + t * dx;
  const py = start.y + t * dy;

  return Math.hypot(point.x - px, point.y - py);
}