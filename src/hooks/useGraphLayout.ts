// src/hooks/useGraphLayout.ts
import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { LayoutUtils } from '../utils/layoutUtils';

// -----------------------------------------------------------------------------
// 防抖工具函数 (Debounce Utility)
// -----------------------------------------------------------------------------
// 🔥 修复 1: 使用 unknown[] 替代 any[] 以通过 ESLint 检查
// 🔥 修复 2: 使用 ReturnType<typeof setTimeout> 替代 NodeJS.Timeout，兼容浏览器环境
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), wait);
    };
}

export const useGraphLayout = () => {
    // 解构获取 setNodes，用于更新节点状态
    const { setNodes } = useReactFlow();

    // =========================================================================
    // 1. 核心布局算法 (runLayout)
    // =========================================================================
    // 遍历所有分组，基于当前节点最新的高度（DOM Measured Height）进行重排
    const runLayout = useCallback(() => {
        setNodes((currentNodes) => {
            let nextNodes = [...currentNodes];

            // 找到所有分组节点
            const groupNodes = nextNodes.filter(n => n.type === 'groupNode');

            // 对每个分组执行内部重排
            // LayoutUtils.rearrangeGroup 会读取节点的 style.height 或 measured dimensions
            groupNodes.forEach(group => {
                nextNodes = LayoutUtils.rearrangeGroup(nextNodes, group.id);
            });

            return nextNodes;
        });
        console.log('🔄 [Auto Layout] 全局重排已执行');
    }, [setNodes]);

    // =========================================================================
    // 2. 防抖触发器 (Debounced Trigger)
    // =========================================================================
    // 使用 useRef 保持引用，确保在组件整个生命周期内使用的是同一个防抖计时器
    // 100ms 延迟通常足以覆盖 React 的一次批量渲染周期
    const debouncedLayoutRef = useRef(
        debounce(() => {
            runLayout();
        }, 100)
    );

    // =========================================================================
    // 3. 响应式 Resize 处理 (handleNodeResize)
    // =========================================================================
    // 此函数由 BaseNodeWrapper (ResizeObserver) 调用
    // 当 ChatNode 内容撑开 DOM 时，React Flow 会捕捉到尺寸变化并调用此回调
    const handleNodeResize = useCallback((nodeId: string, _width: number, height: number) => {

        // 步骤 A: 立即更新状态 (State Update)
        // 必须立即将新的高度写入 store，否则 UI 会闪烁或回弹
        setNodes((nodes) => nodes.map(n => {
            if (n.id === nodeId) {
                // 如果高度没变，直接返回原对象 (性能优化)
                // 注意：这里比较的是 style.height，因为 internal height 可能稍微不同
                if (n.style?.height === height) return n;

                return {
                    ...n,
                    style: { ...n.style, height }, // 显式更新 style
                    height: height                 // 同步更新 internal height
                };
            }
            return n;
        }));

        // 步骤 B: 触发防抖重排 (Debounced Layout)
        // 告诉引擎：“有人变高了，等所有人都变完后，排个序”
        // 这样即使导入 100 个节点，也只会触发 1 次 runLayout，而不是 100 次
        debouncedLayoutRef.current();

    }, [setNodes]);

    // 组件卸载时的清理工作
    useEffect(() => {
        return () => {
            // 在组件卸载时不需要特别的清理动作，
            // 因为 debouncedLayoutRef.current 是一个闭包，
            // 且 React Flow 的 setNodes 在卸载后调用是安全的（通常被忽略）。
        };
    }, []);

    return { handleNodeResize, runLayout };
};