import { Position, type Node, type Edge } from 'reactflow';
import { deterministicHash } from './mathUtils';

interface GetCustomPathParams {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition?: Position;
    offset: number;
    avoidanceNodes?: Node[];
    existingEdges?: Edge[];
    edgeId?: string;
}

interface PathCandidate {
    type: 'Direct' | 'Vertical' | 'Detour' | 'Skyline' | 'Groundline'; // 新增类型
    points: {x: number, y: number}[];
    cost: number;
}

// --- 基础几何辅助 ---

export function getDirectionVector(pos: Position) {
    switch (pos) {
        case Position.Left: return { x: -1, y: 0 };
        case Position.Right: return { x: 1, y: 0 };
        case Position.Top: return { x: 0, y: -1 };
        case Position.Bottom: return { x: 0, y: 1 };
    }
    return { x: 1, y: 0 };
}

function getNodeRect(node: Node, padding = 10) {
    const x = node.position.x ?? 0;
    const y = node.position.y ?? 0;
    const w = node.width ?? (node.style?.width ? parseInt(node.style.width as string) : 400);
    const h = node.height ?? (node.style?.height ? parseInt(node.style.height as string) : 200);
    return { l: x - padding, r: x + w + padding, t: y - padding, b: y + h + padding };
}

function isSegmentCrossingRect(p1: {x: number, y: number}, p2: {x: number, y: number}, rect: {l: number, r: number, t: number, b: number}) {
    if (!p1 || !p2) return false;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (maxX < rect.l || minX > rect.r || maxY < rect.t || minY > rect.b) return false;
    return true;
}

function getSegmentOverlapLength(a1: {x: number, y: number}, a2: {x: number, y: number}, b1: {x: number, y: number}, b2: {x: number, y: number}) {
    if (!a1 || !a2 || !b1 || !b2) return 0;
    const isAVert = Math.abs(a1.x - a2.x) < 1;
    const isBVert = Math.abs(b1.x - b2.x) < 1;
    if (isAVert !== isBVert) return 0;

    if (isAVert) {
        if (Math.abs(a1.x - b1.x) > 5) return 0;
        const yStart = Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
        const yEnd = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y));
        return Math.max(0, yEnd - yStart);
    } else {
        if (Math.abs(a1.y - b1.y) > 5) return 0;
        const xStart = Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
        const xEnd = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x));
        return Math.max(0, xEnd - xStart);
    }
}

function isSegmentIntersecting(a1: {x: number, y: number}, a2: {x: number, y: number}, b1: {x: number, y: number}, b2: {x: number, y: number}) {
    if (!a1 || !a2 || !b1 || !b2) return false;
    const isAVert = Math.abs(a1.x - a2.x) < 1;
    const isBVert = Math.abs(b1.x - b2.x) < 1;
    if (isAVert === isBVert) return false;

    const vert = isAVert ? {p1: a1, p2: a2} : {p1: b1, p2: b2};
    const horiz = isAVert ? {p1: b1, p2: b2} : {p1: a1, p2: a2};

    const vx = vert.p1.x;
    const vyMin = Math.min(vert.p1.y, vert.p2.y);
    const vyMax = Math.max(vert.p1.y, vert.p2.y);
    const hy = horiz.p1.y;
    const hxMin = Math.min(horiz.p1.x, horiz.p2.x);
    const hxMax = Math.max(horiz.p1.x, horiz.p2.x);

    return (vx > hxMin && vx < hxMax) && (hy > vyMin && hy < vyMax);
}

// 🔥 核心：带圆角的路径生成 (熔断保护) 🔥
export function pointsToPath(points: {x: number, y: number}[], borderRadius = 8) {
    if (!points || !Array.isArray(points) || points.length < 2) return '';
    const validPoints = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (validPoints.length < 2) return '';

    let d = `M ${validPoints[0].x} ${validPoints[0].y}`;

    for (let i = 1; i < validPoints.length - 1; i++) {
        const p0 = validPoints[i - 1];
        const p1 = validPoints[i];
        const p2 = validPoints[i + 1];

        const dist0 = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
        const dist1 = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
        const effectiveRadius = Math.min(borderRadius, dist0 / 2, dist1 / 2);

        if (effectiveRadius <= 0.5) {
            d += ` L ${p1.x} ${p1.y}`;
            continue;
        }

        const v0x = Math.sign(p1.x - p0.x);
        const v0y = Math.sign(p1.y - p0.y);
        const v1x = Math.sign(p2.x - p1.x);
        const v1y = Math.sign(p2.y - p1.y);

        const stopX = p1.x - v0x * effectiveRadius;
        const stopY = p1.y - v0y * effectiveRadius;
        d += ` L ${stopX} ${stopY}`;

        const endCurveX = p1.x + v1x * effectiveRadius;
        const endCurveY = p1.y + v1y * effectiveRadius;
        d += ` Q ${p1.x} ${p1.y} ${endCurveX} ${endCurveY}`;
    }

    const last = validPoints[validPoints.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
}

export function getLabelPositionFromPoints(points: {x: number, y: number}[]) {
    if (!points || points.length < 2) return [0, 0];
    const validPoints = points.filter(p => p && Number.isFinite(p.x));
    if (validPoints.length < 2) return [0, 0];

    let maxLen = 0;
    let maxIdx = 0;
    for(let i=0; i<validPoints.length-1; i++) {
        const p1 = validPoints[i];
        const p2 = validPoints[i+1];
        const len = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
        if(len > maxLen) {
            maxLen = len;
            maxIdx = i;
        }
    }
    const p1 = validPoints[maxIdx];
    const p2 = validPoints[maxIdx+1];
    return [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
}

// 强力简化
export function simplifyOrthogonalPoints(points: {x: number, y: number}[]) {
    if (!points || !Array.isArray(points)) return [];

    const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
    if (validPoints.length < 2) return validPoints;

    // 强力吸附
    const snapped = validPoints.map(p => ({...p}));
    for (let i = 1; i < snapped.length; i++) {
        const prev = snapped[i-1];
        const curr = snapped[i];
        if (Math.abs(curr.x - prev.x) < 1) curr.x = prev.x;
        if (Math.abs(curr.y - prev.y) < 1) curr.y = prev.y;
    }

    // 去除零长度
    const unique: {x: number, y: number}[] = [snapped[0]];
    for (let i = 1; i < snapped.length; i++) {
        const prev = unique[unique.length - 1];
        const curr = snapped[i];
        if (Math.abs(curr.x - prev.x) > 0.1 || Math.abs(curr.y - prev.y) > 0.1) {
            unique.push(curr);
        } else if (i === snapped.length - 1) {
            unique[unique.length - 1] = curr;
        }
    }

    if (unique.length < 2) return validPoints;

    // 合并共线
    const merged: {x: number, y: number}[] = [unique[0]];
    for (let i = 1; i < unique.length - 1; i++) {
        const prev = merged[merged.length - 1];
        const curr = unique[i];
        const next = unique[i + 1];
        if (!prev) continue;
        const isH = (prev.y === curr.y) && (curr.y === next.y);
        const isV = (prev.x === curr.x) && (curr.x === next.x);
        if (isH || isV) continue;
        merged.push(curr);
    }
    if (unique.length > 0) merged.push(unique[unique.length - 1]);

    return merged;
}

// 🔥🔥 核心升级：基于障碍物的智能路由 (Skyline/Groundline) 🔥🔥
export function getCustomSmartPath({
                                       sourceX, sourceY, sourcePosition,
                                       targetX, targetY, targetPosition,
                                       offset, avoidanceNodes = [], existingEdges = [], edgeId
                                   }: GetCustomPathParams): [string, number, number, {x: number, y: number}[]] {

    const sX = Number.isFinite(sourceX) ? sourceX : 0;
    const sY = Number.isFinite(sourceY) ? sourceY : 0;
    const tX = Number.isFinite(targetX) ? targetX : 0;
    const tY = Number.isFinite(targetY) ? targetY : 0;

    const sDir = getDirectionVector(sourcePosition);
    const safeTargetPos = targetPosition || (sourcePosition === Position.Right ? Position.Left : Position.Right);
    const tDir = getDirectionVector(safeTargetPos);

    const STUB = 20;
    const pStart = { x: sX, y: sY };
    const pBufS = { x: sX + sDir.x * STUB, y: sY + sDir.y * STUB };

    const pEnd = { x: tX, y: tY };
    const pBufT = { x: tX + tDir.x * STUB, y: tY + tDir.y * STUB };

    const laneHash = edgeId ? (Math.abs(deterministicHash(edgeId)) % 10) - 5 : 0;

    const candidates: PathCandidate[] = [];

    // --- 策略：收集 X 通道 和 Y 通道 ---

    // 1. Z-Shape (Direct)
    const defaultMidX = (pBufS.x + pBufT.x) / 2 + laneHash;
    const defaultMidY = (pBufS.y + pBufT.y) / 2 + laneHash;

    const xCandidates = [defaultMidX];
    const yCandidates = [defaultMidY]; // 用于上下绕行

    // 2. 🔥 智能避让：计算天际线 (Sky) 和 地平线 (Ground) 🔥
    if (avoidanceNodes.length > 0) {
        let maxBottom = -Infinity;
        let minTop = Infinity;
        let hasObstacle = false;

        // 检测两点之间的区域是否有障碍
        const rangeXMin = Math.min(pBufS.x, pBufT.x);
        const rangeXMax = Math.max(pBufS.x, pBufT.x);
        const rangeYMin = Math.min(pBufS.y, pBufT.y);
        const rangeYMax = Math.max(pBufS.y, pBufT.y);

        avoidanceNodes.forEach(node => {
            if (node.type !== 'groupNode') return;
            const rect = getNodeRect(node, 25);

            // X轴投影重叠（用于上下绕行）
            // 如果节点在横向上处于 Source 和 Target 之间（或者包含它们）
            if (rect.r > rangeXMin && rect.l < rangeXMax) {
                // 且在纵向上有阻挡风险
                // 简单粗暴：收集该区域内所有节点的极限 Y
                if (rect.b > maxBottom) maxBottom = rect.b;
                if (rect.t < minTop) minTop = rect.t;
                hasObstacle = true;
            }

            // Y轴投影重叠（用于左右绕行）
            if (rect.b > rangeYMin && rect.t < rangeYMax) {
                if (defaultMidX > rect.l && defaultMidX < rect.r) {
                    xCandidates.push(rect.l - 20); // 左绕行
                    xCandidates.push(rect.r + 20); // 右绕行
                }
            }
        });

        if (hasObstacle) {
            yCandidates.push(minTop - 30);    // Sky Path (上方绕行)
            yCandidates.push(maxBottom + 30); // Ground Path (下方绕行)
        }
    }

    // --- 生成所有候选路径 ---

    // A. 左右折线 (Z-Shape Horizontal)
    xCandidates.forEach(mx => {
        candidates.push({
            type: 'Direct',
            points: [pStart, pBufS, { x: mx, y: pBufS.y }, { x: mx, y: pBufT.y }, pBufT, pEnd],
            cost: 0
        });
    });

    // B. 上下折线 (Z-Shape Vertical)
    // 默认中线
    candidates.push({
        type: 'Vertical',
        points: [pStart, pBufS, { x: pBufS.x, y: defaultMidY }, { x: pBufT.x, y: defaultMidY }, pBufT, pEnd],
        cost: 0
    });

    // 🔥 C. C-Shape (U-Turn) 上下大绕行 🔥
    // 逻辑：Start -> BufS -> (BufS.x, SkyY) -> (BufT.x, SkyY) -> BufT -> End
    yCandidates.forEach(my => {
        if (my === defaultMidY) return; // 跳过默认中线

        candidates.push({
            type: 'Skyline',
            points: [
                pStart,
                pBufS,
                { x: pBufS.x, y: my }, // 向上/下延伸
                { x: pBufT.x, y: my }, // 横跨
                pBufT,
                pEnd
            ],
            cost: 0
        });
    });

    // D. Detour (简单的外扩绕行，针对背对背情况)
    if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
        const detourS = pBufS.x + sDir.x * (offset + laneHash);
        candidates.push({
            type: 'Detour',
            points: [pStart, pBufS, { x: detourS, y: pBufS.y }, { x: detourS, y: pBufT.y }, pBufT, pEnd],
            cost: 0
        });
        const detourT = pBufT.x + tDir.x * (offset + laneHash);
        candidates.push({
            type: 'Detour',
            points: [pStart, pBufS, { x: detourT, y: pBufS.y }, { x: detourT, y: pBufT.y }, pBufT, pEnd],
            cost: 0
        });
    }

    // --- 评分系统 ---
    let bestPath = candidates[0];
    let minCost = Infinity;

    candidates.forEach(path => {
        let currentCost = 0;
        const pts = path.points;

        // 1. 长度惩罚
        let length = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            length += Math.abs(pts[i].x - pts[i+1].x) + Math.abs(pts[i].y - pts[i+1].y);
        }
        currentCost += length * 1;

        // 2. 回退惩罚
        if(pts.length > 3) {
            const firstSegX = pts[2].x - pts[1].x;
            const firstSegY = pts[2].y - pts[1].y;
            // 如果第一段折线方向与 Handle 方向相反 (Dot < 0)
            if ((sDir.x * firstSegX + sDir.y * firstSegY) < -0.1) currentCost += 5000;
        }

        // 3. 🔥 穿模惩罚 (权重极高) 🔥
        let nodeIntersections = 0;
        if (avoidanceNodes && avoidanceNodes.length > 0) {
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i]; const p2 = pts[i+1];
                for (const node of avoidanceNodes) {
                    if (node.type !== 'groupNode') continue;
                    const rect = getNodeRect(node, 10); // 碰撞检测
                    if (isSegmentCrossingRect(p1, p2, rect)) nodeIntersections++;
                }
            }
        }
        currentCost += nodeIntersections * 20000; // 穿模绝对禁止

        // 4. 重叠惩罚
        let edgeOverlaps = 0;
        if (existingEdges && existingEdges.length > 0) {
            for (let i = 0; i < pts.length - 1; i++) {
                const myP1 = pts[i]; const myP2 = pts[i+1];
                for (const edge of existingEdges) {
                    if (edge.id === edgeId) continue;
                    let otherPoints: {x:number, y:number}[] = [];
                    if (edge.data?.waypoints) otherPoints = edge.data.waypoints;
                    if (otherPoints && otherPoints.length > 1) {
                        for (let j = 0; j < otherPoints.length - 1; j++) {
                            const otherP1 = otherPoints[j]; const otherP2 = otherPoints[j+1];
                            const overlapLen = getSegmentOverlapLength(myP1, myP2, otherP1, otherP2);
                            if (overlapLen > 10) edgeOverlaps += overlapLen;
                        }
                    }
                }
            }
        }
        currentCost += edgeOverlaps * 50;

        path.cost = currentCost;
        if (currentCost < minCost) { minCost = currentCost; bestPath = path; }
    });

    const cleanPoints = simplifyOrthogonalPoints(bestPath.points);
    const pathStr = pointsToPath(cleanPoints, 8);
    const [lx, ly] = getLabelPositionFromPoints(cleanPoints);

    return [pathStr, lx, ly, cleanPoints];
}