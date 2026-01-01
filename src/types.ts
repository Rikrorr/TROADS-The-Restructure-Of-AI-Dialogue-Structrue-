// src/types.ts
import type { Node, Edge } from 'reactflow';
// =============================================================================
// 1. 通用类型
// =============================================================================
export type QAStatus = 'input' | 'loading' | 'streaming' | 'completed';

// 属性面板的 Tab 类型 (全项目唯一信源)
// 🔥 已更新：移除了未使用的 'DEFAULT'
export type TabId = 'EDIT' | 'STYLE' | 'LABEL_LIST';

// =============================================================================
// 2. 节点相关 (Node Data)
// =============================================================================

// 节点通用交互回调
export interface NodeCallbacks {
    onAsk: (nodeId: string, question: string) => void;
    onHandleDoubleClick: (nodeId: string, handleId: string) => void;
    onExtend: (parentNodeId: string, superBlockId: string) => void;
    onResize?: (nodeId: string, width: number, height: number) => void;
}

// 🔵 问答节点数据 (QABlock)
export interface QABlockData extends NodeCallbacks {
    question: string;
    answer: string;
    status: QAStatus;
    superBlockId: string;
    isLast?: boolean;
}

// 🟡 分组节点数据 (GroupBlock)
export interface GroupBlockData {
    label?: string; // 分组标题
    onResize?: (nodeId: string, width: number, height: number) => void;
    // 如果分组也需要支持 Resize 或其他回调，可以在这里添加
    // 目前 GroupNode 主要是 UI 展示，保留索引签名以防未来扩展
    [key: string]: unknown;
}

// =============================================================================
// 3. 连线相关 (Edge Data)
// =============================================================================

// 标签样式接口 (SmartLabel 使用)
export interface LabelStyle {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
}

// 单个标签的数据结构
export interface EdgeLabelData {
    id: string;
    text: string;

    // 相对偏移量 (用于保存到数据库)
    offsetX: number;
    offsetY: number;

    // 绝对坐标 (用于拖拽时的实时计算，SmartLabel 需要)
    absoluteX?: number;
    absoluteY?: number;

    // 是否吸附到了线上
    isSnapped?: boolean;

    // 标签自定义样式
    style?: LabelStyle;
}

// 连线上的自定义数据 (Edge.data)
export interface CustomEdgeData {
    // 兼容旧的单一偏移量
    controlPointOffset?: { x: number, y: number };

    // 标签列表
    labels?: EdgeLabelData[];

    // 存储手动拖拽后的关键折点 (不含起点和终点)
    waypoints?: { x: number, y: number }[];

    // 标记是否已被用户手动修改
    isManual?: boolean;

    // 当前选中的 Label ID (用于 InspectorPanel 联动)
    selectedLabelId?: string | null;

    // 选中 Label 的回调
    onLabelSelect?: (labelId: string | null) => void;
}

export interface ProjectData {
    version: string;
    nodes: Node[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
}