// src/hooks/useFlowInteractions.ts
// 引入 React 的核心钩子：useCallback 用于缓存函数，useRef 用于跨渲染存储可变数据
import { useCallback, useRef } from 'react';
// 引入 React Flow 的类型定义：Node(节点), Edge(连线)
import type { Node, Edge } from 'reactflow';
// 引入 UUID 库，用于生成唯一的 ID
import { v4 as uuidv4 } from 'uuid';
// 引入节点工厂类，用于标准化创建 ChatNode 和 GroupNode 数据结构
import { NodeFactory } from '../utils/nodeFactory';
// 引入布局工具类，用于计算节点堆叠、高度等几何逻辑
import { LayoutUtils } from '../utils/layoutUtils';
// 引入全局布局常量配置
import { LAYOUT_CONFIG } from '../constants';
// 引入节点交互回调的类型定义
import type { NodeCallbacks } from '../types';

/**
 * 高级交互钩子 (核心逻辑层)
 * 职责：接管 React Flow 的默认行为，实现自定义的"拖拽合并"、"自动排版"、"双击分支"等业务逻辑
 */
export const useFlowInteractions = (
    nodes: Node[], // 当前所有的节点状态
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>, // 更新节点状态的方法
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>, // 更新连线状态的方法
    callbacks: NodeCallbacks // 注入给新节点的回调函数集合 (onAsk, onExtend等)
) => {
    // 1. Ref: 记录新建话题时的 Y 轴游标，每次新建话题后会增加，避免重叠
    const yPosRef = useRef(LAYOUT_CONFIG.INIT_Y);

    // 2. Ref: 记录拖拽开始时的位置，用于实现"拖拽距离过短自动回弹(Snap Back)"的功能
    const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);

    // 辅助函数：取消所有节点的选中状态 (将 selected 设为 false)
    const deselectAll = (nds: Node[]) => nds.map(n => ({ ...n, selected: false }));

    // 辅助函数：获取节点的实际高度 (优先取 style.height，兼容数字和字符串，兜底取默认值)
    const getNodeHeight = (n: Node) => {
        const hStyle = n.style?.height;
        // 如果是数字，直接返回
        if (typeof hStyle === 'number') return hStyle;
        // 如果是字符串且不是 "100%"，解析为整数
        if (typeof hStyle === 'string' && hStyle !== '100%') return parseInt(hStyle, 10);
        // 否则使用 reactflow 测量出的 height 或默认常量
        return n.height || LAYOUT_CONFIG.DEFAULT_NODE_HEIGHT;
    };

    // 提取常用的布局常量，减少代码冗余
    const FIXED_WIDTH = LAYOUT_CONFIG.GROUP_WIDTH; // 分组的固定宽度
    const PADDING_X = 40; // 子节点相对于分组的左右边距总和
    const CHILD_WIDTH = FIXED_WIDTH - PADDING_X; // 子节点(ChatNode)的实际宽度

    // =========================================================================
    // 1. 双击 Handle 生成分支 (Handle Double Click)
    // =========================================================================
    const handleHandleDoubleClick = useCallback((parentNodeId: string, handleId: string) => {
        // 在现有节点中查找被双击的父节点
        const parentNode = nodes.find(n => n.id === parentNodeId);
        // 如果没找到，直接返回
        if (!parentNode) return;

        // 获取父节点所属的分组 ID
        const parentGroupId = parentNode.parentNode;
        // 查找父分组对象
        const parentGroup = nodes.find(n => n.id === parentGroupId);

        // 计算基准 X 坐标：如果父节点在分组里，用分组的 X；否则用父节点自己的 X
        const baseX = parentGroup ? parentGroup.position.x : parentNode.position.x;
        // 计算基准 Y 坐标：同上
        const baseY = parentGroup ? parentGroup.position.y : parentNode.position.y;

        // 初始化新分组的坐标和连线端口
        let newGroupX = baseX;
        let edgeSourceHandle = '';
        let edgeTargetHandle = '';

        // 判断点击的是左边还是右边的 Handle
        if (handleId === 'right-source') {
            // 点击右侧：新分支生成在右侧 (基准X + 分组宽 + 间距)
            newGroupX = baseX + FIXED_WIDTH + LAYOUT_CONFIG.BRANCH_OFFSET_X;
            edgeSourceHandle = 'right-source'; // 连线从右出
            edgeTargetHandle = 'left-source';  // 连线从左入
        } else if (handleId === 'left-source') {
            // 点击左侧：新分支生成在左侧 (基准X - 分组宽 - 间距)
            newGroupX = baseX - FIXED_WIDTH - LAYOUT_CONFIG.BRANCH_OFFSET_X;
            edgeSourceHandle = 'left-source'; // 连线从左出
            edgeTargetHandle = 'right-source'; // 连线从右入
        } else {
            // 如果点击的不是预定义的 Handle，不做处理
            return;
        }

        // 生成两个新 ID
        const newGroupId = uuidv4();
        const newNodeId = uuidv4();

        // 1. 创建一个新的分组节点
        const newGroup = NodeFactory.createGroup(newGroupId, { x: newGroupX, y: baseY }, '新分支');
        // 强制设置分组宽度
        newGroup.style = { ...newGroup.style, width: FIXED_WIDTH };

        // 2. 在新分组内创建一个问答节点
        const newNode = NodeFactory.createChat(
            newNodeId,
            { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP }, // 相对坐标
            { superBlockId: uuidv4() }, // 赋予新的 superBlockId
            callbacks, // 传入回调
            newGroupId // 设置 parentNode 为新分组
        );
        // 强制设置子节点宽度
        newNode.style = { ...newNode.style, width: CHILD_WIDTH };

        // 3. 创建连接两个节点的连线
        const newEdge = NodeFactory.createEdge(parentNodeId, newNodeId, edgeSourceHandle, edgeTargetHandle);

        // 更新状态：取消旧选中，选中新分组，加入新节点
        setNodes(nds => [...deselectAll(nds), { ...newGroup, selected: true }, newNode]);
        // 更新连线状态
        setEdges(eds => [...eds, newEdge]);
    }, [nodes, setNodes, setEdges, callbacks, FIXED_WIDTH, CHILD_WIDTH]);

    // =========================================================================
    // 2. 追问 (Extend / Follow-up)
    // =========================================================================
    const handleExtend = useCallback((parentNodeId: string, superBlockId: string) => {
        // 查找触发追问的父节点
        const parentNode = nodes.find(n => n.id === parentNodeId);
        // 如果父节点不在分组内，无法进行组内追问，返回
        if (!parentNode?.parentNode) return;

        const groupId = parentNode.parentNode;

        // 1. 更新父节点状态：将 isLast 设为 false (隐藏其追问按钮)
        setNodes(nds => nds.map(n => n.id === parentNodeId ? { ...n, data: { ...n.data, isLast: false } } : n));

        // 查找同组的所有兄弟节点
        const siblings = nodes.filter(n => n.parentNode === groupId);
        // 使用布局工具计算下一个节点的 Y 坐标 (自动堆叠)
        const nextY = LayoutUtils.getNextNodeY(siblings);
        const newNodeId = uuidv4();

        // 2. 创建新的追问节点
        const newNode = NodeFactory.createChat(
            newNodeId,
            { x: 20, y: nextY }, // 计算出的堆叠坐标
            { superBlockId, isLast: true }, // 继承 superBlockId，标记为最新
            callbacks,
            groupId
        );
        newNode.style = { ...newNode.style, width: CHILD_WIDTH };

        // 将新节点追加到节点列表中 (注意：这里并未更新 Group 高度，Group 高度会在 render 或下次 layout 中自适应)
        setNodes(nds => [...nds, newNode]);
    }, [nodes, setNodes, callbacks, CHILD_WIDTH]);

    // =========================================================================
    // 3. 新建话题 (New Conversation)
    // =========================================================================
    const handleNewConversation = useCallback(() => {
        const groupId = uuidv4();
        const nodeId = uuidv4();

        // 1. 创建一个独立的新分组
        const group = NodeFactory.createGroup(
            groupId,
            { x: LAYOUT_CONFIG.INIT_X, y: yPosRef.current }, // 使用 ref 中的 Y 游标
            '新话题组'
        );
        group.style = { ...group.style, width: FIXED_WIDTH };

        // 2. 在分组内创建第一个问答节点
        const node = NodeFactory.createChat(
            nodeId,
            { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP },
            { superBlockId: uuidv4() },
            callbacks,
            groupId
        );
        node.style = { ...node.style, width: CHILD_WIDTH };

        // 更新状态，并增加 Y 轴游标，防止下一个新话题重叠
        setNodes(nds => [...deselectAll(nds), { ...group, selected: true }, node]);
        yPosRef.current += LAYOUT_CONFIG.OFFSET_Y;
    }, [setNodes, callbacks, FIXED_WIDTH, CHILD_WIDTH]);

    // =========================================================================
    // 4. 删除逻辑 (Delete Selected)
    // =========================================================================
    const handleDeleteSelected = useCallback(() => {
        // 获取当前选中的所有节点
        const selectedNodes = nodes.filter(n => n.selected);
        // 如果没有选中节点，仅尝试删除选中的连线
        if (selectedNodes.length === 0) {
            setEdges(eds => eds.filter(e => !e.selected));
            return;
        }

        // 记录需要删除的节点 ID 集合
        const nodeIdsToDelete = new Set<string>();
        selectedNodes.forEach(n => {
            nodeIdsToDelete.add(n.id);
            // 级联删除：如果删除了分组，要把分组内的子节点也加入删除列表
            if (n.type === 'groupNode') {
                nodes.filter(child => child.parentNode === n.id).forEach(c => nodeIdsToDelete.add(c.id));
            }
        });

        // 核心删除与重排逻辑
        setNodes(nds => {
            // 找出受影响的分组 (子节点被删，需要收缩高度)
            const groupsToCompact = new Set<string>();
            nds.forEach(n => {
                // 如果节点被删，且它有父节点，且父节点没被删 -> 父分组需要重排
                if (nodeIdsToDelete.has(n.id) && n.parentNode && !nodeIdsToDelete.has(n.parentNode)) {
                    groupsToCompact.add(n.parentNode);
                }
            });

            // 先过滤掉要删除的节点
            let nextNodes = nds.filter(n => !nodeIdsToDelete.has(n.id));

            // 遍历每个受影响的分组，进行内部重排
            groupsToCompact.forEach(groupId => {
                const groupNode = nds.find(n => n.id === groupId);
                if (!groupNode) return;

                // 找到该分组下剩余的子节点
                const siblings = nextNodes.filter(n => n.parentNode === groupId);

                if (siblings.length === 0) {
                    // 如果分组空了，直接删除该分组
                    nextNodes = nextNodes.filter(n => n.id !== groupId);
                } else {
                    // 如果还有子节点，按 Y 轴排序 (防止乱序)
                    siblings.sort((a, b) => a.position.y - b.position.y);
                    let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;

                    // 重新计算每个子节点的 Y 坐标 (填补被删节点留下的空隙)
                    const updatedSiblings = siblings.map((sib, index) => {
                        const h = getNodeHeight(sib);
                        const isLast = index === siblings.length - 1; // 重新标记最后一个节点
                        const newSib = {
                            ...sib,
                            position: { x: 20, y: currentY }, // 重置 Y
                            style: { ...sib.style, width: CHILD_WIDTH },
                            data: { ...sib.data, isLast } // 更新 isLast 状态
                        };
                        currentY += h + LAYOUT_CONFIG.NODE_GAP; // 累加高度
                        return newSib;
                    });

                    // 将更新后的子节点写回 nextNodes 数组
                    updatedSiblings.forEach(us => {
                        const idx = nextNodes.findIndex(n => n.id === us.id);
                        if(idx !== -1) nextNodes[idx] = us;
                    });

                    // 计算分组的新高度 (自适应收缩)
                    const newHeight = currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;
                    const gIdx = nextNodes.findIndex(n => n.id === groupId);
                    if(gIdx !== -1) {
                        nextNodes[gIdx] = {
                            ...groupNode,
                            style: { ...groupNode.style, height: newHeight, width: FIXED_WIDTH }
                        };
                    }
                }
            });
            return nextNodes;
        });

        // 同时删除与被删节点相连的连线
        setEdges(eds => eds.filter(e => !e.selected && !nodeIdsToDelete.has(e.source) && !nodeIdsToDelete.has(e.target)));
    }, [nodes, setNodes, setEdges, CHILD_WIDTH, FIXED_WIDTH]);

    // =========================================================================
    // 5. 拖拽逻辑 (核心修复点) - 这是最复杂的部分
    // =========================================================================
    // 拖拽开始：记录初始位置
    const handleNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === 'chatNode') {
            dragStartPosRef.current = { ...node.position };
        }
    }, []);

    // 拖拽结束：判定是合并、拆分还是回弹
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
        // 仅处理 ChatNode 且必须在分组内的节点 (目前假设所有 ChatNode 都在分组内)
        if (node.type !== 'chatNode' || !node.parentNode) return;

        // 1. 防抖/误触检测：如果移动距离很小 (<5px)，视为点击而非拖拽，直接放弃处理
        if (dragStartPosRef.current) {
            const dx = Math.abs(node.position.x - dragStartPosRef.current.x);
            const dy = Math.abs(node.position.y - dragStartPosRef.current.y);
            if (dx < 5 && dy < 5) {
                dragStartPosRef.current = null;
                return;
            }
        }

        const draggingNodeId = node.id;
        const newPosition = node.position; // 这是拖拽后的相对坐标 (相对于原父节点)
        const oldGroupId = node.parentNode;
        const oldGroup = nodes.find(n => n.id === oldGroupId);
        if (!oldGroup) return;

        // 获取节点尺寸
        const nodeH = getNodeHeight(node);
        const nodeW = CHILD_WIDTH;

        // 计算节点在画布上的【绝对坐标】中心点 (用于碰撞检测)
        const absX = oldGroup.position.x + newPosition.x;
        const absY = oldGroup.position.y + newPosition.y;
        const cursorX = absX + nodeW / 2;
        const cursorY = absY + nodeH / 2;

        // 初始化动作状态
        let action: 'MERGE' | 'SPLIT' | 'SNAP' = 'SNAP';
        let targetGroupNode: Node | undefined = undefined;

        // 2. 碰撞检测：寻找鼠标中心点落在哪个分组内
        targetGroupNode = nodes.find(n => {
            if (n.type !== 'groupNode') return false;
            const gW = FIXED_WIDTH;
            const gH = (n.style?.height as number) || 300;
            // 简单的矩形包含判断
            return (cursorX > n.position.x && cursorX < n.position.x + gW &&
                cursorY > n.position.y && cursorY < n.position.y + gH);
        });

        // 3. 判定逻辑
        if (targetGroupNode) {
            // 如果落在了某个分组上 -> MERGE (合并)
            action = 'MERGE';
        } else {
            // 如果没落在任何分组上，检查是否拖出了原分组的边界
            const gW = FIXED_WIDTH;
            const gH = (oldGroup.style?.height as number) || 300;
            // 计算相对于原分组的坐标
            const relCursorX = cursorX - oldGroup.position.x;
            const relCursorY = cursorY - oldGroup.position.y;
            // 判断是否越界
            const isOut = relCursorX < 0 || relCursorX > gW || relCursorY < 0 || relCursorY > gH;
            if (isOut) action = 'SPLIT'; // 越界 -> SPLIT (拆分)
        }

        // 4. 处理 SNAP (回弹)
        if (action === 'SNAP') {
            // 提取 ref 值避免闭包问题
            const snapPos = dragStartPosRef.current;
            if (snapPos) {
                // 将节点位置重置回拖拽前的位置
                setNodes(nds => nds.map(n => n.id === draggingNodeId ? { ...n, position: snapPos } : n));
            }
            dragStartPosRef.current = null;
            return;
        }

        // 如果是组内排序 (MERGE 到自己所在的组)，保留连线；否则删除相关连线
        const isInternalReorder = action === 'MERGE' && targetGroupNode?.id === oldGroupId;
        if (!isInternalReorder) {
            setEdges(eds => eds.filter(e => e.source !== draggingNodeId && e.target !== draggingNodeId));
        }

        // 5. 执行核心状态更新
        setNodes(nds => {
            // 获取最新状态的节点对象
            const latestNode = nds.find(n => n.id === draggingNodeId);
            if (!latestNode) return nds;

            // 标记需要重排的"脏"分组 (原分组 + 目标分组)
            const dirtyGroupIds = new Set<string>();
            dirtyGroupIds.add(oldGroupId);
            if (targetGroupNode) dirtyGroupIds.add(targetGroupNode.id);

            // 从现有节点列表中移除脏分组及其子节点，稍后我们会重新生成它们
            // 这里的逻辑有点激进：我们把受影响的组完全重建，而不是原地修改
            const nextNodes = nds.filter(n => {
                if (dirtyGroupIds.has(n.id)) return false; // 移除脏分组本身
                if (n.parentNode && dirtyGroupIds.has(n.parentNode)) return false; // 移除脏分组的子节点
                if (n.id === draggingNodeId) return false; // 移除正在拖拽的节点
                return true;
            });

            // 创建当前节点的"草稿"，准备放入新位置
            const currentNodeDraft = { ...latestNode, position: newPosition, selected: true, extent: undefined };

            // 如果是合并，更新 parentNode 并计算新的相对 Y 坐标
            if (action === 'MERGE' && targetGroupNode) {
                currentNodeDraft.parentNode = targetGroupNode.id;
                // 将绝对坐标转换为相对于目标分组的坐标
                currentNodeDraft.position = { x: 20, y: absY - targetGroupNode.position.y };
            }

            // 定义一个闭包函数：用于重排指定分组内的所有节点
            const compactGroup = (groupId: string, originalGroupNode: Node) => {
                // 找到该组原有的子节点 (排除当前拖拽节点，防止重复)
                const siblings = nds.filter(n => n.parentNode === groupId && n.id !== draggingNodeId);

                // 如果当前拖拽节点的目标是该组，且不是拆分操作，把它加进去
                if (currentNodeDraft.parentNode === groupId && action !== 'SPLIT') {
                    siblings.push(currentNodeDraft);
                }

                if(siblings.length === 0){
                    console.log(`分组 ${groupId} 已空，自动清理`);
                    return;
                }


                // 核心：按 Y 坐标排序，实现"插入排序"的效果
                siblings.sort((a, b) => a.position.y - b.position.y);

                // 重新计算堆叠布局
                let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;
                const updatedSiblings = siblings.map((sib, index) => {
                    const h = getNodeHeight(sib);
                    const isLast = index === siblings.length - 1;
                    const newSib = {
                        ...sib,
                        position: { x: 20, y: currentY }, // 强制对齐 X，重置 Y
                        style: { ...sib.style, width: CHILD_WIDTH },
                        data: { ...sib.data, isLast }
                    };
                    currentY += h + LAYOUT_CONFIG.NODE_GAP;
                    return newSib;
                });

                // 计算新高度
                const newHeight = currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;

                // 更新分组节点本身的高度
                const updatedGroup = {
                    ...originalGroupNode,
                    style: { ...originalGroupNode.style, height: newHeight, width: FIXED_WIDTH }
                };

                // 将重建好的分组和子节点加入 nextNodes
                nextNodes.push(updatedGroup);
                nextNodes.push(...updatedSiblings);
            };

            // 重排原分组 (填补拖走后的空缺)
            const oldGroupRef = nds.find(n => n.id === oldGroupId);
            if (oldGroupRef) compactGroup(oldGroupId, oldGroupRef);

            // 重排目标分组 (如果是合并操作)
            if (action === 'MERGE' && targetGroupNode && targetGroupNode.id !== oldGroupId) {
                const targetId = targetGroupNode.id;
                const targetGroupRef = nds.find(n => n.id === targetId);
                if (targetGroupRef) compactGroup(targetId, targetGroupRef);
            }

            // 处理 SPLIT (拆分操作)
            if (action === 'SPLIT') {
                // 计算新分组所需的高度
                const newGroupH = LAYOUT_CONFIG.GROUP_PADDING_TOP + nodeH + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM + 20;
                // 初始位置：在鼠标松开的地方
                let tX = oldGroup.position.x + newPosition.x - 20;
                const tY = oldGroup.position.y + newPosition.y - LAYOUT_CONFIG.GROUP_PADDING_TOP;
                // 简单的碰撞检测：防止新分组与其他分组重叠
                let collision = true;
                let loop = 0;
                while(collision && loop < 50) {
                    collision = false;
                    for (const ex of nextNodes) {
                        if (ex.type !== 'groupNode') continue;
                        const exW = FIXED_WIDTH;
                        const exH = (ex.style?.height as number) || 300;// 检查矩形重叠
                        if (!(tX + FIXED_WIDTH < ex.position.x || tX > ex.position.x + exW || tY + newGroupH < ex.position.y || tY > ex.position.y + exH)) {// 如果重叠，向右移动 30px
                            tX = ex.position.x + exW + 30;
                            collision = true;
                            break;
                        }
                    }
                    loop++;
                }
                // 创建新分组
                const newGroupId = uuidv4();
                const newGroup = NodeFactory.createGroup(newGroupId, { x: tX, y: tY }, '拆分话题');
                newGroup.style = { ...newGroup.style, height: newGroupH, width: FIXED_WIDTH };
                // 更新当前节点属性，使其属于新分组
                currentNodeDraft.parentNode = newGroupId;
                currentNodeDraft.position = { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP };
                currentNodeDraft.style = { ...currentNodeDraft.style, width: CHILD_WIDTH };
                currentNodeDraft.data = { ...currentNodeDraft.data, isLast: true };
                // 加入列表
                nextNodes.push(newGroup);
                nextNodes.push(currentNodeDraft);
            }
            return nextNodes;
        });
        // 清理 Ref
        dragStartPosRef.current = null;
    }, [nodes, setNodes, setEdges, CHILD_WIDTH, FIXED_WIDTH]);

    // 返回所有交互处理函数供组件调用
    return {
        handleHandleDoubleClick,
        handleExtend,
        handleNewConversation,
        handleNodeDragStart,
        handleNodeDragStop,
        handleDeleteSelected
    };
};