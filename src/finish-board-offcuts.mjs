// Patterned finish boards keep their orientation and their original joint edges.
// A cut edge may face a wall, but cannot replace a factory edge at a board joint.
const EPS = 0.001;
const equal = (a, b) => Math.abs(a - b) <= EPS;

export function makeFinishBoardSource(size, boardNo) {
  return {
    ...size, boardNo, sourceX: 0, sourceY: 0,
    factoryEdges: { left: true, right: true, top: true, bottom: true },
  };
}

export function getFinishBoardRequiredEdges(tile, usedRect, size) {
  // Use the full grid cell, not the cell truncated at the room's right/bottom.
  return {
    left: equal(usedRect.x, tile.x),
    right: equal(usedRect.x + usedRect.width, tile.x + size.width),
    top: equal(usedRect.y, tile.y),
    bottom: equal(usedRect.y + usedRect.height, tile.y + size.height),
  };
}

export function findFinishBoardStock(stock, width, height, required) {
  let best = null;
  for (let index = 0; index < stock.length; index++) {
    const piece = stock[index];
    if (piece.width < width - EPS || piece.height < height - EPS) continue;
    if (Object.keys(required).some(side => required[side] && !piece.factoryEdges[side])) continue;
    if (required.left && required.right && !equal(width, piece.width)) continue;
    if (required.top && required.bottom && !equal(height, piece.height)) continue;
    const area = piece.width * piece.height;
    if (best && best.area <= area) continue;
    best = {
      piece, index, area,
      usedRect: {
        x: required.right ? Math.max(0, piece.width - width) : 0,
        y: required.bottom ? Math.max(0, piece.height - height) : 0,
        width, height,
      },
    };
  }
  return best;
}

export function addFinishBoardOffcuts(stock, source, usedRect) {
  // The opposite original end is the one permitted reuse. After both ends are
  // used, discard all remaining material, including lateral strips at corners.
  if (source.oppositeEnd) return;
  const left = Math.max(0, usedRect.x);
  const top = Math.max(0, usedRect.y);
  const right = Math.min(source.width, usedRect.x + usedRect.width);
  const bottom = Math.min(source.height, usedRect.y + usedRect.height);
  // For a corner piece, take the shallower end strip first and trim its width.
  // Retain only the opposite end in that same direction, not a second strip
  // crossing it. This prevents one sheet supplying both end caps and a side.
  const cutAlongX = usedRect.width / source.width < usedRect.height / source.height;
  const remainders = cutAlongX
    ? equal(left, 0) ? [{ x: right, y: 0, width: source.width - right, height: source.height }]
      : equal(right, source.width) ? [{ x: 0, y: 0, width: left, height: source.height }] : []
    : equal(top, 0) ? [{ x: 0, y: bottom, width: source.width, height: source.height - bottom }]
      : equal(bottom, source.height) ? [{ x: 0, y: 0, width: source.width, height: top }] : [];
  for (const rect of remainders) {
    if (rect.width <= EPS || rect.height <= EPS) continue;
    const factoryEdges = {
      left: source.factoryEdges.left && equal(rect.x, 0),
      right: source.factoryEdges.right && equal(rect.x + rect.width, source.width),
      top: source.factoryEdges.top && equal(rect.y, 0),
      bottom: source.factoryEdges.bottom && equal(rect.y + rect.height, source.height),
    };
    // After taking both end strips, the middle has no usable end on that axis.
    // Even a large middle strip is waste; a 100mm original end can still be used.
    if (!(factoryEdges.left || factoryEdges.right) || !(factoryEdges.top || factoryEdges.bottom)) continue;
    stock.push({
      width: rect.width, height: rect.height, boardNo: source.boardNo,
      sourceX: source.sourceX + rect.x, sourceY: source.sourceY + rect.y,
      factoryEdges, oppositeEnd: true,
    });
  }
}
