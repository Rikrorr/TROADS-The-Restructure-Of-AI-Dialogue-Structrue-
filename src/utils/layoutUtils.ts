// src/utils/layoutUtils.ts
import type { Node } from 'reactflow';
// 引入常量配置，如果路径报错，请确认 constants.ts 是否存在以及 export 是否正确
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
     * 参数 activeNodeId/activeNodeHeight：
     * 用于处理“流式输出”或“拖拽中”的瞬时状态。
     * 即使 DOM 还没更新，我们也可以强制用 activeNodeHeight 来模拟计算。
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
     * 🔥🔥🔥 核心布局引擎：响应式自动重排 (Auto-Layout)
     * * 场景：当问答节点因为 AI 输出变高，或者手动 Resize 变高时调用。
     * 作用：确保下方的节点自动下移，父容器自动变高，避免重叠。
     * * @param nodes 全量节点数据
     * @param nodeId 发生高度变化的节点 ID
     * @param newHeight 该节点的新高度
     */
    adjustLayoutAfterResize: (nodes: Node[], nodeId: string, newHeight: number): Node[] => {
        // 1. Immutable 深拷贝
        // React 状态不可变性原则：必须创建新对象，否则 React Flow 可能检测不到变化而不重绘
        const nextNodes = nodes.map(n => ({
            ...n,
            style: { ...n.style },
            position: { ...n.position }
        }));

        // 2. 更新目标节点的高度数据
        const targetNode = nextNodes.find(n => n.id === nodeId);
        if (!targetNode) return nodes; // 防御性编程：找不到就原样返回

        // 更新样式高度 (影响 CSS)
        targetNode.style.height = newHeight;
        // 更新内部高度属性 (影响 React Flow 句柄位置等)
        targetNode.height = newHeight;

        // 如果该节点没有父级 (是独立节点)，不需要做复杂的挤压布局
        if (!targetNode.parentNode) {
            return nextNodes;
        }

        // 3. 准备处理父分组
        const groupId = targetNode.parentNode;
        const groupNode = nextNodes.find(n => n.id === groupId);

        if (!groupNode) return nextNodes; // 找不到爸爸，放弃治疗

        // 4. 获取所有兄弟节点 (包括自己)
        // 只有同一组内的节点才会被这次变动影响
        const siblings = nextNodes.filter(n => n.parentNode === groupId);

        // 5. 关键步骤：按 Y 轴位置排序
        // 我们必须知道谁在上面，谁在下面，才能正确地从上到下“堆叠”它们
        // 如果不排序，数组顺序可能是乱的，会导致布局错乱
        siblings.sort((a, b) => a.position.y - b.position.y);

        // 6. 核心挤压循环 (Accumulator Logic)
        // 从顶部开始，像砌砖一样，一个接一个地重新计算 Y 坐标
        let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;

        siblings.forEach(node => {
            // 强制重置当前节点的 Y 坐标
            // 这一步不仅解决了重叠，还顺便实现了“吸附”效果 (消除了多余空隙)
            node.position.y = currentY;

            // 累加器：当前 Y + 当前节点高度 + 间隙 = 下一个节点的起始 Y
            const h = getNodeHeight(node);
            currentY += h + LAYOUT_CONFIG.NODE_GAP;
        });

        // 7. 计算并更新父分组的高度
        // 循环结束后的 currentY 实际上包含了多加的一个 GAP，所以要减掉
        const newGroupHeight = currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;

        // 设置父分组新高度 (同样保证最小高度)
        groupNode.style.height = Math.max(newGroupHeight, 150);
        groupNode.height = Math.max(newGroupHeight, 150);

        // 返回全新的节点数组，触发 React 重渲染
        return nextNodes;
    }
};