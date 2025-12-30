// src/components/edges/EditableEdge/EdgeVisuals.tsx
import React, { memo, useState, useMemo } from 'react';
import { BaseEdgePath } from '../../BaseEdgePath.tsx'; // 保持引用
import type { EdgeVisualsProps } from './types';

export const EdgeVisuals = memo(({
                                     pathString,
                                     allPoints,
                                     style,
                                     markerEnd,
                                     selected,
                                     isManual,
                                     onEdgeClick,
                                     onEdgeDoubleClick,
                                     onSegmentMouseDown
                                 }: EdgeVisualsProps) => {
    const [isEdgeHovered, setIsEdgeHovered] = useState(false);

    // 生成分段和拖拽手柄
    const segmentsAndHandles = useMemo(() => {
        if (!allPoints || allPoints.length < 2) return null;

        const visuals = [];
        for (let i = 0; i < allPoints.length - 1; i++) {
            const p1 = allPoints[i];
            const p2 = allPoints[i + 1];
            if (!p1 || !p2) continue;

            const isHorizontal = Math.abs(p1.y - p2.y) < 1;
            const isVertical = Math.abs(p1.x - p2.x) < 1;

            if (isHorizontal || isVertical) {
                const orientation = isHorizontal ? 'horizontal' : 'vertical';
                const isDraggable = selected;
                const cursor = isDraggable ? (isHorizontal ? 'row-resize' : 'col-resize') : 'pointer';
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                visuals.push(
                    <line key={`hitbox-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                          stroke="transparent" strokeWidth={24}
                          style={{ cursor, pointerEvents: 'all' }}
                          onMouseDown={isDraggable ? (e) => onSegmentMouseDown(e, i, orientation) : undefined}
                          onDoubleClick={onEdgeDoubleClick}
                          onMouseEnter={() => setIsEdgeHovered(true)}
                          onMouseLeave={() => setIsEdgeHovered(false)}
                    ><title>拖拽调整</title></line>
                );

                if (selected || isEdgeHovered) {
                    visuals.push(
                        <g key={`handle-${i}`} style={{ pointerEvents: 'none' }}>
                            <circle cx={midX} cy={midY} r={5} fill="#fff" stroke="none" />
                            <circle cx={midX} cy={midY} r={3.5} fill="#2196F3" />
                        </g>
                    );
                }
            }
        }
        return visuals;
    }, [allPoints, selected, isEdgeHovered, onSegmentMouseDown, onEdgeDoubleClick]);

    const finalStyle = {
        ...style,
        // 1. 线型：优先读 style，默认为实线
        strokeDasharray: style?.strokeDasharray || '0',

        // 2. 颜色：优先读 style，其次看是否手动拖拽过，最后默认灰
        stroke: style?.stroke || (isManual ? '#1976D2' : '#B0BEC5'),

        // 3. 线宽：选中时 +1px，或者保持原有逻辑
        strokeWidth: selected ? ((style?.strokeWidth as number || 2) + 1) : (style?.strokeWidth || 2),

        // 4. 阴影 (可选)：既然去掉了强制橙色，加个阴影让选中状态更明显
        filter: selected ? 'drop-shadow(0 0 2px rgba(255, 87, 34, 0.8))' : 'none'
    };


    return (
        <g onMouseEnter={() => setIsEdgeHovered(true)} onMouseLeave={() => setIsEdgeHovered(false)}>
            {/* 基础路径 */}
            <BaseEdgePath
                path={pathString}
                markerEnd={markerEnd}
                selected={selected}
                style={finalStyle}
            />

            <g>
                {/* 整体点击热区 (兜底) */}
                <path d={pathString} fill="none" stroke="transparent" strokeWidth={20}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onClick={onEdgeClick}
                      onDoubleClick={onEdgeDoubleClick}
                />
                {/* 分段拖拽手柄 */}
                {segmentsAndHandles}
            </g>
        </g>
    );
});