// src/components/nodes/base/types.ts
import type { CSSProperties, MouseEvent } from 'react';
import type { HandleType, Position } from 'reactflow';

export interface HandleConfig {
    id?: string;
    type: HandleType; // 'source' | 'target'
    position: Position;
    style?: CSSProperties;
    isConnectable?: boolean;
    // 允许传入自定义的双击事件，比如 ChatNode 需要双击高亮
    onDoubleClick?: (e: MouseEvent, handleId: string) => void;
}

export interface BaseNodeWrapperProps {
    id?: string; // 用于 ResizeObserver
    selected: boolean;
    children: React.ReactNode;

    // 配置项
    handles?: HandleConfig[];
    onResize?: (id: string, width: number, height: number) => void;

    // 样式与交互
    style?: CSSProperties;
    className?: string;
    selectionColor?: string; // 默认 #FF5722
    borderStyle?: 'solid' | 'dashed'; // 默认 solid
    onContextMenu?: (e: MouseEvent) => void; // 右键菜单事件
    onClick?: (e: MouseEvent) => void;
}