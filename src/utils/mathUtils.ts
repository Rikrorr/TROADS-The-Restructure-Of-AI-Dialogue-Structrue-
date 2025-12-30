// --- 基础几何计算 ---

// 获取两点间曼哈顿距离
export function getManhattanDistance(p1: {x: number, y: number}, p2: {x: number, y: number}) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

// 检测线段 (p1-p2) 与 矩形 (rect) 是否相交
// 采用 "Slab Method" 的简化版，不仅检测相交，还检测包含
export function isSegmentCrossingRect(x1: number, y1: number, x2: number, y2: number, rect: {left: number, right: number, top: number, bottom: number}) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // 1. 包围盒互斥检测 (AABB check)
    // 如果线段的包围盒在矩形外面，肯定不相交
    if (maxX < rect.left + 5) return false; // 加 5px 容差，允许贴边
    if (minX > rect.right - 5) return false;
    if (maxY < rect.top + 5) return false;
    if (minY > rect.bottom - 5) return false;

    // 2. 如果包围盒重叠，且线段是水平或垂直的（UI连线通常如此），则必定穿模
    // 因为我们的连线不可能是斜线穿过而不占据 rect 空间
    return true;
}

// 简单的哈希函数，用于生成确定的伪随机数
export function deterministicHash(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}