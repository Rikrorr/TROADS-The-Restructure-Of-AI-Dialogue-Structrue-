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

    return { handleNodeResize };
};