// src/hooks/useGraphLayout.ts
import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { LayoutUtils } from '../utils/layoutUtils';

// -----------------------------------------------------------------------------
// 防抖工具函数 (Debounce Utility)
// 作用：将短时间内多次触发的函数调用合并为一次执行
// 修复：使用 ReturnType<typeof setTimeout> 兼容浏览器环境，避免 NodeJS 命名空间报错
// 修复：使用 unknown[] 替代 any[] 以通过 ESLint 严格模式
// -----------------------------------------------------------------------------
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
    // 场景 A: ChatNode 内容变多 -> 高度变高 -> 触发重排
    // 场景 B: GroupNode 宽度变大 -> 强制子节点变宽 -> 子节点高度自适应变化 -> 触发重排
    const handleNodeResize = useCallback((nodeId: string, width: number, height: number) => {

        setNodes((nodes) => {
            // 1. 先判断触发 Resize 的是不是 GroupNode
            const targetNode = nodes.find(n => n.id === nodeId);
            const isGroup = targetNode?.type === 'groupNode';

            // 2. 如果是 Group，计算出子节点应该有的新宽度
            // 假设 Group 左右 Padding 共 40px (与 geminiParser/nodeFactory 里的布局逻辑一致)
            const newChildWidth = isGroup ? Math.max(200, width - 40) : 0;

            let updatedNodes = nodes.map(n => {
                // A. 更新触发 resize 的节点本身 (GroupNode 或 ChatNode)
                if (n.id === nodeId) {
                    // 性能优化：如果尺寸没变，直接返回原对象
                    if (n.style?.width === width && n.style?.height === height) return n;

                    return {
                        ...n,
                        style: { ...n.style, width, height }, // 显式更新 style
                        width, height                         // 同步更新 internal measure attributes
                    };
                }

                // B. 🔥 联动逻辑：如果是 Group 变宽了，同步更新它的子节点
                if (isGroup && n.parentNode === nodeId) {
                    // 如果子节点宽度已经是目标宽度，就不动它
                    if (n.style?.width === newChildWidth) return n;

                    return {
                        ...n,
                        style: {
                            ...n.style,
                            width: newChildWidth, // 强制子节点宽度跟随
                            // 注意：不要在这里设置 height，让子节点组件(ChatNode)基于新宽度自动折行并适应高度
                        },
                        width: newChildWidth // 同步 React Flow 内部属性
                    };
                }

                return n;
            });
            
            // 🔥 立即对父分组进行重排：如果是 ChatNode，对其父分组进行重排
            if (!isGroup) {
                const node = nodes.find(n => n.id === nodeId);
                if (node?.parentNode) {
                    updatedNodes = LayoutUtils.rearrangeGroup(updatedNodes, node.parentNode);
                }
            }
            
            return updatedNodes;
        });

        // 3. 触发防抖重排
        // 无论是 ChatNode 直接变高，还是 GroupNode 变宽导致子节点间接变高，
        // 最终都会汇聚到这里，触发一次全局布局整理。
        debouncedLayoutRef.current();

    }, [setNodes]);

    // 组件卸载时的清理工作
    useEffect(() => {
        return () => {
            // 这里的闭包清理通常由 GC 处理，但保留 useEffect 结构以便未来扩展
        };
    }, []);

    return { handleNodeResize, runLayout };
};