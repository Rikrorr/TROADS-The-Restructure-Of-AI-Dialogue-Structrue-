// src/components/edges/EditableEdge/EdgeLabelList.tsx
import React, { useState, useRef, useEffect, memo } from 'react';
import { EdgeLabelRenderer, useReactFlow } from 'reactflow';
import type { EdgeLabelListProps } from './types';
import type { EdgeLabelData } from '../../../types'; // 注意：通常是 types.ts 而不是 types.ts.ts，请根据实际情况调整

// --- 数学工具 (保持原有逻辑) ---
function getClosestPointOnSegment(pX: number, pY: number, x1: number, y1: number, x2: number, y2: number) {
    const A = pX - x1;
    const B = pY - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = pX - xx;
    const dy = pY - yy;
    return { x: xx, y: yy, distance: Math.sqrt(dx * dx + dy * dy) };
}

// --- SmartLabel 组件 ---
const SmartLabel = ({
                        label, anchorX, anchorY, allPoints, isSelected,
                        onSelect, onChange, onDelete, onPositionChange
                    }: {
    label: EdgeLabelData, anchorX: number, anchorY: number,
    allPoints: {x:number, y:number}[],
    isSelected: boolean,
    onSelect: (id: string) => void,
    onChange: (id: string, text: string) => void,
    onDelete: (id: string) => void,
    onPositionChange: (id: string, absX: number, absY: number, isSnapped: boolean) => void
}) => {
    const { getViewport } = useReactFlow();
    const [isHovered, setIsHovered] = useState(false);
    const spanRef = useRef<HTMLSpanElement>(null);
    const [inputWidth, setInputWidth] = useState(40);

    // 🔥 修复: 使用 Ref 存储监听器，防止内存泄漏
    const listenersRef = useRef<{ move: ((e: MouseEvent) => void) | null, up: ((e: MouseEvent) => void) | null }>({ move: null, up: null });

    // 🔥 组件卸载时强制清理
    useEffect(() => {
        return () => {
            if (listenersRef.current.move) window.removeEventListener('mousemove', listenersRef.current.move);
            if (listenersRef.current.up) window.removeEventListener('mouseup', listenersRef.current.up);
        };
    }, []);

    const currentX = Number.isFinite(label.absoluteX) ? label.absoluteX! : (anchorX + (label.offsetX || 0));
    const currentY = Number.isFinite(label.absoluteY) ? label.absoluteY! : (anchorY + (label.offsetY || 0));

    const customStyle = label.style || {};
    const fontSize = customStyle.fontSize || 11;
    const textColor = customStyle.color || '#555';
    const bgColor = customStyle.backgroundColor || '#f8f9fa';
    const customBorderColor = customStyle.borderColor || '#d1d5db';
    const borderWidth = customStyle.borderWidth !== undefined ? customStyle.borderWidth : 1;

    const isActive = isSelected || isHovered;

    let finalBorderColor = customBorderColor;
    if (label.isSnapped) finalBorderColor = '#4CAF50';
    else if (isActive) finalBorderColor = '#2196F3';

    const boxShadow = isActive ? '0 0 0 2px rgba(33, 150, 243, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)';

    useEffect(() => { if (spanRef.current) setInputWidth(Math.max(30, spanRef.current.offsetWidth + 15)); }, [label.text, fontSize]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(label.id);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect(label.id);

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startLabelX = currentX;
        const startLabelY = currentY;

        const handleMove = (me: MouseEvent) => {
            const { zoom } = getViewport();
            const dx = (me.clientX - startMouseX) / zoom;
            const dy = (me.clientY - startMouseY) / zoom;
            const rawX = startLabelX + dx;
            const rawY = startLabelY + dy;

            let bestX = rawX;
            let bestY = rawY;
            let minDistance = Infinity;
            let snapped = false;
            const SNAP_THRESHOLD = 20;

            if (allPoints && allPoints.length > 1) {
                for (let i = 0; i < allPoints.length - 1; i++) {
                    const p1 = allPoints[i];
                    const p2 = allPoints[i+1];
                    const { x, y, distance } = getClosestPointOnSegment(rawX, rawY, p1.x, p1.y, p2.x, p2.y);

                    if (distance < minDistance) {
                        minDistance = distance;
                        if (distance < SNAP_THRESHOLD) {
                            bestX = x;
                            bestY = y;
                            snapped = true;
                        }
                    }
                }
            }
            onPositionChange(label.id, snapped ? bestX : rawX, snapped ? bestY : rawY, snapped);
        };

        const handleUp = () => {
            // 清理并重置 Ref
            if (listenersRef.current.move) window.removeEventListener('mousemove', listenersRef.current.move);
            if (listenersRef.current.up) window.removeEventListener('mouseup', listenersRef.current.up);
            listenersRef.current = { move: null, up: null };
        };

        // 注册并保存到 Ref
        listenersRef.current = { move: handleMove, up: handleUp };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    return (
        <div
            className="nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${currentX}px,${currentY}px)`,
                pointerEvents: 'all',
                zIndex: 3000,
                backgroundColor: bgColor,
                borderRadius: '12px',
                padding: '4px 8px',
                border: `${borderWidth}px solid ${finalBorderColor}`,
                boxShadow: boxShadow,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab'
            }}
        >
            <span ref={spanRef} style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'pre', fontSize: `${fontSize}px`, fontFamily: 'sans-serif' }}>{label.text || 'Label'}</span>
            <input
                value={label.text}
                onChange={(e) => onChange(label.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: `${fontSize}px`,
                    color: textColor,
                    textAlign: 'center',
                    width: `${inputWidth}px`,
                    minWidth: '30px'
                }}
            />
            {isActive && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(label.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '14px', height: '14px', borderRadius: '50%', background: '#ff4444', color: 'white', border: '1px solid #fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                >
                    ×
                </button>
            )}
        </div>
    );
};

// --- 主导出组件 ---
export const EdgeLabelList = memo(({
                                       labels, anchorX, anchorY, allPoints, selectedLabelId,
                                       onSelect, onChange, onDelete, onPositionChange
                                   }: EdgeLabelListProps) => {
    if (!labels || labels.length === 0) return null;

    return (
        <>
            {labels.map((label) => (
                <EdgeLabelRenderer key={label.id}>
                    <SmartLabel
                        label={label}
                        anchorX={anchorX}
                        anchorY={anchorY}
                        allPoints={allPoints}
                        isSelected={label.id === selectedLabelId}
                        onSelect={onSelect}
                        onChange={onChange}
                        onDelete={onDelete}
                        onPositionChange={onPositionChange}
                    />
                </EdgeLabelRenderer>
            ))}
        </>
    );
});