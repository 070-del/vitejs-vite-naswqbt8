// V44_CORE_SPLIT_STRADDLE_RULES_DIMENSION_LABELS
// V46_EDGE_TO_SECOND_W_LINKED_TO_CORE_MODE
// V51_227W455_EDGE_SINGLE_REMOVE_FRAMES
// 303(w1820) と 227(w455) は変更しない。
// 303(w910) の芯跨ぎだけ、中心±455mmをダブル基準にして303ピッチで配置する。
// 基本303(w1820)と364の下地・ボードは左上基準。364の岩綿だけ芯基準。
// V47_EDGE_TO_SECOND_W_CORE_SPLIT_180_FORMULA
// 芯割り: 端部→2本目W = 端部から最初の内側Wまで（例 4000/W455 = 180mm）
// 芯跨ぎ: 端部→2本目W = 中心跨ぎW割付（例 4000/W455 = 407.5mm）
// V55_NO_ANGLED_FRAMES_NO_LINE_SHAPE_FIX
// V54_SIDE_CONTROLS_IN_GRAY_AREA_FIX
// 右側の寸法表示と芯割り/芯跨ぎボタンを、図形右側の指定位置に固定する。
// 端部バーは全設定で必ずダブルバー。
// 結果ページ右側の寸法表示と芯割り/芯跨ぎボタンは上下に分けて固定表示する。
// V24_CHANNEL_UNIFIED_SINGLE_SOURCE
import { useEffect, useId, useRef, useState } from "react";
import "./App.css";
import {
  tapHaptic,
  successHaptic,
  warningHaptic,
  shareResults,
  saveToNativeStorage,
  loadFromNativeStorage,
  removeFromNativeStorage,
  getAllNativeStorageKeys,
} from "./native.js";

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

const boardSize = { key: "910x1820", width: 910, height: 1820, name: "910×1820mm", sheetsPerTsubo: 2 };
const smallGypsumBoardSize = { key: "455x910", width: 455, height: 910, name: "455×910mm", sheetsPerTsubo: 8 };
const squareGypsumBoardSize = { key: "910x910", width: 910, height: 910, name: "910×910mm", sheetsPerTsubo: 4 };
const rockWoolBoardSize = { key: "300x600", width: 300, height: 600, name: "300×600mm", sheetsPerTsubo: 18 };

function isRockWoolSetting(settings = {}) {
  return Number(settings.barPitch) === 364;
}

function getResultDiagramPages(settings = {}) {
  return isRockWoolSetting(settings) ? ["下地", "ボード", "岩綿"] : ["下地", "ボード"];
}

const userProfileStorageKey = "ceiling-user-profile";

function isUserProfileComplete(profile) {
  return Boolean(
    profile?.name?.trim() &&
      profile?.company?.trim() &&
      profile?.phone?.trim() &&
      profile?.email?.trim()
  );
}

export default function App() {
  const [page, setPage] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [shape, setShape] = useState(makeShape(defaultPoints));
  const [dims, setDims] = useState({});

  const [settings, setSettings] = useState({
    barPitch: 303,
    barW: 1820,
    barType: "基本",
    bisPitch: 303,
    boardSizeKey: "910x1820",
    finish: "岩綿",
    glassWool: "無し",
    // 芯割=中心をダブル、芯股ぎ=中心をシングル。基本は芯割。
    centerBarType: "double",
    verticalCenterBarType: "double",
    squareBoardPattern: "straight",
    screwSpec: "general",
  });
  const [showSavedRooms, setShowSavedRooms] = useState(false);
  const [savedRooms, setSavedRooms] = useState([]);
  const [selectedSavedRoom, setSelectedSavedRoom] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [resultDiagramPage, setResultDiagramPage] = useState(0);
  const resultDiagramPages = getResultDiagramPages(settings);
  const activeDiagramPage = Math.min(resultDiagramPage, resultDiagramPages.length - 1);
  const showBoardLayout = activeDiagramPage > 0;
  const boardLayer = activeDiagramPage === 2 ? "rockWool" : "board";
  const showCenterControls = usesCenteredBoardLayout(settings, boardLayer);
  const nextResultDiagram = () => setResultDiagramPage((activeDiagramPage + 1) % resultDiagramPages.length);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const [modal, setModal] = useState(null);

  const canvasRef = useRef(null);
  const canvasReady = useRef(false);
  const drawing = useRef(false);
  const pointsRef = useRef([]);

  useEffect(() => {
    const preventHorizontalScroll = () => {
      if (window.scrollX !== 0) {
        window.scrollTo(0, window.scrollY);
      }
    };
    window.addEventListener("scroll", preventHorizontalScroll);

    let lastTouchX = 0;
    let lastTouchY = 0;
    const preventHorizontalTouch = (e) => {
      if (e.touches.length !== 1) return;
      const dx = Math.abs(e.touches[0].clientX - lastTouchX);
      const dy = Math.abs(e.touches[0].clientY - lastTouchY);
      if (dx > dy && dx > 4) {
        e.preventDefault();
      }
    };
    const recordTouchStart = (e) => {
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };
    document.addEventListener("touchstart", recordTouchStart, { passive: true });
    document.addEventListener("touchmove", preventHorizontalTouch, { passive: false });

    return () => {
      window.removeEventListener("scroll", preventHorizontalScroll);
      document.removeEventListener("touchstart", recordTouchStart);
      document.removeEventListener("touchmove", preventHorizontalTouch);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUserProfile = async () => {
      try {
        const raw = await loadFromNativeStorage(userProfileStorageKey);
        if (!raw || cancelled) return;
        const profile = JSON.parse(raw);
        setUserProfile({
          name: profile?.name || "",
          company: profile?.company || "",
          phone: profile?.phone || "",
          email: profile?.email || "",
        });
      } catch (e) {
        console.warn("Failed to load user profile:", e);
      } finally {
        if (!cancelled) {
          setUserProfileLoaded(true);
        }
      }
    };

    loadUserProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userProfileLoaded) return;
    if (!isUserProfileComplete(userProfile)) {
      setShowUserProfile(true);
    }
  }, [userProfileLoaded, userProfile]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    document.documentElement.scrollTop = 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }, [page]);

  const showAlert = (message) => {
    return new Promise((resolve) => {
      setModal({ type: "alert", message, resolve });
    });
  };

  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setModal({ type: "confirm", message, resolve });
    });
  };

  const showPrompt = (message, defaultValue = "") => {
    return new Promise((resolve) => {
      setModal({ type: "prompt", message, defaultValue, resolve });
    });
  };

  const closeModal = (result) => {
    if (modal && modal.resolve) modal.resolve(result);
    setModal(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvasReady.current = false;

    const applyCanvasSize = () => {
      void canvas.offsetHeight;
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.round(rect.width);
      const cssH = Math.round(rect.height);
      if (cssW < 50 || cssH < 50) return;

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(cssW * dpr);
      const targetH = Math.round(cssH * dpr);
      if (canvas.width === targetW && canvas.height === targetH) {
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvasReady.current = true;
        return;
      }

      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
      canvasReady.current = true;
    };

    applyCanvasSize();
    let raf2, raf3;
    const raf1 = requestAnimationFrame(() => {
      applyCanvasSize();
      raf2 = requestAnimationFrame(() => {
        applyCanvasSize();
        raf3 = requestAnimationFrame(() => {
          applyCanvasSize();
        });
      });
    });

    const ro = new ResizeObserver(() => applyCanvasSize());
    ro.observe(canvas);

    window.addEventListener("resize", applyCanvasSize);

    const preventScroll = (e) => e.preventDefault();
    canvas.addEventListener("touchstart", preventScroll, { passive: false });
    canvas.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (raf3) cancelAnimationFrame(raf3);
      ro.disconnect();
      window.removeEventListener("resize", applyCanvasSize);
      canvas.removeEventListener("touchstart", preventScroll);
      canvas.removeEventListener("touchmove", preventScroll);
    };
  }, [page]);

  const ensureCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    void canvas.offsetHeight;

    const rect = canvas.getBoundingClientRect();
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.height);
    if (cssW < 50 || cssH < 50) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);

    const ctx = canvas.getContext("2d");

    if (canvas.width === targetW && canvas.height === targetH) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    canvasReady.current = true;
  };

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    ensureCanvasSize();
    e.target.setPointerCapture(e.pointerId);
    drawing.current = true;
    pointsRef.current = [];

    const p = getPoint(e);
    pointsRef.current.push(p);

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvasRef.current.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();

    const p = getPoint(e);
    const arr = pointsRef.current;
    const last = arr[arr.length - 1];

    if (!last || distance(last, p) > 5) {
      arr.push(p);
    } else {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvasRef.current.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (drawing.current && e && e.target && e.pointerId !== undefined) {
      e.target.releasePointerCapture(e.pointerId);
    }
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    tapHaptic();
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
      showAlert(`未入力の寸法があります：${missingKeys.join("、")}`);
      return;
    }

    setPage(3);
    successHaptic();
  };

  const results = makeResults(dims, settings, shape);

  const loadSavedRooms = async () => {
    const rooms = [];
    let keys;
    try {
      keys = await getAllNativeStorageKeys();
    } catch (e) {
      console.error("Failed to load storage keys:", e);
      return [];
    }

    for (const key of keys) {
      if (!key || !key.startsWith("ceiling-")) continue;

      try {
        const raw = await loadFromNativeStorage(key);
        const data = JSON.parse(raw);
        rooms.push({ key, ...data });
      } catch (e) {
        console.warn(`Skipped corrupted data (key: ${key}):`, e);
      }
    }

    return rooms.sort((a, b) => String(b.key).localeCompare(String(a.key)));
  };

  const openSavedRooms = async () => {
    await tapHaptic();
    setSelectedSavedRoom(null);
    setSavedRooms(await loadSavedRooms());
    setShowSavedRooms(true);
  };

  const deleteSavedRoom = async (key) => {
    const confirmed = await showConfirm("この保存データを削除しますか？");
    if (!confirmed) return;
    await warningHaptic();
    await removeFromNativeStorage(key);
    setSavedRooms(await loadSavedRooms());
  };

  const renameSavedRoom = async (key, currentName = "") => {
    const nextName = await showPrompt("新しい名前を入力してください", currentName || "未入力");
    if (nextName === null) return;

    const cleanName = nextName.trim() || "未入力";

    try {
      const raw = await loadFromNativeStorage(key);
      const data = JSON.parse(raw);
      if (!data) return;

      data.name = cleanName;
      await saveToNativeStorage(key, JSON.stringify(data));
      await tapHaptic();

      const rooms = await loadSavedRooms();
      setSavedRooms(rooms);
      setSelectedSavedRoom((prev) =>
        prev && prev.key === key ? { ...prev, name: cleanName } : prev
      );
    } catch (e) {
      console.error("Rename failed:", e);
      showAlert("名称変更に失敗しました");
    }
  };

  const saveData = async () => {
    const data = {
      name: projectName || "未入力",
      dims,
      settings,
      shape,
      results,
      savedAt: new Date().toLocaleString(),
    };

    try {
      await saveToNativeStorage(`ceiling-${Date.now()}`, JSON.stringify(data));
      setSavedRooms(await loadSavedRooms());
      await successHaptic();
      showAlert("保存しました");
    } catch (e) {
      console.error("Save failed:", e);
      showAlert("保存に失敗しました。端末のストレージ容量を確認してください。");
    }
  };

  const saveUserProfile = async (profile) => {
    const cleanProfile = {
      name: profile.name?.trim() || "",
      company: profile.company?.trim() || "",
      phone: profile.phone?.trim() || "",
      email: profile.email?.trim() || "",
    };

    if (!isUserProfileComplete(cleanProfile)) {
      await warningHaptic();
      await showAlert("ユーザー情報はすべて必須です。氏名、会社名、電話番号、メールアドレスを入力してください。");
      return false;
    }

    try {
      await saveToNativeStorage(userProfileStorageKey, JSON.stringify(cleanProfile));
      setUserProfile(cleanProfile);
      await successHaptic();
      await showAlert("ユーザー情報を保存しました");
      return true;
    } catch (e) {
      console.error("User profile save failed:", e);
      await showAlert("ユーザー情報の保存に失敗しました");
      return false;
    }
  };

  const handleShareResults = async () => {
    await tapHaptic();
    const lines = results.map((item) => `${item.name}: ${item.value}`);
    const text = [
      `【${projectName || "未入力"}】軽天計算結果`,
      "",
      ...lines,
      "",
      `設定: バーピッチ ${settings.barPitch}(w${settings.barW})`,
    ].join("\n");
    await shareResults("軽天計算結果", text);
  };

  const openKeitenQuestion = async () => {
    await tapHaptic();
    if (!isUserProfileComplete(userProfile)) {
      setShowUserProfile(true);
      return;
    }
    setShowQuestionModal(true);
  };

  const submitKeitenQuestion = async (question) => {
    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      await warningHaptic();
      await showAlert("質問内容を入力してください");
      return false;
    }

    const resultLines = results.length
      ? results.map((item) => `${item.name}: ${item.value}`)
      : ["計算結果なし"];

    const text = [
      "【軽天について質問】",
      "",
      "■ ユーザー情報",
      `氏名: ${userProfile.name}`,
      `会社名: ${userProfile.company}`,
      `電話番号: ${userProfile.phone}`,
      `メール: ${userProfile.email}`,
      "",
      "■ 質問内容",
      cleanQuestion,
      "",
      "■ 現在の計算結果",
      ...resultLines,
      "",
      `設定: バーピッチ ${settings.barPitch}(w${settings.barW}) / ボード ${getBoardSizeOption(settings).name}`,
    ].join("\n");

    await shareResults("軽天について質問", text);
    return true;
  };

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

          <section className="canvasBox" aria-label="天井形状の手書き入力エリア">
            <canvas
              ref={canvasRef}
              width={1}
              height={1}
              role="img"
              aria-label="天井の形を手書きで描いてください"
              style={{ touchAction: "none" }}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              onPointerCancel={endDraw}
            />
          </section>

          <h2 className="sectionTitle">設定カスタム</h2>

          <section className="settingCard">
            <BarPitchSelector settings={settings} setSettings={setSettings} />
          </section>

          <button className="questionWideBtn" onClick={openKeitenQuestion}>
            軽天について質問する
          </button>
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
            className={
              showBoardLayout
                ? "resultShapeControlRow boardLayoutActive"
                : "resultShapeControlRow"
            }
            role="button"
            tabIndex={0}
            aria-label={isRockWoolSetting(settings) ? "図形をタップして下地・ボード・岩綿を切り替える" : "図形をタップしてボード割付表示を切り替える"}
            onClick={nextResultDiagram}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                nextResultDiagram();
              }
            }}
            style={{
              position: "relative",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              maxWidth: "100%",
              minHeight: showCenterControls ? 315 : undefined,
              marginBottom: 12,
              overflow: "visible",
            }}
          >
            <ZoomableDiagram key={`${activeDiagramPage}-${shape.type}`}>
            <CleanShape
              shape={shape}
              small
              dims={dims}
              settings={settings}
              showValues
              showBoltDots={!showBoardLayout}
              showChannelLines={!showBoardLayout}
              showBarLines={!showBoardLayout}
              showBoardLayout={showBoardLayout}
              boardLayer={boardLayer}
              showBarDimensionLabels={false}
            />
            </ZoomableDiagram>

            {showCenterControls && (
              <div
                className="resultSideControls"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 7,
                  flex: "0 0 205px",
                  maxWidth: "100%",
                  zIndex: 3,
                }}
              >
                <CenterBarTypeToggle settings={settings} setSettings={setSettings} compact direction="horizontal" />
                <div
                  className="barDimensionTextList"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#334155",
                    lineHeight: 1.3,
                    whiteSpace: "normal",
                    wordBreak: "keep-all",
                  }}
                >
                  {getResultBarDimensionTexts(dims, shape, settings, boardLayer).map((text) => (
                    <div key={text}>{text}</div>
                  ))}
                </div>
                <CenterBarTypeToggle settings={settings} setSettings={setSettings} compact direction="vertical" />
                <div
                  className="barDimensionTextList"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#334155",
                    lineHeight: 1.3,
                    whiteSpace: "normal",
                    wordBreak: "keep-all",
                  }}
                >
                  {getVerticalResultBarDimensionTexts(dims, shape, settings, boardLayer).map((text) => (
                    <div key={text}>{text}</div>
                  ))}
                </div>
                {getBoardSizeOption(settings).key === "910x910" && (
                  <div className="boardPatternToggle" role="group" aria-label="3×3ジプトーンの貼り方">
                    {[["straight", "芋貼り"], ["brick", "レンガ貼り"]].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={(settings.squareBoardPattern || "straight") === value}
                        onClick={() => setSettings((prev) => ({ ...prev, squareBoardPattern: value }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <section className="resultCard">
            {results.map((item) => (
              <div
                className={[
                  "resultRow",
                  item.category === "board" ? "boardSectionRow" : "",
                  item.name === "ビス" ? "screwResultRow" : "",
                ].filter(Boolean).join(" ")}
                key={item.name}
              >
                <strong>{item.name}</strong>
                <span className="resultValue">
                  {item.name === "ビス" && isGyptoneSetting(settings) && (
                    <span className="screwSpecToggle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={(settings.screwSpec || "general") === "general" ? "active" : ""}
                        onClick={() => setSettings({ ...settings, screwSpec: "general" })}
                      >
                        一般
                      </button>
                      <button
                        type="button"
                        className={settings.screwSpec === "public" ? "active" : ""}
                        onClick={() => setSettings({ ...settings, screwSpec: "public" })}
                      >
                        公共
                      </button>
                    </span>
                  )}
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
            <button className="shareBtn" onClick={handleShareResults}>
              📤 結果を共有
            </button>
            <button className="questionWideBtn compactQuestionBtn" onClick={openKeitenQuestion}>
              軽天について質問する
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
          onShowUserProfile={() => {
            setShowSavedRooms(false);
            setShowUserProfile(true);
          }}
          onShowPrivacy={() => {
            setShowSavedRooms(false);
            setShowPrivacyPolicy(true);
          }}
          onShowTerms={() => {
            setShowSavedRooms(false);
            setShowTermsOfService(true);
          }}
        />
      )}

      {showUserProfile && (
        <UserProfileModal
          profile={userProfile}
          required={!isUserProfileComplete(userProfile)}
          onClose={() => setShowUserProfile(false)}
          onSave={saveUserProfile}
        />
      )}

      {showQuestionModal && (
        <KeitenQuestionModal
          onClose={() => setShowQuestionModal(false)}
          onSubmit={submitKeitenQuestion}
        />
      )}

      {selectedSavedRoom && (
        <SavedRoomDetail
          room={selectedSavedRoom}
          onClose={() => setSelectedSavedRoom(null)}
          onRename={renameSavedRoom}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}

      {showTermsOfService && (
        <TermsOfServiceModal onClose={() => setShowTermsOfService(false)} />
      )}

      {modal && (
        <NativeModal modal={modal} onClose={closeModal} />
      )}
    </div>
  );
}

function TermsOfServiceModal({ onClose }) {
  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer privacyDrawer">
        <div className="drawerHeader">
          <strong>利用規約</strong>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="privacyContent">
          <h3>軽天材拾い出し 利用規約</h3>
          <p>最終更新日：2026年9月12日</p>

          <h4>1. サービスの概要</h4>
          <p>
            本アプリ「軽天材拾い出し」（以下「本アプリ」）は、軽量鉄骨天井（軽天）の
            下地材拾い出し計算をサポートするツールです。
            本利用規約（以下「本規約」）は、本アプリの利用に関する条件を定めるものです。
            本アプリをご利用になった時点で、本規約に同意したものとみなします。
          </p>

          <h4>2. 利用料金</h4>
          <p>本アプリのすべての機能は無料でご利用いただけます。</p>

          <h4>3. 免責事項</h4>
          <p>
            本アプリが提供する計算結果は参考値です。実際の施工に際しては、
            必ず専門家による確認を行ってください。
            本アプリの計算結果に基づく損害について、開発者は一切の責任を負いません。
          </p>

          <h4>4. 知的財産権</h4>
          <p>
            本アプリに含まれるすべてのコンテンツ（デザイン、ロゴ、テキスト、
            ソフトウェアなど）に関する知的財産権は、開発者に帰属します。
          </p>

          <h4>5. 禁止事項</h4>
          <ul>
            <li>本アプリの逆コンパイル、リバースエンジニアリング、逆アセンブル</li>
            <li>本アプリの不正な複製、改変、再配布</li>
            <li>本アプリを利用した違法行為</li>
          </ul>

          <h4>6. 規約の変更</h4>
          <p>
            本規約は予告なく変更される場合があります。
            変更後も本アプリを継続して利用する場合、変更後の規約に同意したものとみなします。
          </p>

          <h4>7. 準拠法</h4>
          <p>本規約は日本法に準拠し、日本法に従い解釈されます。</p>

          <h4>8. お問い合わせ</h4>
          <p>メール：070@i.softbank.jp</p>
        </div>
      </aside>
    </div>
  );
}

function PrivacyPolicyModal({ onClose }) {
  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer privacyDrawer">
        <div className="drawerHeader">
          <strong>プライバシーポリシー</strong>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="privacyContent">
          <h3>軽天材拾い出し プライバシーポリシー</h3>
          <p>最終更新日：2026年9月12日</p>

          <h4>1. 収集する情報</h4>
          <p>
            本アプリ「軽天材拾い出し」（以下「本アプリ」）は、ユーザーの個人情報を
            外部サーバーへ送信しません。入力された寸法データ、計算結果、保存データ、
            ユーザー情報（氏名、会社名、電話番号、メールアドレス）は、すべてお使いの端末内に
            のみ保存されます。
          </p>

          <h4>2. データの保存</h4>
          <p>
            本アプリで保存されるデータ（部屋の寸法、計算結果、プロジェクト名、ユーザー情報など）は、
            すべてお使いの端末のローカルストレージに保存されます。
            これらのデータはアプリをアンインストールすると削除されます。
          </p>
          <p>
            保存した部屋データは、アプリ内の「保存データ」メニューからいつでも
            個別に削除できます。
          </p>

          <h4>3. 第三者への提供</h4>
          <p>
            本アプリはユーザーデータを第三者に提供、販売、共有することはありません。
            ただし、「軽天について質問する」機能でユーザーが共有先を選択した場合、
            質問内容、ユーザー情報、計算結果がその共有先に送信されます。
          </p>

          <h4>4. 分析・トラッキング</h4>
          <p>
            本アプリはアクセス解析ツールやトラッキングツールを使用しません。
            広告の表示も行いません。
          </p>

          <h4>5. お子様のプライバシー</h4>
          <p>
            本アプリは13歳未満のお子様を対象としたものではありません。
            お子様から意図的に個人情報を収集することはありません。
          </p>

          <h4>6. ポリシーの変更</h4>
          <p>
            本プライバシーポリシーは予告なく変更される場合があります。
            変更はアプリの更新を通じて通知されます。
          </p>

          <h4>7. お問い合わせ</h4>
          <p>
            本アプリに関するお問い合わせは、下記メールアドレスまでご連絡ください。
          </p>
          <p>メール：070@i.softbank.jp</p>
        </div>
      </aside>
    </div>
  );
}

function NativeModal({ modal, onClose }) {
  const [inputValue, setInputValue] = useState(modal.defaultValue || "");

  return (
    <div className="nativeModalOverlay" role="dialog" aria-modal="true" aria-label={modal.message}>
      <div className="nativeModalBox">
        <p className="nativeModalMessage">{modal.message}</p>

        {modal.type === "prompt" && (
          <input
            className="nativeModalInput"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
        )}

        <div className="nativeModalActions">
          {modal.type === "alert" && (
            <button className="nativeModalBtn nativeModalBtnPrimary" onClick={() => onClose(true)}>
              OK
            </button>
          )}
          {modal.type === "confirm" && (
            <>
              <button className="nativeModalBtn nativeModalBtnCancel" onClick={() => onClose(false)}>
                キャンセル
              </button>
              <button className="nativeModalBtn nativeModalBtnPrimary" onClick={() => onClose(true)}>
                OK
              </button>
            </>
          )}
          {modal.type === "prompt" && (
            <>
              <button className="nativeModalBtn nativeModalBtnCancel" onClick={() => onClose(null)}>
                キャンセル
              </button>
              <button className="nativeModalBtn nativeModalBtnPrimary" onClick={() => onClose(inputValue)}>
                OK
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, onMenuClick }) {
  return (
    <header className="header" role="banner">
      <div className="spacer" />
      <h1>{title}</h1>
      <button className="menu" onClick={onMenuClick} aria-label="保存データを開く">☰</button>
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
      // 基本303(w1820)は芯割り/芯跨ぎを使わないので、
      // 内部状態は基本の芯割りへ戻しておく。
      centerBarType: leftTopBased && option.pitch !== 364 ? "double" : settings.centerBarType || "double",
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

function getResultBarDimensionTexts(dims, shape, settings, layer = "board") {
  if (!usesCenteredBoardLayout(settings, layer)) return [];

  const polygonPoints = buildPolygonFromDims(dims, shape);
  if (!polygonPoints) return [];

  const plan = makeBarPlan(polygonPoints, settings);
  if (isRockWoolSetting(settings) && layer === "rockWool") {
    const box = getBox(polygonPoints);
    const verticalBars = plan.barAxis === "V";
    const min = verticalBars ? box.minX : box.minY;
    const max = verticalBars ? box.maxX : box.maxY;
    const layout = makeBoardLayout(polygonPoints, plan.barAxis, settings, layer);
    const endSizes = [...new Set(layout.tiles.filter(({ usedRect }) =>
      Math.abs((verticalBars ? usedRect.x + usedRect.width : usedRect.y + usedRect.height) - max) < 0.01
    ).map((tile) => formatMmLabel(verticalBars ? tile.usedWidth : tile.usedHeight)))].sort((a,b) => Number(b) - Number(a));
    return [
      `横端部→中心 ${formatMmLabel((max - min) / 2 - (settings.centerBarType === "single" ? 150 : 0))}mm`,
      `横端部→2本目W ${endSizes.map(size => `${size}mm`).join(" / ")}`,
    ];
  }
  return (plan.dimensionLabels || []).map((label) => label.text.replace(/^端部/, "横端部"));
}

function getVerticalResultBarDimensionTexts(dims, shape, settings, layer = "board") {
  if (!usesCenteredBoardLayout(settings, layer)) return [];
  const points = buildPolygonFromDims(dims, shape);
  if (!points) return [];
  const box = getBox(points);
  const gLength = Number(dims.G) || box.maxX - box.minX;
  const plan = makeBarPlan(points, settings);
  const layout = makeBoardLayout(points, plan.barAxis, settings, layer);
  const vertical = plan.barAxis === "V";
  const end = vertical ? box.maxY : box.maxX;
  const endSizes = [...new Set(layout.tiles.filter((tile) => {
    const used = tile.usedRect;
    return Math.abs((vertical ? used.y + used.height : used.x + used.width) - end) < 0.01;
  }).map((tile) => formatMmLabel(vertical ? tile.usedHeight : tile.usedWidth)))];
  // 岩綿は端部に並ぶ段の順を保ち、レンガ貼りの端材寸法を図形と対応させる。
  if (layer !== "rockWool") endSizes.sort((a, b) => Number(b) - Number(a));
  return [
    `縦端部→中心 ${formatMmLabel(gLength / 2 - (layer === "rockWool" && isRockWoolSetting(settings) && settings.verticalCenterBarType === "single" ? 150 : 0))}mm`,
    `縦端部→2本目W ${endSizes.map((size) => `${size}mm`).join(" / ")}`,
  ];
}

function CenterBarTypeToggle({ settings, setSettings, compact = false, direction = "horizontal" }) {
  const settingKey = direction === "vertical" ? "verticalCenterBarType" : "centerBarType";
  const directionLabel = direction === "vertical" ? "縦" : "横";
  const isMatagi = settings[settingKey] === "single";

  const select = (type) => {
    setSettings((prev) => ({ ...prev, [settingKey]: type }));
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
      role="group"
      aria-label={`${directionLabel}方向の芯割り・芯跨ぎ`}
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
        <span style={{ fontSize: compact ? 11 : 13, fontWeight: 900 }}>{directionLabel}</span>
        <button
          type="button"
          aria-pressed={!isMatagi}
          style={buttonStyle(!isMatagi)}
          onClick={() => select("double")}
        >
          芯割り
        </button>
        <button
          type="button"
          aria-pressed={isMatagi}
          style={buttonStyle(isMatagi)}
          onClick={() => select("single")}
        >
          芯跨ぎ
        </button>
      </div>
    </section>
  );
}

function SavedRoomsPanel({
  rooms,
  onClose,
  onDelete,
  onRename,
  onOpen,
  onShowUserProfile,
  onShowPrivacy,
  onShowTerms,
}) {
  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer">
        <div className="drawerHeader">
          <strong>保存データ</strong>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="drawerMenuActions">
          <button onClick={onShowUserProfile}>ユーザー情報を登録</button>
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

        <div className="drawerFooter">
          <button className="privacyLink" onClick={onShowTerms}>
            利用規約
          </button>
          <button className="privacyLink" onClick={onShowPrivacy}>
            プライバシーポリシー
          </button>
          <small className="appVersion">v1.3.0</small>
        </div>
      </aside>
    </div>
  );
}

function UserProfileModal({ profile, required = false, onClose, onSave }) {
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const change = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const save = async () => {
    const saved = await onSave(draft);
    if (saved) onClose();
  };

  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer profileDrawer">
        <div className="drawerHeader">
          <strong>ユーザー情報</strong>
          {!required && <button onClick={onClose} aria-label="閉じる">×</button>}
        </div>

        <div className="profileForm">
          {required && (
            <p className="requiredProfileMessage">
              このアプリを利用するには、ユーザー情報の登録が必要です。すべての項目を入力してください。
            </p>
          )}
          <label>
            <span>氏名（必須）</span>
            <input
              value={draft.name}
              onChange={(e) => change("name", e.target.value)}
              placeholder="例：山田 太郎"
            />
          </label>
          <label>
            <span>会社名（必須）</span>
            <input
              value={draft.company}
              onChange={(e) => change("company", e.target.value)}
              placeholder="例：山田内装"
            />
          </label>
          <label>
            <span>電話番号（必須）</span>
            <input
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => change("phone", e.target.value)}
              placeholder="例：090-0000-0000"
            />
          </label>
          <label>
            <span>メールアドレス（必須）</span>
            <input
              inputMode="email"
              value={draft.email}
              onChange={(e) => change("email", e.target.value)}
              placeholder="例：name@example.com"
            />
          </label>
          <p>
            入力した情報はこの端末内に保存されます。「軽天について質問する」を利用する場合のみ、
            ユーザーが選択した共有先へ質問内容と一緒に送信されます。
          </p>
          <button className="saveBtn" onClick={save}>
            保存
          </button>
        </div>
      </aside>
    </div>
  );
}

function KeitenQuestionModal({ onClose, onSubmit }) {
  const [question, setQuestion] = useState("");

  const submit = async () => {
    const submitted = await onSubmit(question);
    if (submitted) onClose();
  };

  return (
    <div className="drawerOverlay">
      <aside className="savedDrawer profileDrawer questionDrawer">
        <div className="drawerHeader">
          <strong>軽天について質問</strong>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="questionForm">
          <p>
            軽天の納まり、材料、計算内容などを入力してください。送信時にユーザー情報と現在の計算結果を添付できます。
          </p>
          <label>
            <span>質問内容</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例：この天井寸法の場合、ボードの割付とバーの入れ方はこれで合っていますか？"
              rows={8}
            />
          </label>
          <button className="questionWideBtn" onClick={submit}>
            質問を共有する
          </button>
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
            <button className="detailCloseBtn" onClick={onClose} aria-label="閉じる">×</button>
          </div>
        </div>

        {roomShape && (
          <CleanShape shape={roomShape} small dims={roomDims} settings={room.settings || {}} showValues showBoltDots showChannelLines showBarLines />
        )}

        <section className="resultCard detailResultCard">
          {roomResults.map((item) => (
            <div
              className={item.category === "board" ? "resultRow boardSectionRow" : "resultRow"}
              key={`detail-${item.name}`}
            >
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

function constrainDiagramView(view, width, height) {
  const scale = Math.max(1, Math.min(4, view.scale));
  const limitX = width * (scale - 1) / 2;
  const limitY = height * (scale - 1) / 2;
  return { scale, x: Math.max(-limitX, Math.min(limitX, view.x)), y: Math.max(-limitY, Math.min(limitY, view.y)) };
}

function getDiagramGestureView(base, start, current, width, height) {
  const center = (points) => ({ x: points.reduce((n,p) => n+p.x,0)/points.length, y: points.reduce((n,p) => n+p.y,0)/points.length });
  const from = center(start);
  const to = center(current);
  const distance = (points) => Math.hypot(points[1].x-points[0].x, points[1].y-points[0].y);
  const ratio = start.length === 2 ? distance(current) / Math.max(1, distance(start)) : 1;
  const scale = Math.max(1, Math.min(4, base.scale * ratio));
  const factor = scale / base.scale;
  return constrainDiagramView({
    scale,
    x: to.x - width/2 - (from.x - width/2 - base.x)*factor,
    y: to.y - height/2 - (from.y - height/2 - base.y)*factor,
  }, width, height);
}

function ZoomableDiagram({ children }) {
  const initial = { scale: 1, x: 0, y: 0 };
  const [view, setView] = useState(initial);
  const viewRef = useRef(initial);
  const viewport = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const didDrag = useRef(false);
  const suppressClickUntil = useRef(0);
  const update = (next) => { viewRef.current = next; setView(next); };
  const rebase = () => {
    gesture.current = { base: viewRef.current, points: [...pointers.current.values()].slice(0,2) };
  };
  const point = (e) => {
    const rect = viewport.current.getBoundingClientRect();
    return { x: e.clientX-rect.left, y: e.clientY-rect.top };
  };
  const finish = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    if (didDrag.current || pointers.current.size > 1) suppressClickUntil.current = Date.now()+500;
    pointers.current.delete(e.pointerId);
    rebase();
  };
  const zoom = (scale) => {
    const { width, height } = viewport.current.getBoundingClientRect();
    update(constrainDiagramView({ ...viewRef.current, scale }, width, height));
  };
  return (
    <div className="diagramZoomPanel">
      <div className="diagramZoomViewport" ref={viewport} aria-label="図形：2本指で拡大・縮小、拡大後はドラッグで移動"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          if (!pointers.current.size) didDrag.current = false;
          pointers.current.set(e.pointerId, point(e));
          if (pointers.current.size > 1) { didDrag.current = true; suppressClickUntil.current = Date.now()+500; }
          rebase();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, point(e));
          const current = [...pointers.current.values()].slice(0,2);
          const start = gesture.current;
          if (!start || current.length !== start.points.length) return;
          if (current.some((p,i) => Math.hypot(p.x-start.points[i].x,p.y-start.points[i].y)>5)) {
            didDrag.current = true;
            suppressClickUntil.current = Date.now()+500;
          }
          const { width, height } = viewport.current.getBoundingClientRect();
          update(getDiagramGestureView(start.base,start.points,current,width,height));
        }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onClickCapture={(e) => {
          if (Date.now() < suppressClickUntil.current) { e.stopPropagation(); e.preventDefault(); }
        }}
      >
        <div className="diagramZoomContent" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>{children}</div>
      </div>
      <div className="diagramZoomTools" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="図形を縮小" disabled={view.scale <= 1} onClick={() => zoom(view.scale-0.5)}>−</button>
        <button type="button" aria-label="図形の拡大をリセット" onClick={() => update(initial)}>{Math.round(view.scale*100)}%</button>
        <button type="button" aria-label="図形を拡大" disabled={view.scale >= 4} onClick={() => zoom(view.scale+0.5)}>＋</button>
      </div>
    </div>
  );
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
  showBoardLayout = false,
  boardLayer = "board",
  showBarDimensionLabels = true,
}) {
  const boardClipId = `board-clip-${useId().replace(/:/g, "")}`;
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

  const boardLayout = showBoardLayout && realClosedPoints
    ? makeBoardLayout(realClosedPoints, barPlan.barAxis, settings, boardLayer)
    : { tiles: [] };

  const boardTiles = showBoardLayout && realClosedPoints
    ? boardLayout.tiles.map((tile) => {
        const a = layout.mapPoint({ x: tile.x, y: tile.y });
        const b = layout.mapPoint({ x: tile.x + tile.width, y: tile.y + tile.height });
        const usedA = layout.mapPoint({
          x: tile.usedRect?.x ?? tile.x,
          y: tile.usedRect?.y ?? tile.y,
        });
        const usedB = layout.mapPoint({
          x: (tile.usedRect?.x ?? tile.x) + (tile.usedRect?.width ?? tile.width),
          y: (tile.usedRect?.y ?? tile.y) + (tile.usedRect?.height ?? tile.height),
        });
        return {
          ...tile,
          x: a.x,
          y: a.y,
          width: b.x - a.x,
          height: b.y - a.y,
          usedRect: {
            x: usedA.x,
            y: usedA.y,
            width: usedB.x - usedA.x,
            height: usedB.y - usedA.y,
          },
        };
      })
    : [];

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
        {showBoardLayout && (
          <defs>
            <clipPath id={boardClipId}>
              <polygon points={pointsText} />
            </clipPath>
          </defs>
        )}

        {showBoardLayout && (
          <g clipPath={`url(#${boardClipId})`}>
            <polygon
              points={pointsText}
              fill="#ecfeff"
              stroke="none"
            />
            {boardTiles.map((tile, index) => (
              <rect
                key={`board-tile-${index}`}
                x={tile.x}
                y={tile.y}
                width={tile.width}
                height={tile.height}
                fill={tile.fromStock ? "#dcfce7" : index % 2 ? "#dbeafe" : "#fef3c7"}
                stroke={tile.fromStock ? "#16a34a" : "#0f766e"}
                strokeWidth={small ? 0.7 : 1.1}
                opacity="0.82"
              />
            ))}
          </g>
        )}

        <polygon
          points={pointsText}
          fill="none"
          stroke="#111"
          strokeWidth="5"
          strokeLinejoin="round"
        />

        {showBoardLayout &&
          boardTiles.map((tile, index) => {
            const labelPoint = getBoardLabelPoint(tile, polygonForLabels);
            if (!labelPoint) return null;
            const labelX = labelPoint.x;
            const labelY = labelPoint.y;
            const labelFontSize = boardLayer === "rockWool"
              ? Math.max(1.4, Math.min(
                  small ? 7 : 8.5,
                  tile.usedRect.width / (String(tile.boardNo).length * 0.65 + 0.5),
                  tile.usedRect.height * 0.65
                ))
              : small ? 8.4 : 10.2;

            return (
              <g key={`board-label-${index}`}>
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontSize: labelFontSize,
                    fontWeight: 900,
                    fill: "#0f172a",
                    paintOrder: "stroke",
                    stroke: "#fff",
                    strokeWidth: boardLayer === "rockWool" ? labelFontSize * 0.18 : small ? 1.8 : 2.2,
                  }}
                >
                  {tile.boardNo}
                </text>
              </g>
            );
          })}

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
  const boardItem = list.find((item) => item.category === "board" || item.name === "ボード");
  const finishBoardItem = list.find((item) => item.category === "finishBoard");
  const screwItem = list.find((item) => item.name === "ビス");

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
    { name: boardItem?.name || "ボード", value: boardItem?.value || get("ボード"), category: "board" },
    ...(finishBoardItem ? [{ ...finishBoardItem }] : []),
    {
      name: "ビス",
      value: screwItem?.value || get("ビス"),
      category: "boardAccessory",
      settings: screwItem?.settings || {},
    },
    ...["ピン", "しろのり"].flatMap((name) => {
      const item = list.find((entry) => entry.name === name);
      return item ? [{ ...item, category: "boardAccessory" }] : [];
    }),
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
  const boardItem = normalized.find((item) => item.category === "board");
  const boardCount = extractFirstNumber(boardItem?.value || "");
  const finishBoardItem = normalized.find((item) => item.category === "finishBoard");
  const finishBoardCount = extractFirstNumber(finishBoardItem?.value || "");

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

    if (item.name === "ビス") {
      const screwCount = isGyptoneSetting(item.settings || {}) || isGyptoneBoardName(boardItem?.name)
        ? boardCount * getGyptoneScrewsPerSheet(item.settings || {})
        : boardCount * 8;
      return { ...item, value: `${screwCount} 発` };
    }

    if (finishBoardItem && item.name === "ピン") {
      return { ...item, value: `${finishBoardCount * 25} 発` };
    }
    if (finishBoardItem && item.name === "しろのり") {
      return { ...item, value: formatGlueAmount(finishBoardCount * 30) };
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
  const board = getBoardSizeOption(settings);
  const boardValue = polygonPoints
    ? makeBoardResult(polygonPoints, settings, barPlan.barAxis)
    : "寸法未入力";

  return finalizeResultList([
    { name: "ボルト", value: `${plan.boltCount} 本` },
    { name: "チャンネル", value: plan.channelValue },
    { name: "ダブルバー", value: doubleBarValue },
    { name: "シングルバー", value: singleBarValue },
    { name: getBoardResultName(settings, board), value: boardValue, category: "board" },
    ...(isRockWoolSetting(settings) ? [{
      name: "岩綿",
      value: polygonPoints ? makeBoardResult(polygonPoints, settings, barPlan.barAxis, "rockWool") : "寸法未入力",
      category: "finishBoard",
    }] : []),
    { name: "ビス", value: "0 発", category: "boardAccessory", settings },
    ...(isRockWoolSetting(settings) ? [
      { name: "ピン", value: "0 発", category: "boardAccessory" },
      { name: "しろのり", value: "0 g", category: "boardAccessory" },
    ] : []),
    { name: "ナット", value: "0 コ" },
    { name: "ハンガー", value: "0 コ" },
    { name: "Wクリップ", value: "0 コ" },
    { name: "Sクリップ", value: "0 コ" },
  ]);
}

function getBoardSizeOption(settingsOrKey, layer = "board") {
  if (layer === "rockWool" && isRockWoolSetting(settingsOrKey)) return rockWoolBoardSize;
  if (isGyptoneSetting(settingsOrKey)) {
    return smallGypsumBoardSize;
  }
  if (Number(settingsOrKey?.barPitch) === 303 && Number(settingsOrKey?.barW) === 910) {
    return squareGypsumBoardSize;
  }

  return boardSize;
}

function isGyptoneSetting(settings = {}) {
  return Boolean(
    settings &&
      typeof settings === "object" &&
      Number(settings.barPitch) === 227 &&
      Number(settings.barW) === 455
  );
}

function isGyptoneBoardName(name) {
  return String(name || "").includes("ジプトーン");
}

function getGyptoneScrewsPerSheet(settings = {}) {
  return settings.screwSpec === "public" ? 19 : 14;
}

function getBoardResultName(settings = {}, board = getBoardSizeOption(settings)) {
  if (isRockWoolSetting(settings)) return "ボード";
  if (Number(settings.barPitch) === 227 && Number(settings.barW) === 455) {
    return "1.5×3ジプトーン";
  }

  return settings.barType || board.name || "ボード";
}

function makeBoardResult(points, settings = {}, barAxis = "H", layer = "board") {
  const board = getBoardSizeOption(settings, layer);
  const areaMm2 = Math.abs(signedArea(closePolygon(points))) / 2;
  if (!Number.isFinite(areaMm2) || areaMm2 <= 0) return "0 枚";

  const layout = makeBoardLayout(points, barAxis, settings, layer);
  const count = layout.newBoardCount || Math.ceil(areaMm2 / (board.width * board.height));

  return `${count} 枚（${formatSheetBundle(count, board.sheetsPerTsubo)}）`;
}

function makeBoardLayout(points, barAxis = "H", settings = {}, layer = "board") {
  const closed = closePolygon(points);
  const box = getBox(closed);
  const tiles = [];
  const stock = [];
  const board = getBoardSizeOption(settings, layer);
  const tileSize = getBoardTileSizeForBarAxis(barAxis, board);
  const gridStart = getBoardGridStart(box, barAxis, tileSize, closed, settings, layer);
  const brickOffset = getBrickBoardOffset(barAxis, board, settings);
  let nextBoardNo = 1;
  let stockUseCount = 0;

  const visitTile = (tile) => {
    if (tile.width <= 0 || tile.height <= 0) return false;

    const clipped = clipBoardTileToPolygon(tile, closed);
    const insideArea = clipped.length ? Math.abs(signedArea([...clipped, clipped[0]])) / 2 : 0;
    if (insideArea > 0.001) {

      const fullTile =
        Math.abs(tile.width - tileSize.width) <= 1 &&
        Math.abs(tile.height - tileSize.height) <= 1 &&
        Math.abs(insideArea - tile.width * tile.height) < 0.01;
      const usedBox = getBox(clipped);
      const usedRect = fullTile ? tile : {
        x: usedBox.minX, y: usedBox.minY,
        width: usedBox.maxX - usedBox.minX, height: usedBox.maxY - usedBox.minY,
      };
      const usedWidth = Math.min(tile.width, usedRect.width);
      const usedHeight = Math.min(tile.height, usedRect.height);
      tile.usedRect = usedRect;
      tile.usedWidth = usedWidth;
      tile.usedHeight = usedHeight;
      tile.insideArea = insideArea;

      const stockMatch = findStockPiece(stock, usedWidth, usedHeight);

      if (stockMatch) {
        const piece = stock.splice(stockMatch.index, 1)[0];
        tile.boardNo = piece.boardNo;
        tile.fromStock = true;
        stockUseCount += 1;
        addBoardOffcutsFromUsedRect(stock, piece, {
          x: 0,
          y: 0,
          width: usedWidth,
          height: usedHeight,
        });
      } else {
        tile.boardNo = nextBoardNo++;
        tile.fromStock = false;
        addBoardOffcutsFromUsedRect(
          stock,
          {
            width: tileSize.width,
            height: tileSize.height,
            boardNo: tile.boardNo,
          },
          normalizeUsedRectForSource(tile, usedRect, tileSize)
        );
      }

      tiles.push(tile);
    }

    return false;
  };

  if (barAxis === "V") {
    for (
      let crossIndex = 0, baseX = gridStart.x;
      baseX < box.maxX - 0.001;
      crossIndex += 1, baseX += tileSize.width
    ) {
      const startY =
        gridStart.y + (brickOffset.axis === "y" && crossIndex % 2 === 1 ? brickOffset.amount - tileSize.height : 0);

      for (let y = startY; y < box.maxY - 0.001; y += tileSize.height) {
        const tile = {
          x: baseX,
          y,
          width: Math.min(tileSize.width, box.maxX - baseX),
          height: Math.min(tileSize.height, box.maxY - y),
        };

        if (visitTile(tile)) break;
      }
    }
  } else {
    for (
      let crossIndex = 0, baseY = gridStart.y;
      baseY < box.maxY - 0.001;
      crossIndex += 1, baseY += tileSize.height
    ) {
      const startX =
        gridStart.x + (brickOffset.axis === "x" && crossIndex % 2 === 1 ? brickOffset.amount - tileSize.width : 0);

      for (let x = startX; x < box.maxX - 0.001; x += tileSize.width) {
        const tile = {
          x,
          y: baseY,
          width: Math.min(tileSize.width, box.maxX - x),
          height: Math.min(tileSize.height, box.maxY - baseY),
        };

        if (visitTile(tile)) break;
      }
    }
  }

  return {
    tiles,
    newBoardCount: nextBoardNo - 1,
    stockUseCount,
    stock,
  };
}

// 矩形で切り取った実面積を使う。小さな端部もサンプリングで落とさない。
function clipBoardTileToPolygon(tile, polygon) {
  let result = polygon.slice(0, -1);
  const boundaries = [
    ["x", tile.x, 1], ["x", tile.x + tile.width, -1],
    ["y", tile.y, 1], ["y", tile.y + tile.height, -1],
  ];
  for (const [axis, limit, sign] of boundaries) {
    const input = result;
    result = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      const aInside = sign * (a[axis] - limit) >= 0;
      const bInside = sign * (b[axis] - limit) >= 0;
      if (aInside) result.push(a);
      if (aInside !== bInside) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        result.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
  }
  return result;
}

function getBoardTileSizeForBarAxis(barAxis = "H", board = boardSize) {
  if (board.key === "300x600") {
    return barAxis === "V" ? { width: 300, height: 600 } : { width: 600, height: 300 };
  }
  // 910mmの辺がWバー（ダブルバー）と平行になる向きにそろえる。
  const sideA = Number(board.width) || 910;
  const sideB = Number(board.height) || 1820;
  const parallelSide = Math.abs(sideA - 910) <= Math.abs(sideB - 910) ? sideA : sideB;
  const crossSide = parallelSide === sideA ? sideB : sideA;

  if (barAxis === "V") {
    return { width: crossSide, height: parallelSide };
  }

  return { width: parallelSide, height: crossSide };
}

function getBrickBoardOffset(barAxis = "H", board = boardSize, settings = {}) {
  const brick = board.key === "300x600" || board.key === "455x910" ||
    (board.key === "910x910" && settings.squareBoardPattern === "brick");
  if (!brick) return { axis: null, amount: 0 };

  // ジプトーンはレンガ貼り。次段ごとに910mm辺方向へ455mmずらす。
  // Wバーが横方向なら910mm辺はX方向、Wバーが縦方向なら910mm辺はY方向。
  return {
    axis: barAxis === "V" ? "y" : "x",
    amount: board.key === "300x600" ? 300 : 455,
  };
}

function getBoardGridStart(box, barAxis = "H", tileSize = boardSize, points = [], settings = {}, layer = "board") {
  const crossMin = barAxis === "V" ? box.minX : box.minY;
  const crossMax = barAxis === "V" ? box.maxX : box.maxY;
  const crossStep = barAxis === "V" ? tileSize.width : tileSize.height;
  // 岩綿の300mm辺：芯割りは中心に目地、芯跨ぎは中心に板の中央（150mm）。
  const anchors = layer === "rockWool" && isRockWoolSetting(settings)
    ? [(crossMin + crossMax) / 2 - (settings.centerBarType === "single" ? crossStep / 2 : 0)]
    : getBoardJointAnchors(box, barAxis, settings);
  // 横はWバーの位置、縦は910mm辺方向の中心を独立した割付基準にする。
  const alongMin = barAxis === "V" ? box.minY : box.minX;
  const alongMax = barAxis === "V" ? box.maxY : box.maxX;
  const alongStep = barAxis === "V" ? tileSize.height : tileSize.width;
  const alongCenter = (alongMin + alongMax) / 2;
  // 岩綿の縦芯跨ぎは中心−150mmに目地。3×3の芋貼りは455mm、それ以外は227.5mm。
  const verticalStraddleOffset = layer === "rockWool" && isRockWoolSetting(settings) ? 150
    : getBoardSizeOption(settings).key === "910x910" &&
      settings.squareBoardPattern !== "brick" ? 455 : 227.5;
  const alongAnchor = settings.verticalCenterBarType === "single"
    ? alongCenter - verticalStraddleOffset
    : alongCenter;
  const alongStart = usesCenteredBoardLayout(settings, layer)
    ? alignBoardGridStart(alongMin, alongStep, [alongAnchor])
    : alongMin;

  if (barAxis === "V") {
    return {
      x: alignBoardGridStart(box.minX, Number(tileSize.width) || 1, anchors),
      y: alongStart,
    };
  }

  return {
    x: alongStart,
    y: alignBoardGridStart(box.minY, Number(tileSize.height) || 1, anchors),
  };
}

function getBoardJointAnchors(box, barAxis = "H", settings = {}) {
  const min = barAxis === "V" ? box.minX : box.minY;
  const max = barAxis === "V" ? box.maxX : box.maxY;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  // 基本303(w1820)は従来どおり端部基準。
  if (isLeftTopBarSetting(settings)) return [min];

  const center = (min + max) / 2;
  const doublePitch = Math.max(
    Number(settings.barPitch) || 303,
    Number(settings.barW) || 1820
  );

  // 芯割り：中心のダブルバーをボードジョイント基準にする。
  if ((settings.centerBarType || "double") !== "single") {
    return [center];
  }

  // 芯跨ぎ：中心ではなく、中心を跨ぐ左右/上下のダブルバーを基準にする。
  return [center - doublePitch / 2, center + doublePitch / 2];
}

function alignBoardGridStart(min, step, anchors = []) {
  if (!anchors.length || step <= 0) return min;

  const anchor = anchors.reduce((best, value) =>
    Math.abs(value - min) < Math.abs(best - min) ? value : best
  , anchors[0]);

  return anchor - Math.ceil((anchor - min) / step) * step;
}

function formatGlueAmount(grams) {
  const bags = Math.floor(grams / 3000);
  const remainder = grams % 3000;
  if (!bags) return `${grams} g`;
  return `${grams} g（${bags}袋${remainder ? `+${remainder}g` : ""}）`;
}

function formatSheetBundle(count, sheetsPerTsubo = 8) {
  const sheets = Math.max(0, Math.round(Number(count) || 0));
  const perTsubo = Math.max(1, Math.round(Number(sheetsPerTsubo) || 8));
  const tsubo = Math.floor(sheets / perTsubo);
  const remainder = sheets % perTsubo;

  if (tsubo > 0 && remainder > 0) return `${tsubo}坪+${remainder}枚`;
  if (tsubo > 0) return `${tsubo}坪`;
  return `${remainder}枚`;
}

function getBoardLabelPoint(tile, polygon) {
  const labelBox = tile.usedRect || tile;
  const center = {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  };

  if (pointInPolygon(center, polygon)) return center;

  const candidates = [
    center,
    { x: labelBox.x + labelBox.width * 0.5, y: labelBox.y + labelBox.height * 0.35 },
    { x: labelBox.x + labelBox.width * 0.5, y: labelBox.y + labelBox.height * 0.65 },
    { x: labelBox.x + labelBox.width * 0.35, y: labelBox.y + labelBox.height * 0.5 },
    { x: labelBox.x + labelBox.width * 0.65, y: labelBox.y + labelBox.height * 0.5 },
    { x: labelBox.x + labelBox.width * 0.35, y: labelBox.y + labelBox.height * 0.35 },
    { x: labelBox.x + labelBox.width * 0.65, y: labelBox.y + labelBox.height * 0.35 },
    { x: labelBox.x + labelBox.width * 0.35, y: labelBox.y + labelBox.height * 0.65 },
    { x: labelBox.x + labelBox.width * 0.65, y: labelBox.y + labelBox.height * 0.65 },
  ];

  const inside = candidates
    .filter((point) => pointInPolygon(point, polygon))
    .sort((a, b) => distance(a, center) - distance(b, center));

  if (inside.length) return inside[0];

  const clipped = getBoardUsedRect(tile, polygon);
  const clippedCenter = {
    x: clipped.x + clipped.width / 2,
    y: clipped.y + clipped.height / 2,
  };

  if (pointInPolygon(clippedCenter, polygon)) return clippedCenter;

  // 凹形の切欠きをまたぐ場合も、同じタイル内の実際に貼る部分に置く。
  const xs = [...new Set([labelBox.x, labelBox.x + labelBox.width,
    ...polygon.map((p) => p.x).filter((x) => x > labelBox.x && x < labelBox.x + labelBox.width)])].sort((a,b) => a-b);
  const ys = [...new Set([labelBox.y, labelBox.y + labelBox.height,
    ...polygon.map((p) => p.y).filter((y) => y > labelBox.y && y < labelBox.y + labelBox.height)])].sort((a,b) => a-b);
  let best = null;
  let bestArea = 0;
  for (let y = 0; y < ys.length - 1; y++) {
    for (let x = 0; x < xs.length - 1; x++) {
      const candidate = { x: (xs[x] + xs[x+1]) / 2, y: (ys[y] + ys[y+1]) / 2 };
      const area = (xs[x+1] - xs[x]) * (ys[y+1] - ys[y]);
      if (area > bestArea && pointInPolygon(candidate, polygon)) {
        best = candidate;
        bestArea = area;
      }
    }
  }
  return best;
}

function findNearestInteriorPoint(point, polygon) {
  const box = getBox(polygon);
  let best = null;
  let bestDistance = Infinity;
  const step = 3;

  for (let y = Math.max(box.minY, point.y - 28); y <= Math.min(box.maxY, point.y + 28); y += step) {
    for (let x = Math.max(box.minX, point.x - 28); x <= Math.min(box.maxX, point.x + 28); x += step) {
      const candidate = { x, y };
      if (!pointInPolygon(candidate, polygon)) continue;
      const d = distance(candidate, point);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
  }

  return best;
}

function findStockPiece(stock, width, height) {
  const candidates = stock
    .map((piece, index) => ({
      piece,
      index,
      area: piece.width * piece.height,
    }))
    .filter(({ piece }) => piece.width >= width - 0.001 && piece.height >= height - 0.001)
    .sort((a, b) => a.area - b.area);

  return candidates[0] || null;
}

function normalizeUsedRectForSource(tile, usedRect, sourceSize) {
  const x = Math.max(0, Math.min(sourceSize.width, usedRect.x - tile.x));
  const y = Math.max(0, Math.min(sourceSize.height, usedRect.y - tile.y));
  const width = Math.max(1, Math.min(sourceSize.width - x, usedRect.width));
  const height = Math.max(1, Math.min(sourceSize.height - y, usedRect.height));

  return { x, y, width, height };
}

function addBoardOffcutsFromUsedRect(stock, source, usedRect) {
  const minReusable = 180;
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const boardNo = source.boardNo;
  const usedLeft = Math.max(0, usedRect.x);
  const usedTop = Math.max(0, usedRect.y);
  const usedRight = Math.min(sourceWidth, usedRect.x + usedRect.width);
  const usedBottom = Math.min(sourceHeight, usedRect.y + usedRect.height);

  const pieces = [
    {
      // 左側に残る縦長端材
      width: usedLeft,
      height: sourceHeight,
    },
    {
      // 右側に残る縦長端材
      width: sourceWidth - usedRight,
      height: sourceHeight,
    },
    {
      // 上側に残る横長端材
      width: Math.max(0, usedRight - usedLeft),
      height: usedTop,
    },
    {
      // 下側に残る横長端材
      width: Math.max(0, usedRight - usedLeft),
      height: sourceHeight - usedBottom,
    },
  ];

  pieces.forEach((piece) => {
    if (piece.width < minReusable || piece.height < minReusable) return;
    stock.push({
      width: piece.width,
      height: piece.height,
      boardNo,
    });
  });

  stock.sort((a, b) => a.width * a.height - b.width * b.height);
}

function tileIsMostlyInsidePolygon(tile, polygon) {
  const pad = 2;
  const points = [
    { x: tile.x + pad, y: tile.y + pad },
    { x: tile.x + tile.width - pad, y: tile.y + pad },
    { x: tile.x + pad, y: tile.y + tile.height - pad },
    { x: tile.x + tile.width - pad, y: tile.y + tile.height - pad },
  ];

  return points.every((point) => pointInPolygon(point, polygon));
}

function tileIntersectsPolygon(tile, polygon) {
  const samples = [
    { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 },
    { x: tile.x + 1, y: tile.y + 1 },
    { x: tile.x + tile.width - 1, y: tile.y + 1 },
    { x: tile.x + 1, y: tile.y + tile.height - 1 },
    { x: tile.x + tile.width - 1, y: tile.y + tile.height - 1 },
  ];

  if (samples.some((point) => pointInPolygon(point, polygon))) return true;

  return polygon.some(
    (point) =>
      point.x >= tile.x &&
      point.x <= tile.x + tile.width &&
      point.y >= tile.y &&
      point.y <= tile.y + tile.height
  );
}

function estimateTileInsideArea(tile, polygon) {
  const cols = 8;
  const rows = 8;
  let inside = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const point = {
        x: tile.x + tile.width * ((col + 0.5) / cols),
        y: tile.y + tile.height * ((row + 0.5) / rows),
      };
      if (pointInPolygon(point, polygon)) inside += 1;
    }
  }

  return (inside / (cols * rows)) * tile.width * tile.height;
}

function boardUsedRectHasInterior(rect, polygon) {
  const samples = [
    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    { x: rect.x + rect.width * 0.35, y: rect.y + rect.height * 0.35 },
    { x: rect.x + rect.width * 0.65, y: rect.y + rect.height * 0.35 },
    { x: rect.x + rect.width * 0.35, y: rect.y + rect.height * 0.65 },
    { x: rect.x + rect.width * 0.65, y: rect.y + rect.height * 0.65 },
  ];

  return samples.some((point) => pointInPolygon(point, polygon));
}

function getBoardUsedRect(tile, polygon) {
  const points = [];
  const rect = getTileRectPoints(tile);

  rect.forEach((point) => {
    if (pointInPolygon(point, polygon) || pointOnPolygonBoundary(point, polygon)) {
      points.push(point);
    }
  });

  polygon.forEach((point) => {
    if (pointInTileRect(point, tile)) {
      points.push(point);
    }
  });

  const rectEdges = getClosedEdges(closePolygon(rect));
  const polygonEdges = getClosedEdges(closePolygon(polygon));

  polygonEdges.forEach((edgeA) => {
    rectEdges.forEach((edgeB) => {
      const point = segmentIntersectionPoint(edgeA.a, edgeA.b, edgeB.a, edgeB.b);
      if (point) points.push(point);
    });
  });

  if (!points.length) {
    return { ...tile };
  }

  const unique = dedupeLoosePoints(points);
  const box = getBox(unique);

  return {
    x: box.minX,
    y: box.minY,
    width: Math.max(1, box.maxX - box.minX),
    height: Math.max(1, box.maxY - box.minY),
  };
}

function getTileRectPoints(tile) {
  return [
    { x: tile.x, y: tile.y },
    { x: tile.x + tile.width, y: tile.y },
    { x: tile.x + tile.width, y: tile.y + tile.height },
    { x: tile.x, y: tile.y + tile.height },
  ];
}

function getClosedEdges(points) {
  const closed = closePolygon(points || []);
  const edges = [];

  for (let i = 0; i < closed.length - 1; i++) {
    edges.push({ a: closed[i], b: closed[i + 1] });
  }

  return edges;
}

function pointInTileRect(point, tile, tol = 1) {
  return (
    point.x >= tile.x - tol &&
    point.x <= tile.x + tile.width + tol &&
    point.y >= tile.y - tol &&
    point.y <= tile.y + tile.height + tol
  );
}

function pointOnPolygonBoundary(point, polygon) {
  return getClosedEdges(polygon).some(
    (edge) => distanceToSegment(point, edge.a, edge.b) <= 1
  );
}

function segmentIntersectionPoint(a, b, c, d) {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 0.001) return null;

  const t =
    ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  const u =
    -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;

  if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;

  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

function dedupeLoosePoints(points) {
  const out = [];

  (points || []).forEach((point) => {
    const rounded = {
      x: Math.round(point.x * 10) / 10,
      y: Math.round(point.y * 10) / 10,
    };
    if (!out.some((p) => Math.abs(p.x - rounded.x) <= 1 && Math.abs(p.y - rounded.y) <= 1)) {
      out.push(rounded);
    }
  });

  return out;
}

function formatAreaM2(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(2));
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

  // 364の下地は端部基準。岩綿の芯割り/芯跨ぎによって移動させない。
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

  // 基本303(w1820)と岩綿用364の下地・ボードは端部から割り付ける。
  return (pitch === 303 && w === 1820) || isRockWoolSetting(settings);
}

function usesCenteredBoardLayout(settings = {}, layer = "board") {
  return (isRockWoolSetting(settings) && layer === "rockWool") || !isLeftTopBarSetting(settings);
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
  // 364ピッチの岩綿では、芯跨ぎの表示寸法を芯割りの中心寸法−300mmにする。
  const edgeToCenterLabel = Number(pitch) === 364 && centerBarType === "single"
    ? Math.max(0, edgeToCenter - 300)
    : calcEdgeToCenterLabelDistance(
    edgeToCenter,
    Number(doublePitch) || 0,
    centerBarType
  );

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
  const startY = box.minY + Math.max(650, posSpan * 0.20);
  const gapY = Math.max(360, posSpan * 0.105);

  return [
    {
      text: `端部→中心 ${formatMmLabel(edgeToCenterLabel)}mm`,
      p: { x: sideX, y: startY },
      anchor: "start",
    },
    {
      text: `端部→2本目W ${formatMmLabel(secondDoubleDistance)}mm`,
      p: { x: sideX, y: startY + gapY },
      anchor: "start",
    },
  ];
}

function calcEdgeToCenterLabelDistance(edgeToCenter, doublePitch, centerBarType = "double") {
  const center = Number(edgeToCenter) || 0;
  const w = Number(doublePitch) || 0;
  if (center <= 0) return 0;

  if (centerBarType === "single" && w > 0) {
    return Math.max(0, Math.round((center - w / 2) * 10) / 10);
  }

  return Math.round(center * 10) / 10;
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
