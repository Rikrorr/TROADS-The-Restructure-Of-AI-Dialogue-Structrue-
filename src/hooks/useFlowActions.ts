// src/hooks/useFlowActions.ts
import { useCallback } from 'react';
import { useReactFlow, type Node } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { QABlockData, GroupBlockData } from '../types';
import { LAYOUT_CONFIG } from '../constants';

export const useFlowActions = () => {
    // 1. 获取 React Flow 的底层控制权
    const {
        setNodes,
        setEdges,
        getNodes,
        // 🔥 修复 1: 移除了 getEdges, screenToFlowPosition, fitView 等未使用的解构
    } = useReactFlow();

    // ==========================================================
    // 🏷️ 基础 CRUD 操作 (通用)
    // ==========================================================

    /**
     * 更新指定节点的 data 字段 (支持局部更新)
     */
    const updateNodeData = useCallback((id: string, patch: Record<string, any>) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return {
                    ...node,
                    data: { ...node.data, ...patch }
                };
            }
            return node;
        }));
    }, [setNodes]);

    /**
     * 删除当前选中的节点和连线
     */
    const deleteSelection = useCallback(() => {
        // 🔥 修复 2: 移除了未使用的 selectedNodes 变量
        // const selectedNodes = getNodes().filter(n => n.selected);

        setNodes((nds) => nds.filter((n) => !n.selected));
        setEdges((eds) => eds.filter((e) => !e.selected));
    }, [setNodes, setEdges]); // 🔥 依赖项也移除了 getNodes

    // ==========================================================
    // 🚀 业务操作 (语义化创建)
    // ==========================================================

    /**
     * 添加一个问答节点 (ChatNode)
     */
    const addChatNode = useCallback((x?: number, y?: number) => {
        const position = (x !== undefined && y !== undefined)
            ? { x, y }
            : { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };

        const newNode: Node<QABlockData> = {
            id: uuidv4(),
            type: 'chatNode',
            position,
            selected: true,
            data: {
                status: 'input',
                question: '',
                answer: '',
                superBlockId: '',
                onAsk: () => console.log('Ask triggered'),
                onHandleDoubleClick: () => {},
                onExtend: () => {},
            },
        };

        // 🔥 修复 3: 解决 TS2769 类型报错
        // 使用扩展运算符 [...] 代替 .concat()，避免 TS 对 boolean | undefined 的严格推断错误
        setNodes((nds) => [
            ...nds.map(n => ({ ...n, selected: false })),
            newNode
        ]);

        return newNode.id;
    }, [setNodes]);

    /**
     * 添加一个分组节点 (GroupNode)
     */
    const addGroupNode = useCallback((x?: number, y?: number) => {
        const position = (x !== undefined && y !== undefined)
            ? { x, y }
            : { x: 300, y: 100 };

        const newNode: Node<GroupBlockData> = {
            id: uuidv4(),
            type: 'groupNode',
            position,
            selected: true,
            style: {
                width: LAYOUT_CONFIG?.GROUP_WIDTH || 300,
                height: 200
            },
            data: {
                label: '新建分组'
            }
        };

        // 🔥 修复 4: 同样使用扩展运算符修复类型问题
        setNodes((nds) => [
            ...nds.map(n => ({ ...n, selected: false })),
            newNode
        ]);

        return newNode.id;
    }, [setNodes]);

    return {
        updateNodeData,
        deleteSelection,
        addChatNode,
        addGroupNode,
        getNodes,
    };
};