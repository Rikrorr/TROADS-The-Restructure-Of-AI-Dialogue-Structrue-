// src/hooks/useDataPersistence.ts
import { useCallback } from 'react';
import { useReactFlow, getRectOfNodes, getTransformForBounds, type Node, type Edge } from 'reactflow';
import { toPng } from 'html-to-image';
import { convertHtmlToProjectData, type ProjectData } from '../utils/geminiParser';

/**
 * 数据持久化钩子
 * 提供：导出 JSON、导出图片、导入 JSON、导入 HTML (Gemini)
 */
export const useDataPersistence = (
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
    onLayout?: () => void
) => {
    // 获取 React Flow 内部数据的“探针”
    const { getNodes, getEdges, setViewport } = useReactFlow();

    // =========================================================================
    // 核心通用方法：统一加载项目数据
    // =========================================================================
    const loadProjectData = useCallback((data: ProjectData, isAppendMode: boolean = false) => {
        // 1. 基础校验
        if (!data.nodes || !Array.isArray(data.nodes)) {
            alert('数据格式错误：缺少 nodes 数据');
            return;
        }

        // 2. 处理节点 (覆盖模式 vs 追加模式)
        if (isAppendMode) {
            // == 追加模式 (用于导入 HTML) ==
            // 为了防止新节点覆盖在旧节点上面，我们需要计算偏移量
            setNodes((prevNodes) => {
                // 简单的策略：找到当前画布最右边的节点，往右挪 500px 放新内容
                const maxX = prevNodes.length > 0
                    ? Math.max(...prevNodes.map(n => n.position.x + (n.width || 400)))
                    : 0;

                const offsetX = maxX + 100;

                // 给新节点加上偏移量
                const shiftedNodes = data.nodes.map(n => {
                    // 只偏移最外层的父节点 (通常是 GroupNode)
                    // 子节点是相对坐标，不需要动
                    if (!n.parentNode) {
                        return { ...n, position: { ...n.position, x: n.position.x + offsetX } };
                    }
                    return n;
                });

                return [...prevNodes, ...shiftedNodes];
            });
            // 追加模式下，通常不更新 Edges 和 Viewport，除非新数据里有
            if (data.edges && data.edges.length > 0) {
                setEdges(prev => [...prev, ...data.edges]);
            }
            const chatNodeCount = data.nodes.filter(n => n.type === 'chatNode').length;
            alert(`成功导入 ${chatNodeCount} 条对话记录！`);

        } else {
            // == 覆盖模式 (用于读取项目 JSON) ==
            setNodes(data.nodes);
            // 兼容旧数据：如果没有 edges 字段，给个空数组
            setEdges(data.edges || []);

            // 只有在覆盖模式下才重置视角
            if (data.viewport) {
                setViewport(data.viewport);
            }
            alert('项目加载成功！');
        }

        // 🔥 2. 关键一步：延迟自动重排
        // 为什么要 setTimeout？因为 setNodes 是异步的，
        // 且 React Flow 需要时间把节点渲染到 DOM 上才能知道它们的真实高度。
        if (onLayout) {
            console.log('正在等待 DOM 渲染后执行重排...');
            setTimeout(() => {
                onLayout();
                console.log('自动重排执行完毕');
            }, 200); // 200ms 通常足够让 React 完成渲染
        }

    }, [setNodes, setEdges, setViewport]);


    // =========================================================================
    // 1. 导出功能 (JSON)
    // =========================================================================
    const exportToJson = useCallback(() => {
        const flowData: ProjectData = {
            version: '1.0.0',
            nodes: getNodes(),
            edges: getEdges(), // 确保包含连线
            // 也可以保存当前视角
            // viewport: useReactFlow().getViewport()
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
                // 调用统一加载器，模式为：覆盖 (isAppendMode = false)
                loadProjectData(rawData, false);
            } catch (err) {
                console.error(err);
                alert('JSON 文件解析失败');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // 清空以允许重复选择
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

                // 1. 适配器转换：HTML -> Standard JSON
                const projectData = convertHtmlToProjectData(htmlStr);

                if (projectData.nodes.length === 0) {
                    alert('未在 HTML 中解析出有效内容。');
                    return;
                }

                // 2. 调用统一加载器，模式为：追加 (isAppendMode = true)
                // 这样不会把画布上已有的内容清空
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