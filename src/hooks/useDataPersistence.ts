// src/hooks/useDataPersistence.ts
import { useCallback } from 'react';
import { useReactFlow, getRectOfNodes, getTransformForBounds, type Node, type Edge } from 'reactflow';
import { toPng } from 'html-to-image';
import { convertHtmlToProjectData } from '../utils/geminiParser';
// 确保从 types 导入，避免循环引用
import type { ProjectData, NodeCallbacks } from '../types';

export const useDataPersistence = (
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
    onLayout?: () => void,
    nodeCallbacks?: NodeCallbacks
) => {
    const { getNodes, getEdges, setViewport } = useReactFlow();

    // =========================================================================
    // 核心通用方法：统一加载项目数据
    // =========================================================================
    const loadProjectData = useCallback((data: ProjectData, isAppendMode: boolean = false) => {
        if (!data.nodes || !Array.isArray(data.nodes)) {
            alert('数据格式错误：缺少 nodes 数据');
            return;
        }

        // 注入真实回调 (Hydration)
        const hydratedNodes = data.nodes.map((node: Node) => {
            if (node.type === 'chatNode' || node.type === 'groupNode') {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...nodeCallbacks, // 注入回调
                    }
                };
            }
            return node;
        });

        if (isAppendMode) {
            // == 追加模式 ==
            setNodes((prevNodes) => {
                const maxX = prevNodes.length > 0
                    ? Math.max(...prevNodes.map(n => n.position.x + (n.width || 400)))
                    : 0;
                const offsetX = maxX + 100;

                const shiftedNodes = hydratedNodes.map((n: Node) => {
                    if (!n.parentNode) {
                        return { ...n, position: { ...n.position, x: n.position.x + offsetX } };
                    }
                    return n;
                });

                return [...prevNodes, ...shiftedNodes];
            });

            if (data.edges && data.edges.length > 0) {
                setEdges(prev => [...prev, ...data.edges]);
            }
            const chatNodeCount = hydratedNodes.filter((n: Node) => n.type === 'chatNode').length;
            alert(`成功导入 ${chatNodeCount} 条对话记录！`);

        } else {
            // == 覆盖模式 ==
            setNodes(hydratedNodes);
            setEdges(data.edges || []);
            if (data.viewport) {
                setViewport(data.viewport);
            }
            alert('项目加载成功！');
        }

        // 延迟自动重排
        if (onLayout) {
            console.log('正在等待 DOM 渲染后执行重排...');
            setTimeout(() => {
                onLayout();
            }, 200);
        }

        // 🔥🔥🔥 修复了这里的依赖数组，加入了 onLayout 和 nodeCallbacks
    }, [setNodes, setEdges, setViewport, onLayout, nodeCallbacks]);


    // =========================================================================
    // 1. 导出功能 (JSON)
    // =========================================================================
    const exportToJson = useCallback(() => {
        const flowData: ProjectData = {
            version: '1.0.0',
            nodes: getNodes(),
            edges: getEdges(),
        };

        const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `troads-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [getNodes, getEdges]);


    // =========================================================================
    // 2. 导入功能 (JSON)
    // =========================================================================
    const importFromJson = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const rawData = JSON.parse(content);
                loadProjectData(rawData, false);
            } catch (err) {
                console.error(err);
                alert('JSON 文件解析失败');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [loadProjectData]);


    // =========================================================================
    // 3. 导入功能 (HTML - 适配 Gemini/ChatGPT)
    // =========================================================================
    const importFromGeminiHtml = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const htmlStr = e.target?.result as string;
                const projectData = convertHtmlToProjectData(htmlStr);

                if (projectData.nodes.length === 0) {
                    alert('未在 HTML 中解析出有效内容。');
                    return;
                }

                loadProjectData(projectData, true);

            } catch (err) {
                console.error(err);
                alert('HTML 解析失败');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [loadProjectData]);


    // =========================================================================
    // 4. 拍照功能 (PNG)
    // =========================================================================
    const exportToImage = useCallback(() => {
        const viewportElem = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewportElem) return;

        const nodes = getNodes();
        if (nodes.length === 0) return;

        const nodesBounds = getRectOfNodes(nodes);
        const transform = getTransformForBounds(
            nodesBounds,
            nodesBounds.width,
            nodesBounds.height,
            0.5,
            2
        );

        toPng(viewportElem, {
            backgroundColor: '#f8f9fa',
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

    return { exportToJson, importFromJson, importFromGeminiHtml, exportToImage };
};