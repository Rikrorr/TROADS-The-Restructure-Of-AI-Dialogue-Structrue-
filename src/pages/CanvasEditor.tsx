// src/pages/CanvasEditor.tsx

// 1. React 核心钩子全家桶
// useState: 也就是"记账"，用来存数据（比如存菜单显示在哪里）
// useCallback: 也就是"定身术"，防止函数每次渲染都变身（避免子组件无意义重绘）
// useRef: 也就是"永久口袋"，存进去的东西在组件刷新时不会丢，而且改了也不会触发刷新
// useEffect: 也就是"侦察兵"，组件渲染完之后去干点杂活（比如更新 Ref）
// useMemo: 也就是"脑力缓存"，算过一次的结果存起来，下次直接用
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

// 2. React Flow 图形库核心
import ReactFlow, {
    useNodesState,      // 专门管节点的 Hook (处理拖拽位置更新)
    useEdgesState,      // 专门管连线的 Hook
    Background,         // 网格背景组件
    ConnectionMode,     // 连接模式：Loose 代表宽松模式，允许任意句柄连接
    type Connection,    // 连线事件的数据类型
    type Node,          // 节点数据类型
    ReactFlowProvider,  // 上下文提供者，必须包在最外层，里面的子组件才能用 useReactFlow
} from 'reactflow';

// 必须引入这个 CSS，不然画布就是一堆乱码，看不见线和框
import 'reactflow/dist/style.css';

// --- 自定义 Hooks (咱们的业务逻辑工头) ---
import { useStreamAI } from '../hooks/useStreamAI';             // 负责跟 AI 聊天吐字的
import { useGraphLayout } from '../hooks/useGraphLayout';       // 负责自动排版、把节点挤开的
import { useFlowInteractions } from '../hooks/useFlowInteractions'; // 负责拖拽、吸附、双击生成分支的大总管

// --- 工具类 ---
import { NodeFactory } from '../utils/nodeFactory'; // 造砖机器，生产标准化的节点和连线数据

// --- 组件 ---
import { ChatNode, GroupNode } from '../components/nodes'; // 自定义的节点外观组件
import { EditableEdge } from '../components/edges/EditableEdge'; // 自定义的连线外观组件
import { CustomConnectionLine } from '../components/CustomConnectionLine'; // 拖拽连线时那根虚线
import { InspectorPanel } from '../components/inspector/InspectorPanel'; // 右边的属性面板

// --- 类型定义 ---
import type { NodeCallbacks } from '../types'; // 也就是那 4 个核心回调函数的"岗位职责书"

// 告诉 React Flow：遇到 type='chatNode' 的数据，就用 ChatNode 组件渲染
const nodeTypes = { chatNode: ChatNode, groupNode: GroupNode };
// 告诉 React Flow：遇到 type='editableEdge' 的数据，就用 EditableEdge 组件渲染
const edgeTypes = { editableEdge: EditableEdge };

// --- 右键菜单小组件 ---
// 这是一个简单的内联组件，专门显示那个"删除节点"的小白框
const GraphContextMenu = ({ menu, onDelete }: {
    menu: { x: number; y: number; nodeId: string } | null; // 菜单坐标和对应的节点ID
    onDelete: () => void // 点击删除按钮时干啥
}) => {
    // 如果 menu 是空的，说明没右键点击，啥也不显示
    if (!menu) return null;

    return (
        <div style={{
            position: 'absolute',
            top: menu.y,
            left: menu.x,
            zIndex: 100, // 保证浮在画布最上面
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '4px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)' // 加点阴影，立体感
        }}>
            <button
                onClick={onDelete}
                style={{
                    display: 'block', width: '100%', padding: '8px 16px',
                    border: 'none', textAlign: 'left', background: 'none',
                    cursor: 'pointer', color: '#ff4444' // 红色警告色
                }}
            >
                删除节点
            </button>
        </div>
    );
};

// --- 主逻辑组件 ---
// 必须把逻辑拆分到这个组件里，因为外层包了 ReactFlowProvider，
// 只有在 Provider 内部的组件才能正确使用 React Flow 的 Hook。
function FlowContent() {
    // 获取路由参数
    const { projectId } = useParams<{ projectId: string }>();

    // 1. 初始化数据状态
    // useNodesState 是 React Flow 特供版 useState，它能自动处理"拖拽"导致的位置更新
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesState] = useEdgesState([]);

    // 右键菜单的状态：{x, y, nodeId} 或者 null (不显示)
    const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

    // 当前选中的连线标签ID（为了让属性面板知道现在在编辑哪个小标签）
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

    // 2. 引入业务能力
    // 拿到"触发 AI 回答"的能力
    const { triggerStream } = useStreamAI(setNodes);
    // 拿到"调整节点尺寸"的能力 (用于自动布局)
    const { handleNodeResize, runLayout } = useGraphLayout();

    // 3. 🔥 解决"闭包陷阱"的核心操作 (Ref + Memo)
    // 问题：如果在 useEffect 里直接用 interactions，可能会因为依赖项变化导致死循环。
    // 解决：我们用 Ref 存最新的函数，用 stableCallbacks 存不变的壳子。

    // 3.1 创建一个"永久口袋"，用来存放【此时此刻】最新的逻辑函数
    const logicRef = useRef<NodeCallbacks>({} as NodeCallbacks);

    // 3.2 创建一套【永远不变】的电话号码 (stableCallbacks)
    // 这个对象创建一次后，引用地址就再也不会变了。
    // 这样传给子组件时，子组件就不会因为 props 变化而无脑重渲染。
    const stableCallbacks = useMemo<NodeCallbacks>(() => ({
        // 当有人打这个电话时，它会去 logicRef 口袋里找【最新】的那个函数来执行
        onAsk: (id, q) => logicRef.current.onAsk(id, q),
        onHandleDoubleClick: (id, handleId) => logicRef.current.onHandleDoubleClick(id, handleId),
        onExtend: (id, sid) => logicRef.current.onExtend(id, sid),
        // 用 ?. 是因为 Resize 可能还没准备好
        onResize: (id, w, h) => logicRef.current.onResize?.(id, w, h),
    }), []); // [] 依赖数组为空，保证这个对象永远是同一个引用

    // 4. 获取复杂的交互逻辑 (大总管)
    // 把状态控制权 (setNodes, setEdges) 和上面的稳定回调交给 interactions 钩子
    const interactions = useFlowInteractions(nodes, setNodes, setEdges, stableCallbacks);

    // 5. 实时更新 Ref
    // 每次组件渲染完，都把最新的逻辑函数塞进 logicRef 口袋里。
    // 这样 stableCallbacks 打电话时，总能找到最新的处理逻辑。
    useEffect(() => {
        logicRef.current = {
            onAsk: triggerStream, // 绑定 AI
            onHandleDoubleClick: interactions.handleHandleDoubleClick, // 绑定双击
            onExtend: interactions.handleExtend, // 绑定追问
            onResize: handleNodeResize, // 绑定排版
        };
    });

    // 6. 事件处理函数
    // 连线事件：当用户手动从一个 Handle 拖到另一个 Handle 时触发
    const onConnect = useCallback((params: Connection) => {
        // 调用工厂造一条标准的新连线
        const newEdge = NodeFactory.createEdge(params.source!, params.target!, params.sourceHandle, params.targetHandle);
        // 加到列表里
        setEdges((eds) => [...eds, newEdge]);
    }, [setEdges]);

    // 节点右键事件：阻止默认浏览器菜单，显示我们的 GraphContextMenu
    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault(); // 别弹浏览器的右键菜单
        setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id }); // 记录位置和ID
    }, []);

    // 点击画布空白处：取消菜单，取消标签选中
    const onPaneClick = useCallback(() => {
        setMenu(null);
        setSelectedLabelId(null);
    }, []);

    // 点击菜单里的"删除"按钮
    const handleDeleteFromMenu = useCallback(() => {
        if (menu) {
            // 这里有个小技巧：先把那个要删除的节点设为 selected: true
            // 因为 interactions.handleDeleteSelected 是专门删除"选中项"的
            setNodes(nds => nds.map(n => ({...n, selected: n.id === menu.nodeId})));

            // setTimeout(0) 是为了让 setNodes 先执行完，状态更新了，再执行删除
            setTimeout(() => { interactions.handleDeleteSelected(); setMenu(null); }, 0);
        }
    }, [menu, setNodes, interactions]);

    // 属性面板修改数据时的回调 (例如改问题文本)
    const handleUpdateNode = useCallback((id: string, data: Record<string, unknown>) => {
        setNodes((nds) => nds.map((node) => {
            // 找到对应的节点，把新数据 {...data} 合并进去
            if (node.id === id) { return { ...node, data: { ...node.data, ...data } }; }
            return node;
        }));
    }, [setNodes]);

    // 7. 计算当前谁被选中了 (为了传给属性面板显示)
    const selectedNode = useMemo(() => nodes.find((n) => n.selected) || null, [nodes]);
    const selectedEdge = useMemo(() => edges.find((e) => e.selected) || null, [edges]);

    // 8. 🔥 这是一个很骚的操作：动态给 Edge 注入逻辑
    // 我们需要让连线知道"哪个标签被选中了"，还得给连线一个"选中标签"的方法。
    // 所以这里在 edges 数组传给 ReactFlow 之前，给每个 edge 的 data 加了点料。
    const edgesWithProps = useMemo(() => {
        return edges.map(edge => ({
            ...edge,
            data: {
                ...edge.data,
                selectedLabelId: selectedLabelId, // 告诉 Edge：现在谁是红人
                onLabelSelect: (labelId: string | null) => { // 给 Edge 一个回调：有人点标签时告诉我
                    setSelectedLabelId(labelId);
                    if (labelId) {
                        // 如果点了标签，顺便把这条线也选中，高亮显示
                        setEdges(eds => eds.map(e => ({...e, selected: e.id === edge.id})));
                    }
                }
            }
        }));
    }, [edges, selectedLabelId, setEdges]);

    // --- 界面渲染 ---
    return (
        // Flex 布局：左边面板，右边画布
        <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>

            {/* 左侧：属性面板 (Inspector) */}
            <div style={{ height: '100%', zIndex: 10, borderRight: '1px solid #e0e0e0', flexShrink: 0 }}>
                <InspectorPanel
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    selectedLabelId={selectedLabelId}
                    onUpdateNode={handleUpdateNode} // 传给面板：改数据的能力
                    onDelete={interactions.handleDeleteSelected} // 传给面板：删除的能力
                    onCreate={interactions.handleNewConversation} // 传给面板：新建话题的能力

                    setNodes={setNodes}
                    setEdges={setEdges}
                    // 🔥🔥🔥 传入重排函数 🔥🔥🔥
                    // 当导入完成后，useDataPersistence 会自动调用这个函数
                    onLayout={runLayout}
                    nodeCallbacks={stableCallbacks}
                />
            </div>

            {/* 右侧：React Flow 画布 */}
            <div style={{ flex: 1, position: 'relative', height: '100%', backgroundColor: '#f8f9fa' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edgesWithProps} // 注意：这里传的是加了料的 edgesWithProps
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesState}
                    onConnect={onConnect}
                    onNodeContextMenu={onNodeContextMenu}

                    // 🔥 核心交互挂载点 🔥
                    // 把 interactions 里的拖拽逻辑挂到 React Flow 的事件上
                    onNodeDragStart={interactions.handleNodeDragStart}
                    onNodeDragStop={interactions.handleNodeDragStop}

                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose} // 宽松模式：允许 Source 连 Source，比较自由
                    connectionLineComponent={CustomConnectionLine} // 拖拽时那根线的样子
                    fitView // 初始化时自动缩放适应屏幕
                >
                    <Background color="#e1e1e1" gap={20} />
                    {/* 条件渲染：只有 menu 有值时才显示右键菜单 */}
                    <GraphContextMenu menu={menu} onDelete={handleDeleteFromMenu} />
                </ReactFlow>
            </div>
        </div>
    );
}

// 导出 CanvasEditor，外层包裹 Provider
const CanvasEditor: React.FC = () => {
    return (
        <ReactFlowProvider>
            <FlowContent />
        </ReactFlowProvider>
    );
};

export default CanvasEditor;