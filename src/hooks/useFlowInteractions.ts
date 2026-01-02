// src/hooks/useFlowInteractions.ts
// 引入 React 的核心钩子
import { useCallback, useRef } from 'react';
// 引入 React Flow 的类型定义
import type { Node, Edge } from 'reactflow';
// 引入 UUID 库
import { v4 as uuidv4 } from 'uuid';
// 引入工具类
import { NodeFactory } from '../utils/nodeFactory';
import { LayoutUtils } from '../utils/layoutUtils';
import { LAYOUT_CONFIG } from '../constants';
import type { NodeCallbacks } from '../types';

/**
 * 高级交互钩子 (核心逻辑层)
 */
export const useFlowInteractions = (
    nodes: Node[],
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
    callbacks: NodeCallbacks
) => {
    const yPosRef = useRef(LAYOUT_CONFIG.INIT_Y);
    const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);

    const deselectAll = (nds: Node[]) => nds.map(n => ({ ...n, selected: false }));

    const getNodeHeight = (n: Node) => {
        const hStyle = n.style?.height;
        if (typeof hStyle === 'number') return hStyle;
        if (typeof hStyle === 'string' && hStyle !== '100%') return parseInt(hStyle, 10);
        return n.height || LAYOUT_CONFIG.DEFAULT_NODE_HEIGHT;
    };

    // 默认常量 (仅作为初始值或兜底值)
    const DEFAULT_GROUP_WIDTH = LAYOUT_CONFIG.GROUP_WIDTH;
    const PADDING_X = 40;
    const DEFAULT_CHILD_WIDTH = DEFAULT_GROUP_WIDTH - PADDING_X;

    // =========================================================================
    // 1. 双击 Handle 生成分支 (Handle Double Click)
    // =========================================================================
    const handleHandleDoubleClick = useCallback((parentNodeId: string, handleId: string) => {
        const parentNode = nodes.find(n => n.id === parentNodeId);
        if (!parentNode) return;

        const parentGroupId = parentNode.parentNode;
        const parentGroup = nodes.find(n => n.id === parentGroupId);

        // 🔥 修复：获取父分组当前的实际宽度，而不是用常量
        const currentGroupWidth = (parentGroup?.style?.width as number) || DEFAULT_GROUP_WIDTH;

        const baseX = parentGroup ? parentGroup.position.x : parentNode.position.x;
        const baseY = parentGroup ? parentGroup.position.y : parentNode.position.y;

        let newGroupX = baseX;
        let edgeSourceHandle = '';
        let edgeTargetHandle = '';

        // 计算新分支的位置时，使用父分组的实际宽度
        if (handleId === 'right-source') {
            newGroupX = baseX + currentGroupWidth + LAYOUT_CONFIG.BRANCH_OFFSET_X;
            edgeSourceHandle = 'right-source';
            edgeTargetHandle = 'left-source';
        } else if (handleId === 'left-source') {
            newGroupX = baseX - DEFAULT_GROUP_WIDTH - LAYOUT_CONFIG.BRANCH_OFFSET_X;
            edgeSourceHandle = 'left-source';
            edgeTargetHandle = 'right-source';
        } else {
            return;
        }

        const newGroupId = uuidv4();
        const newNodeId = uuidv4();

        // 新分支默认使用标准宽度 (或者你也可以选择继承父宽，这里保持默认较为合理)
        const newGroup = NodeFactory.createGroup(newGroupId, { x: newGroupX, y: baseY }, '新分支', callbacks);
        newGroup.style = { ...newGroup.style, width: DEFAULT_GROUP_WIDTH };

        const newNode = NodeFactory.createChat(
            newNodeId,
            { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP },
            {
                superBlockId: uuidv4(),
                isLast: true
            },
            callbacks,
            newGroupId
        );
        newNode.style = { ...newNode.style, width: DEFAULT_CHILD_WIDTH };

        const newEdge = NodeFactory.createEdge(parentNodeId, newNodeId, edgeSourceHandle, edgeTargetHandle);

        setNodes(nds => [...deselectAll(nds), { ...newGroup, selected: true }, newNode]);
        setEdges(eds => [...eds, newEdge]);
    }, [nodes, setNodes, setEdges, callbacks, DEFAULT_GROUP_WIDTH, DEFAULT_CHILD_WIDTH]);

    // =========================================================================
    // 2. 追问 (Extend / Follow-up)
    // =========================================================================
    const handleExtend = useCallback((parentNodeId: string, superBlockId: string) => {
        const parentNode = nodes.find(n => n.id === parentNodeId);
        if (!parentNode?.parentNode) return;

        const groupId = parentNode.parentNode;

        // 🔥 修复：追问时，读取当前分组的宽度，确保新节点宽度一致
        const groupNode = nodes.find(n => n.id === groupId);
        const currentGroupWidth = (groupNode?.style?.width as number) || DEFAULT_GROUP_WIDTH;
        const currentChildWidth = currentGroupWidth - PADDING_X;

        setNodes(nds => nds.map(n => n.id === parentNodeId ? { ...n, data: { ...n.data, isLast: false } } : n));

        const siblings = nodes.filter(n => n.parentNode === groupId);
        const nextY = LayoutUtils.getNextNodeY(siblings);
        const newNodeId = uuidv4();

        const newNode = NodeFactory.createChat(
            newNodeId,
            { x: 20, y: nextY },
            { superBlockId, isLast: true },
            callbacks,
            groupId
        );
        // 🔥 应用计算出的动态宽度
        newNode.style = { ...newNode.style, width: currentChildWidth };

        setNodes(nds => [...nds, newNode]);
    }, [nodes, setNodes, callbacks, DEFAULT_GROUP_WIDTH]);

    // =========================================================================
    // 3. 新建话题 (New Conversation)
    // =========================================================================
    const handleNewConversation = useCallback(() => {
        const groupId = uuidv4();
        const nodeId = uuidv4();

        const group = NodeFactory.createGroup(
            groupId,
            { x: LAYOUT_CONFIG.INIT_X, y: yPosRef.current },
            '新话题组',
            callbacks
        );
        group.style = { ...group.style, width: DEFAULT_GROUP_WIDTH };

        const node = NodeFactory.createChat(
            nodeId,
            { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP },
            {
                superBlockId: uuidv4(),
                isLast: true
            },
            callbacks,
            groupId
        );
        node.style = { ...node.style, width: DEFAULT_CHILD_WIDTH };

        setNodes(nds => [...deselectAll(nds), { ...group, selected: true }, node]);
        yPosRef.current += LAYOUT_CONFIG.OFFSET_Y;
    }, [setNodes, callbacks, DEFAULT_GROUP_WIDTH, DEFAULT_CHILD_WIDTH]);

    // =========================================================================
    // 4. 删除逻辑 (Delete Selected)
    // =========================================================================
    const handleDeleteSelected = useCallback(() => {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) {
            setEdges(eds => eds.filter(e => !e.selected));
            return;
        }

        const nodeIdsToDelete = new Set<string>();
        selectedNodes.forEach(n => {
            nodeIdsToDelete.add(n.id);
            if (n.type === 'groupNode') {
                nodes.filter(child => child.parentNode === n.id).forEach(c => nodeIdsToDelete.add(c.id));
            }
        });

        setNodes(nds => {
            const groupsToCompact = new Set<string>();
            nds.forEach(n => {
                if (nodeIdsToDelete.has(n.id) && n.parentNode && !nodeIdsToDelete.has(n.parentNode)) {
                    groupsToCompact.add(n.parentNode);
                }
            });

            let nextNodes = nds.filter(n => !nodeIdsToDelete.has(n.id));

            groupsToCompact.forEach(groupId => {
                const groupNode = nds.find(n => n.id === groupId);
                if (!groupNode) return;

                // 🔥 修复：删除重排时，保持分组当前的宽度
                const currentGroupWidth = (groupNode.style?.width as number) || DEFAULT_GROUP_WIDTH;
                const currentChildWidth = currentGroupWidth - PADDING_X;

                const siblings = nextNodes.filter(n => n.parentNode === groupId);

                if (siblings.length === 0) {
                    nextNodes = nextNodes.filter(n => n.id !== groupId);
                } else {
                    siblings.sort((a, b) => a.position.y - b.position.y);
                    let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;

                    const updatedSiblings = siblings.map((sib, index) => {
                        const h = getNodeHeight(sib);
                        const isLast = index === siblings.length - 1;
                        const newSib = {
                            ...sib,
                            position: { x: 20, y: currentY },
                            // 🔥 确保剩下的子节点宽度正确
                            style: { ...sib.style, width: currentChildWidth },
                            data: { ...sib.data, isLast }
                        };
                        currentY += h + LAYOUT_CONFIG.NODE_GAP;
                        return newSib;
                    });

                    updatedSiblings.forEach(us => {
                        const idx = nextNodes.findIndex(n => n.id === us.id);
                        if(idx !== -1) nextNodes[idx] = us;
                    });

                    const newHeight = currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;
                    const gIdx = nextNodes.findIndex(n => n.id === groupId);
                    if(gIdx !== -1) {
                        nextNodes[gIdx] = {
                            ...groupNode,
                            // 🔥 写入保持后的宽度
                            style: { ...groupNode.style, height: newHeight, width: currentGroupWidth }
                        };
                    }
                }
            });
            return nextNodes;
        });

        setEdges(eds => eds.filter(e => !e.selected && !nodeIdsToDelete.has(e.source) && !nodeIdsToDelete.has(e.target)));
    }, [nodes, setNodes, setEdges, DEFAULT_CHILD_WIDTH, DEFAULT_GROUP_WIDTH]);

    // =========================================================================
    // 5. 拖拽逻辑 (Drag & Drop) - 🔥 核心修复区域
    // =========================================================================
    const handleNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === 'chatNode') {
            dragStartPosRef.current = { ...node.position };
        }
    }, []);

    const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type !== 'chatNode' || !node.parentNode) return;

        if (dragStartPosRef.current) {
            const dx = Math.abs(node.position.x - dragStartPosRef.current.x);
            const dy = Math.abs(node.position.y - dragStartPosRef.current.y);
            if (dx < 5 && dy < 5) {
                dragStartPosRef.current = null;
                return;
            }
        }

        const draggingNodeId = node.id;
        const newPosition = node.position;
        const oldGroupId = node.parentNode;
        const oldGroup = nodes.find(n => n.id === oldGroupId);
        if (!oldGroup) return;

        // 计算当前节点的临时尺寸
        const nodeH = getNodeHeight(node);
        const nodeW = (node.style?.width as number) || DEFAULT_CHILD_WIDTH;

        const absX = oldGroup.position.x + newPosition.x;
        const absY = oldGroup.position.y + newPosition.y;
        const cursorX = absX + nodeW / 2;
        const cursorY = absY + nodeH / 2;

        let action: 'MERGE' | 'SPLIT' | 'SNAP' = 'SNAP';
        let targetGroupNode: Node | undefined = undefined;

        // 碰撞检测：寻找目标分组
        targetGroupNode = nodes.find(n => {
            if (n.type !== 'groupNode') return false;
            // 🔥 使用目标分组的 *实际宽度* 进行碰撞检测
            const gW = (n.style?.width as number) || DEFAULT_GROUP_WIDTH;
            const gH = (n.style?.height as number) || 300;
            return (cursorX > n.position.x && cursorX < n.position.x + gW &&
                cursorY > n.position.y && cursorY < n.position.y + gH);
        });

        if (targetGroupNode) {
            action = 'MERGE';
        } else {
            // 越界检测
            const gW = (oldGroup.style?.width as number) || DEFAULT_GROUP_WIDTH;
            const gH = (oldGroup.style?.height as number) || 300;
            const relCursorX = cursorX - oldGroup.position.x;
            const relCursorY = cursorY - oldGroup.position.y;
            const isOut = relCursorX < 0 || relCursorX > gW || relCursorY < 0 || relCursorY > gH;
            if (isOut) action = 'SPLIT';
        }

        if (action === 'SNAP') {
            const snapPos = dragStartPosRef.current;
            if (snapPos) {
                setNodes(nds => nds.map(n => n.id === draggingNodeId ? { ...n, position: snapPos } : n));
            }
            dragStartPosRef.current = null;
            return;
        }

        const isInternalReorder = action === 'MERGE' && targetGroupNode?.id === oldGroupId;
        if (!isInternalReorder) {
            setEdges(eds => eds.filter(e => e.source !== draggingNodeId && e.target !== draggingNodeId));
        }

        setNodes(nds => {
            const latestNode = nds.find(n => n.id === draggingNodeId);
            if (!latestNode) return nds;

            const dirtyGroupIds = new Set<string>();
            dirtyGroupIds.add(oldGroupId);
            if (targetGroupNode) dirtyGroupIds.add(targetGroupNode.id);

            const nextNodes = nds.filter(n => {
                if (dirtyGroupIds.has(n.id)) return false;
                if (n.parentNode && dirtyGroupIds.has(n.parentNode)) return false;
                if (n.id === draggingNodeId) return false;
                return true;
            });

            const currentNodeDraft = { ...latestNode, position: newPosition, selected: true, extent: undefined };

            if (action === 'MERGE' && targetGroupNode) {
                currentNodeDraft.parentNode = targetGroupNode.id;
                currentNodeDraft.position = { x: 20, y: absY - targetGroupNode.position.y };
            }

            // 🔥 闭包函数：重排分组 (compactGroup)
            // 接收 originalGroupNode 参数，以便读取它最新的 style.width
            const compactGroup = (groupId: string, originalGroupNode: Node) => {
                const siblings = nds.filter(n => n.parentNode === groupId && n.id !== draggingNodeId);

                if (currentNodeDraft.parentNode === groupId && action !== 'SPLIT') {
                    siblings.push(currentNodeDraft);
                }

                if(siblings.length === 0){
                    return;
                }

                // 🔥🔥🔥 核心修复：读取分组的动态宽度
                const currentGroupWidth = (originalGroupNode.style?.width as number) || DEFAULT_GROUP_WIDTH;
                const currentChildWidth = currentGroupWidth - PADDING_X;

                siblings.sort((a, b) => a.position.y - b.position.y);

                let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;
                const updatedSiblings = siblings.map((sib, index) => {
                    const h = getNodeHeight(sib);
                    const isLast = index === siblings.length - 1;
                    const newSib = {
                        ...sib,
                        position: { x: 20, y: currentY },
                        // 🔥 强制应用动态计算的宽度，而不是常量
                        style: { ...sib.style, width: currentChildWidth },
                        data: { ...sib.data, isLast }
                    };
                    currentY += h + LAYOUT_CONFIG.NODE_GAP;
                    return newSib;
                });

                const newHeight = currentY - LAYOUT_CONFIG.NODE_GAP + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;

                const updatedGroup = {
                    ...originalGroupNode,
                    // 🔥 确保分组宽度不被重置
                    style: { ...originalGroupNode.style, height: newHeight, width: currentGroupWidth }
                };

                nextNodes.push(updatedGroup);
                nextNodes.push(...updatedSiblings);
            };

            const oldGroupRef = nds.find(n => n.id === oldGroupId);
            if (oldGroupRef) compactGroup(oldGroupId, oldGroupRef);

            if (action === 'MERGE' && targetGroupNode && targetGroupNode.id !== oldGroupId) {
                const targetId = targetGroupNode.id;
                const targetGroupRef = nds.find(n => n.id === targetId);
                if (targetGroupRef) compactGroup(targetId, targetGroupRef);
            }

            if (action === 'SPLIT') {
                const newGroupH = LAYOUT_CONFIG.GROUP_PADDING_TOP + nodeH + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM + 20;
                let tX = oldGroup.position.x + newPosition.x - 20;
                const tY = oldGroup.position.y + newPosition.y - LAYOUT_CONFIG.GROUP_PADDING_TOP;

                let collision = true;
                let loop = 0;
                while(collision && loop < 50) {
                    collision = false;
                    for (const ex of nextNodes) {
                        if (ex.type !== 'groupNode') continue;
                        const exW = (ex.style?.width as number) || DEFAULT_GROUP_WIDTH;
                        const exH = (ex.style?.height as number) || 300;
                        if (!(tX + DEFAULT_GROUP_WIDTH < ex.position.x || tX > ex.position.x + exW || tY + newGroupH < ex.position.y || tY > ex.position.y + exH)) {
                            tX = ex.position.x + exW + 30;
                            collision = true;
                            break;
                        }
                    }
                    loop++;
                }

                const newGroupId = uuidv4();
                const newGroup = NodeFactory.createGroup(newGroupId, { x: tX, y: tY }, '拆分话题', callbacks);
                // 拆分出的新话题使用默认宽度，避免继承过宽或过窄的尺寸
                newGroup.style = { ...newGroup.style, height: newGroupH, width: DEFAULT_GROUP_WIDTH };

                currentNodeDraft.parentNode = newGroupId;
                currentNodeDraft.position = { x: 20, y: LAYOUT_CONFIG.GROUP_PADDING_TOP };
                currentNodeDraft.style = { ...currentNodeDraft.style, width: DEFAULT_CHILD_WIDTH };
                currentNodeDraft.data = { ...currentNodeDraft.data, isLast: true };

                nextNodes.push(newGroup);
                nextNodes.push(currentNodeDraft);
            }
            return nextNodes;
        });
        dragStartPosRef.current = null;
    }, [nodes, setNodes, setEdges, DEFAULT_CHILD_WIDTH, DEFAULT_GROUP_WIDTH]);

    return {
        handleHandleDoubleClick,
        handleExtend,
        handleNewConversation,
        handleNodeDragStart,
        handleNodeDragStop,
        handleDeleteSelected
    };
};