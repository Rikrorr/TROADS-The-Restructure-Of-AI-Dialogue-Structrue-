// src/components/edges/EditableEdge/types.ts
import type { EdgeLabelData } from '../../../types.ts';
import type { MarkerType, EdgeProps } from 'reactflow';

// 标签列表组件需要的 Props
export interface EdgeLabelListProps {
    labels: EdgeLabelData[];
    anchorX: number;
    anchorY: number;
    allPoints: { x: number; y: number }[];
    selectedLabelId?: string | null;
    onSelect: (id: string) => void;
    onChange: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onPositionChange: (id: string, absX: number, absY: number, isSnapped: boolean) => void;
}

// 视觉组件需要的 Props
export interface EdgeVisualsProps {
    pathString: string;
    allPoints: { x: number; y: number }[];
    style?: React.CSSProperties;
    markerEnd?: string | MarkerType;
    selected?: boolean;
    isManual: boolean;
    // 事件回调
    onEdgeClick: (e: React.MouseEvent) => void;
    onEdgeDoubleClick: (e: React.MouseEvent) => void;
    onSegmentMouseDown: (e: React.MouseEvent, index: number, orientation: 'horizontal' | 'vertical') => void;
}