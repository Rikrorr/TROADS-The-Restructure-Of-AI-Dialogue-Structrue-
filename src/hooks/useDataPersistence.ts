// src/hooks/useDataPersistence.ts
import { useCallback } from 'react';
import {type Node, type Edge, useReactFlow, getRectOfNodes, getTransformForBounds } from 'reactflow';
import { toPng } from 'html-to-image';

export const useDataPersistence = (
    setNodes: (nodes: Node[]) => void,
    setEdges: (edges: Edge[]) => void
) => {
    const { getNodes } = useReactFlow();

    // 1. 导出为 JSON 文件
    const exportToJson = useCallback(() => {
        const flowData = {
            nodes: getNodes(),
            // 这里的 edges 如果您没有在组件外透传，也可以通过 useReactFlow().getEdges() 获取
            // 但为了保持一致性，建议在组件内传递，或者统一使用 useReactFlow
        };

        // 创建一个 Blob 对象
        const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 创建一个临时的下载链接并点击
        const link = document.createElement('a');
        link.href = url;
        link.download = `troads-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }, [getNodes]);

    // 2. 从 JSON 文件导入
    const importFromJson = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const flowData = JSON.parse(content);

                if (flowData.nodes) {
                    setNodes(flowData.nodes);
                    // 这里的 edges 同理，如果有 edges 数据则恢复
                    if (flowData.edges && setEdges) {
                        setEdges(flowData.edges);
                    }
                    alert('导入成功！');
                }
            } catch (err) {
                console.error(err);
                alert('文件解析失败，请检查是否为合法的 JSON 文件。');
            }
        };
        reader.readAsText(file);
        // 清空 input，防止重复选择同一个文件不触发 onChange
        event.target.value = '';
    }, [setNodes, setEdges]);

    // 3. 导出为 PNG 图片 (高清版)
    const exportToImage = useCallback(() => {
        // 找到 React Flow 的视口元素
        const viewportElem = document.querySelector('.react-flow__viewport') as HTMLElement;

        if (!viewportElem) return;

        // 计算所有节点的边界，为了把图截全
        const nodes = getNodes();
        const nodesBounds = getRectOfNodes(nodes);

        // 计算缩放变换，保证所有内容都能放进图片里
        const transform = getTransformForBounds(
            nodesBounds,
            nodesBounds.width,
            nodesBounds.height,
            0.5, // 最小缩放
            2    // 最大缩放
        );

        toPng(viewportElem, {
            backgroundColor: '#ffffff', // 背景设为白色，不然是透明的
            width: nodesBounds.width,
            height: nodesBounds.height,
            style: {
                width: `${nodesBounds.width}px`,
                height: `${nodesBounds.height}px`,
                transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
            },
        }).then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `troads-snapshot-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        });
    }, [getNodes]);

    return { exportToJson, importFromJson, exportToImage };
};