// src/hooks/useGraphLayout.ts
import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { LayoutUtils } from '../utils/layoutUtils';

export const useGraphLayout = () => {
    const { setNodes } = useReactFlow();

    // 🔥 修复：将未使用的 width 重命名为 _width，以消除 TS6133 报错
    const handleNodeResize = useCallback((nodeId: string, _width: number, height: number) => {
        setNodes((nodes) => {
            // 调用布局工具类处理 Group 高度自适应和兄弟节点挤压
            return LayoutUtils.adjustLayoutAfterResize(nodes, nodeId, height);
        });
    }, [setNodes]);

    const runLayout = useCallback(() => {
        setNodes((currentNodes) => {
            let nextNodes = [...currentNodes];

            // 1. 找到所有的分组节点 (GroupNode)
            const groupNodes = nextNodes.filter(n => n.type === 'groupNode');

            // 2. 对每个分组执行内部重排
            groupNodes.forEach(group => {
                nextNodes = LayoutUtils.rearrangeGroup(nextNodes, group.id);
            });

            return nextNodes;
        });

        console.log('全局布局重排已执行');
    }, [setNodes]);

    return { handleNodeResize, runLayout };
};