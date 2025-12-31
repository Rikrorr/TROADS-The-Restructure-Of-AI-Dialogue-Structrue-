// src/utils/layoutUtils.ts
import type { Node } from 'reactflow';
// 引入常量配置
import { LAYOUT_CONFIG } from '../constants';

/**
 * 🛠️ 内部辅助函数：标准化获取节点高度
 * * 背景：在 React Flow 中，节点高度可能存在于多个位置：
 * 1. style.height (可能是数字或 '100px')
 * 2. node.height (内部测量属性)
 * 3. undefined (初始状态)
 * * 此函数负责抹平差异，返回一个可计算的 number。
 */
const getNodeHeight = (node: Node): number => {
    const hStyle = node.style?.height;

    // 情况1: 显式设置了数字高度 (例如 200)
    if (typeof hStyle === 'number') {
        return hStyle;
    }

    // 情况2: 设置了像素字符串 (例如 "200px")
    // 注意：parseInt 会自动忽略非数字后缀，所以 "200px" -> 200
    // 排除 "100%" 或 "auto" 这种动态值，因为无法用于数学计算
    if (typeof hStyle === 'string' && hStyle !== '100%' && hStyle !== 'auto') {
        return parseInt(hStyle, 10);
    }

    // 情况3: 回退策略
    // 优先使用 React Flow 测量出的实际渲染高度 (node.height)
    // 如果还没渲染，使用默认配置高度 (DEFAULT_NODE_HEIGHT)
    // 最后保底 100px
    return node.height || LAYOUT_CONFIG.DEFAULT_NODE_HEIGHT || 100;
};

export const LayoutUtils = {
    /**
     * 📍 计算新节点的 Y 轴起始位置
     * * 场景：用户点击“新建话题”或“追加提问”时。
     * 算法：堆叠逻辑 (Stacking)
     * 1. 找到当前组内最底部的那个节点。
     * 2. 在它下面加上间距 (GAP)，作为新节点的 Y。
     */
    getNextNodeY: (siblings: Node[]): number => {
        // 如果组是空的，直接放在顶部的 Padding 处
        if (siblings.length === 0) return LAYOUT_CONFIG.GROUP_PADDING_TOP;

        // 遍历寻找 visually 最靠下的节点 (Y 值最大)
        const lowestNode = siblings.reduce((prev, curr) =>
            prev.position.y > curr.position.y ? prev : curr
        );

        // 新 Y = 最底部节点的 Y + 它的高度 + 间隙
        return lowestNode.position.y + getNodeHeight(lowestNode) + LAYOUT_CONFIG.NODE_GAP;
    },

    /**
     * 📏 计算 Group 容器需要的总高度
     * * 场景：用于判断父容器是否足够大，是否需要被子节点“撑开”。
     */
    getGroupHeight: (siblings: Node[], activeNodeId?: string, activeNodeHeight?: number): number => {
        let maxBottomY = 0;

        for (const node of siblings) {
            // 获取当前节点的高度
            // 如果这个节点是“正在变动的主角”(activeNode)，强制使用传入的最新高度
            const h = (activeNodeId && node.id === activeNodeId && activeNodeHeight !== undefined)
                ? activeNodeHeight
                : getNodeHeight(node);

            // 计算该节点的底部边缘 Y 坐标
            const bottomY = node.position.y + h;

            // 记录最远的那个底部边缘
            if (bottomY > maxBottomY) maxBottomY = bottomY;
        }

        // Group 高度 = 最底部节点的边缘 + 底部 Padding
        // Math.max 保证容器至少有一个最小高度 (150)，防止空分组缩成一条线
        return Math.max(maxBottomY + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM, 150);
    },

    /**
     * 🔥🔥🔥 新增核心：重排指定分组内的所有子节点 (Core Re-layout Logic)
     * * 作用：将分组内的子节点按 Y 轴排序，紧凑排列，并更新分组高度。
     * * 场景：用于 useGraphLayout.runLayout() 以及 adjustLayoutAfterResize 的底层实现。
     * * @param allNodes 当前画布上所有的节点
     * @param groupId 需要重排的分组 ID
     * @returns 更新后的所有节点数组
     */
    rearrangeGroup: (allNodes: Node[], groupId: string): Node[] => {
        // 1. 找到该组的所有子节点
        const siblings = allNodes.filter(n => n.parentNode === groupId);

        // 如果没有子节点，或者找不到父节点，直接返回原列表，不折腾
        const groupNode = allNodes.find(n => n.id === groupId);
        if (!groupNode || siblings.length === 0) return allNodes;

        // 2. 按当前的 Y 轴位置排序 (确保从上到下)
        // 这一步是为了保持用户预期的顺序，避免因为数组乱序导致节点跳来跳去
        siblings.sort((a, b) => a.position.y - b.position.y);

        // 3. 重新计算 Y 坐标 (堆叠)
        let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;
        // 创建一个 Map 记录需要更新的节点 ID 和新 Y 坐标，为了 O(1) 查找
        const updates = new Map<string, number>();

        siblings.forEach(node => {
            updates.set(node.id, currentY);
            // 累加高度
            const h = getNodeHeight(node);
            currentY += h + LAYOUT_CONFIG.NODE_GAP;
        });

        // 4. 计算父分组的新高度
        // 循环结束后的 currentY 实际上包含了多加的一个 GAP，所以要减掉，再加上底部 Padding
        const newGroupHeight = Math.max(
            currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM,
            150
        );

        // 5. 返回更新后的全量节点数组 (Immutable update)
        return allNodes.map(node => {
            // A. 如果是子节点，且需要移动，更新 position.y
            if (updates.has(node.id)) {
                return {
                    ...node,
                    position: {
                        ...node.position,
                        y: updates.get(node.id)!
                    }
                };
            }
            // B. 如果是父分组，更新高度
            if (node.id === groupId) {
                return {
                    ...node,
                    style: { ...node.style, height: newGroupHeight },
                    height: newGroupHeight // 同时也更新 React Flow 内部属性
                };
            }
            // C. 其他节点保持不变
            return node;
        });
    },

    /**
     * 🔥🔥🔥 响应式自动重排 (Auto-Layout)
     * * 场景：当问答节点因为 AI 输出变高，或者手动 Resize 变高时调用。
     * * 逻辑：现在复用 rearrangeGroup，先更新目标高度，再重排整个组。
     */
    adjustLayoutAfterResize: (nodes: Node[], nodeId: string, newHeight: number): Node[] => {
        // 1. Immutable 深拷贝 & 预处理目标节点高度
        // 我们先生成一个已经“变高”了的节点列表，然后再传给 rearrangeGroup 去排队
        const nextNodes = nodes.map(n => {
            if (n.id === nodeId) {
                return {
                    ...n,
                    style: { ...n.style, height: newHeight },
                    height: newHeight
                };
            }
            // 浅拷贝其他节点，防止引用副作用
            return { ...n, style: { ...n.style }, position: { ...n.position } };
        });

        // 2. 找到父节点 ID
        const targetNode = nextNodes.find(n => n.id === nodeId);
        // 如果节点不存在或没有父级，直接返回更新了高度的列表
        if (!targetNode || !targetNode.parentNode) return nextNodes;

        // 3. 调用复用的重排逻辑，对所在的组进行整理
        return LayoutUtils.rearrangeGroup(nextNodes, targetNode.parentNode);
    }
};