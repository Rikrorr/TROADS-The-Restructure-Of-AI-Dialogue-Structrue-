// src/components/edges/EditableEdge/EditableEdge.tsx
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
    type EdgeProps,
    useReactFlow,
    useStore,
    type Node,
    type Edge,
    Position,
    type ReactFlowState
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { CustomEdgeData, EdgeLabelData } from '../../../types';
import {
    getCustomSmartPath,
    pointsToPath,
    getLabelPositionFromPoints,
    simplifyOrthogonalPoints,
    getDirectionVector
} from '../../../utils/customEdgeUtils';
import { PATH_OPTIONS } from '../../BaseEdgePath';

// 引入解耦后的组件
import { EdgeVisuals } from './EdgeVisuals';
import { EdgeLabelList } from './EdgeLabelList';

// =========================================================================
// 🔥 辅助 Hook: 获取上一次渲染的值
// =========================================================================
function usePrevious<T>(value: T): T | undefined {
    // 修复 TS2554: 提供初始值 undefined
    const ref = useRef<T | undefined>(undefined);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    // 修复 ESLint: usePrevious 模式需要读取 ref.current 来获取旧值，这是预期行为
    // eslint-disable-next-line react-hooks/refs
    return ref.current;
}

// =========================================================================
// 🔥 性能优化区：自定义比较函数
// =========================================================================

const groupNodesSelector = (s: ReactFlowState): Node[] => {
    return s.nodeInternals
        ? Array.from(s.nodeInternals.values()).filter((n) => n.type === 'groupNode')
        : [];
};

const groupGeometryEquality = (prev: Node[], next: Node[]) => {
    if (prev === next) return true;
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = next[i];
        if (
            a.id !== b.id ||
            a.position.x !== b.position.x ||
            a.position.y !== b.position.y ||
            a.width !== b.width ||
            a.height !== b.height ||
            a.style?.width !== b.style?.width ||
            a.style?.height !== b.style?.height
        ) {
            return false;
        }
    }
    return true;
};

const edgesSelector = (s: ReactFlowState): Edge[] => s.edges || [];

const edgesTopologyEquality = (prev: Edge[], next: Edge[]) => {
    if (prev === next) return true;
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = next[i];
        if (a.id !== b.id || a.source !== b.source || a.target !== b.target) {
            return false;
        }
    }
    return true;
};

// =========================================================================
// 组件主体
// =========================================================================
export const EditableEdge = ({
                                 id,
                                 sourceX, sourceY, sourcePosition,
                                 targetX, targetY, targetPosition,
                                 style, markerEnd, data, selected
                             }: EdgeProps<CustomEdgeData>) => {
    const { setEdges, setNodes, screenToFlowPosition, getViewport } = useReactFlow();

    const groupNodes = useStore(groupNodesSelector, groupGeometryEquality);
    const existingEdges = useStore(edgesSelector, edgesTopologyEquality);

    const onLabelSelect = data?.onLabelSelect;
    const selectedLabelId = data?.selectedLabelId;

    // 🔥 提前解构 data 中的属性，满足 React Compiler 依赖推断要求
    const waypoints = data?.waypoints;
    const controlPointOffset = data?.controlPointOffset;
    const labels = data?.labels || [];

    // 获取上一次的值
    const prevSourceX = usePrevious(sourceX);
    const prevSourceY = usePrevious(sourceY);
    const prevTargetX = usePrevious(targetX);
    const prevTargetY = usePrevious(targetY);
    const prevWaypoints = usePrevious(waypoints);

    const isManual = !!(waypoints && waypoints.length > 0);

    // 🔥 安全网：存储当前的事件监听器引用，以便组件卸载时清理
    const activeListenersRef = useRef<{ move: ((e: MouseEvent) => void) | null, up: ((e: MouseEvent) => void) | null }>({ move: null, up: null });

    // 🔥 在组件卸载时，强制移除残留的监听器，防止内存泄漏
    useEffect(() => {
        return () => {
            const { move, up } = activeListenersRef.current;
            if (move) window.removeEventListener('mousemove', move);
            if (up) window.removeEventListener('mouseup', up);
        };
    }, []);

    // =========================================================================
    // 1. 核心路径计算
    // =========================================================================
    const { pathString, labelX, labelY, allPoints } = useMemo(() => {
        if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY) || !Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            return { pathString: '', labelX: 0, labelY: 0, allPoints: [] };
        }

        let points: {x: number, y: number}[] = [];

        if (isManual && waypoints) {
            points = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

            // 使用 prev 变量进行比较
            const sx = prevSourceX ?? sourceX;
            const sy = prevSourceY ?? sourceY;
            const tx = prevTargetX ?? targetX;
            const ty = prevTargetY ?? targetY;
            const pwps = prevWaypoints ?? waypoints;

            // (保留原有的 Head/Tail Repair 逻辑，此处省略具体几何计算细节以保持简洁，逻辑与之前一致)
            const isNodeMove = (Math.abs(sourceX - sx) > 0.1 || Math.abs(sourceY - sy) > 0.1 || Math.abs(targetX - tx) > 0.1 || Math.abs(targetY - ty) > 0.1);
            const isEdgeDrag = (waypoints !== pwps);

            const REPAIR_THRESHOLD = 3;
            // Head Repair
            const p0 = points[0]; const p1 = points[1]; const p2 = points[2];
            if (p1) {
                const isHoriz = (sourcePosition === Position.Left || sourcePosition === Position.Right);
                const isHeadAligned = isHoriz ? Math.abs(p0.y - p1.y) < REPAIR_THRESHOLD : Math.abs(p0.x - p1.x) < REPAIR_THRESHOLD;
                if (!isHeadAligned) {
                    let slideSuccess = false;
                    const preferSlide = isNodeMove || !isEdgeDrag;
                    if (preferSlide && p2) {
                        const isP1P2Vert = Math.abs(p1.x - p2.x) < 1;
                        const isP1P2Horiz = Math.abs(p1.y - p2.y) < 1;
                        if (isHoriz && isP1P2Vert) { p1.y = p0.y; slideSuccess = true; } else if (!isHoriz && isP1P2Horiz) { p1.x = p0.x; slideSuccess = true; }
                    }
                    if (!slideSuccess) {
                        const sDir = getDirectionVector(sourcePosition);
                        const stub = { x: p0.x + sDir.x * 20, y: p0.y + sDir.y * 20 };
                        const bridge = isHoriz ? {x: stub.x, y: p1.y} : {x: p1.x, y: stub.y};
                        points.splice(1, 0, stub, bridge);
                    }
                }
            }
            // Tail Repair
            const lastIdx = points.length - 1;
            const pend = points[lastIdx]; const pn_1 = points[lastIdx-1]; const pn_2 = points[lastIdx-2];
            if (pn_1) {
                const isHoriz = (targetPosition === Position.Left || targetPosition === Position.Right);
                const isTailAligned = isHoriz ? Math.abs(pend.y - pn_1.y) < REPAIR_THRESHOLD : Math.abs(pend.x - pn_1.x) < REPAIR_THRESHOLD;
                if (!isTailAligned) {
                    let slideSuccess = false;
                    const preferSlide = isNodeMove || !isEdgeDrag;
                    if (preferSlide && pn_2) {
                        const isPrevSegVert = Math.abs(pn_1.x - pn_2.x) < 1;
                        const isPrevSegHoriz = Math.abs(pn_1.y - pn_2.y) < 1;
                        if (isHoriz && isPrevSegVert) { pn_1.y = pend.y; slideSuccess = true; } else if (!isHoriz && isPrevSegHoriz) { pn_1.x = pend.x; slideSuccess = true; }
                    }
                    if (!slideSuccess) {
                        const tDir = getDirectionVector(targetPosition || Position.Left);
                        const stub = { x: pend.x + tDir.x * 20, y: pend.y + tDir.y * 20 };
                        const bridge = isHoriz ? {x: stub.x, y: pn_1.y} : {x: pn_1.x, y: stub.y};
                        points.splice(lastIdx, 0, bridge, stub);
                    }
                }
            }
        } else {
            const currentOffset = Math.max(20, controlPointOffset?.x ?? PATH_OPTIONS.defaultOffset);
            const res = getCustomSmartPath({
                sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
                offset: currentOffset, avoidanceNodes: groupNodes, existingEdges: existingEdges, edgeId: id,
            });
            points = res[3];
        }

        const cleanPoints = simplifyOrthogonalPoints(points);
        const orthogonalizedPoints: {x:number, y:number}[] = [];
        if (cleanPoints.length > 0) orthogonalizedPoints.push(cleanPoints[0]);
        for (let i = 0; i < cleanPoints.length - 1; i++) {
            const curr = cleanPoints[i];
            const next = cleanPoints[i+1];
            const isVert = Math.abs(curr.x - next.x) < 1;
            const isHoriz = Math.abs(curr.y - next.y) < 1;
            if (!isVert && !isHoriz) {
                const corner = { x: next.x, y: curr.y };
                orthogonalizedPoints.push(corner);
            }
            orthogonalizedPoints.push(next);
        }
        const finalPoints = simplifyOrthogonalPoints(orthogonalizedPoints);

        const roundedPath = pointsToPath(finalPoints, 8);
        const [lx, ly] = getLabelPositionFromPoints(finalPoints);
        return { pathString: roundedPath, labelX: lx, labelY: ly, allPoints: finalPoints };
    }, [
        // 🔥 修复: 使用解构后的简单变量，解决 React Compiler 依赖警告
        isManual, waypoints, controlPointOffset,
        sourceX, sourceY, targetX, targetY,
        sourcePosition, targetPosition, groupNodes, existingEdges, id,
        prevSourceX, prevSourceY, prevTargetX, prevTargetY, prevWaypoints
    ]);

    // =========================================================================
    // 2. 交互回调函数
    // =========================================================================
    const handleSegmentMouseDown = (e: React.MouseEvent, index: number, orientation: 'horizontal' | 'vertical') => {
        e.stopPropagation(); e.preventDefault();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const { zoom } = getViewport();

        // 🔥 修复: 使用 const (splice 是原地修改，引用本身未变)
        const initialPoints = allPoints.map(p => ({ ...p }));

        const isFirstSegment = index === 0;
        const isLastSegment = index === initialPoints.length - 2;

        if (isFirstSegment) {
            const pStart = initialPoints[0]; const pEnd = initialPoints[1];
            initialPoints.splice(1, 0, { ...pStart }, { ...pEnd });
            index = 1;
        } else if (isLastSegment) {
            const pStart = initialPoints[index]; const pEnd = initialPoints[index + 1];
            initialPoints.splice(index + 1, 0, { ...pStart }, { ...pEnd });
            index = index + 1;
        } else if (initialPoints.length === 4) {
            const p1 = initialPoints[1]; const p2 = initialPoints[2];
            if (Math.abs(p1.x - p2.x) < 1 || Math.abs(p1.y - p2.y) < 1) {
                const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                initialPoints.splice(2, 0, {x: midX, y: midY}, {x: midX, y: midY});
                if (index === 1) index = 2;
            }
        }

        const indicesToMove = [index, index + 1];
        const PROP_THRESHOLD = 3;
        for (let i = index - 1; i > 0; i--) {
            const pCurrent = initialPoints[i]; const pNext = initialPoints[i+1];
            const isAligned = orientation === 'horizontal' ? Math.abs(pCurrent.y - pNext.y) < PROP_THRESHOLD : Math.abs(pCurrent.x - pNext.x) < PROP_THRESHOLD;
            if (isAligned) indicesToMove.push(i); else break;
        }
        for (let i = index + 2; i < initialPoints.length - 1; i++) {
            const pPrev = initialPoints[i-1]; const pCurrent = initialPoints[i];
            const isAligned = orientation === 'horizontal' ? Math.abs(pPrev.y - pCurrent.y) < PROP_THRESHOLD : Math.abs(pPrev.x - pCurrent.x) < PROP_THRESHOLD;
            if (isAligned) indicesToMove.push(i); else break;
        }

        const snapCandidates: number[] = [];
        snapCandidates.push(orientation === 'horizontal' ? sourceY : sourceX);
        snapCandidates.push(orientation === 'horizontal' ? targetY : targetX);
        for(let i = 0; i < initialPoints.length; i++) {
            if (indicesToMove.includes(i)) continue;
            const p = initialPoints[i];
            const val = orientation === 'horizontal' ? p.y : p.x;
            if (!snapCandidates.includes(val)) snapCandidates.push(val);
        }

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - startMouseX) / zoom;
            const dy = (moveEvent.clientY - startMouseY) / zoom;
            const isSnapDisabled = moveEvent.ctrlKey || moveEvent.metaKey;
            const SNAP_THRESHOLD_LOGICAL = isSnapDisabled ? 0 : (12 / zoom);

            setEdges((eds) => eds.map((edge) => {
                if (edge.id !== id) return edge;
                const nextPoints = initialPoints.map(p => ({ ...p }));

                if (orientation === 'horizontal') {
                    const baseVal = nextPoints[indicesToMove[0]].y;
                    let targetVal = baseVal + dy;
                    if (!isSnapDisabled) {
                        for (const cand of snapCandidates) if (Math.abs(targetVal - cand) < SNAP_THRESHOLD_LOGICAL) { targetVal = cand; break; }
                    }
                    const delta = targetVal - baseVal;
                    indicesToMove.forEach(idx => { nextPoints[idx].y += delta; });
                } else {
                    const baseVal = nextPoints[indicesToMove[0]].x;
                    let targetVal = baseVal + dx;
                    if (!isSnapDisabled) {
                        for (const cand of snapCandidates) if (Math.abs(targetVal - cand) < SNAP_THRESHOLD_LOGICAL) { targetVal = cand; break; }
                    }
                    const delta = targetVal - baseVal;
                    indicesToMove.forEach(idx => { nextPoints[idx].x += delta; });
                }
                nextPoints[0] = { x: sourceX, y: sourceY };
                nextPoints[nextPoints.length - 1] = { x: targetX, y: targetY };
                return { ...edge, data: { ...edge.data, waypoints: nextPoints.slice(1, -1), isManual: true } };
            }));
        };

        const onMouseUp = () => {
            // 🔥 清理：移除监听器并重置 ref
            if (activeListenersRef.current.move) window.removeEventListener('mousemove', activeListenersRef.current.move);
            if (activeListenersRef.current.up) window.removeEventListener('mouseup', activeListenersRef.current.up);
            activeListenersRef.current = { move: null, up: null };

            setEdges((eds) => eds.map((edge) => {
                if (edge.id !== id) return edge;
                const waypoints = edge.data?.waypoints || [];
                const full = [{x: sourceX, y: sourceY}, ...waypoints, {x: targetX, y: targetY}];
                const simple = simplifyOrthogonalPoints(full);
                return { ...edge, data: { ...edge.data, waypoints: simple.slice(1, -1) } };
            }));
        };

        // 🔥 注册：将监听器保存到 ref
        activeListenersRef.current = { move: onMouseMove, up: onMouseUp };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const updateLabelText = useCallback((lId: string, txt: string) => {
        setEdges(eds => eds.map(e => e.id===id ? {...e, data:{...e.data, labels:e.data.labels?.map((l: EdgeLabelData)=>l.id===lId?{...l,text:txt}:l)}} : e));
    }, [setEdges, id]);

    const deleteLabel = useCallback((lId: string) => {
        setEdges(eds => eds.map(e => e.id===id ? {...e, data:{...e.data, labels:e.data.labels?.filter((l: EdgeLabelData)=>l.id!==lId)}} : e));
    }, [setEdges, id]);

    const updateLabelPosition = useCallback((lId: string, absX: number, absY: number, isSnapped: boolean) => {
        setEdges(eds => eds.map(e => {
            if (e.id !== id) return e;
            const newLabels = e.data?.labels?.map((l: EdgeLabelData) => {
                if (l.id !== lId) return l;
                return {
                    ...l,
                    absoluteX: absX,
                    absoluteY: absY,
                    offsetX: absX - labelX,
                    offsetY: absY - labelY,
                    isSnapped: isSnapped
                };
            });
            return { ...e, data: { ...e.data, labels: newLabels } };
        }));
    }, [setEdges, id, labelX, labelY]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const newLabel: EdgeLabelData = {
            id: uuidv4(),
            text: '关系',
            offsetX: flowPos.x - labelX,
            offsetY: flowPos.y - labelY,
            absoluteX: flowPos.x,
            absoluteY: flowPos.y,
            isSnapped: false,
            style: { fontSize: 12, color: '#333', backgroundColor: '#fff', borderColor: '#4CAF50', borderWidth: 1 }
        };
        setEdges(eds => eds.map(edge => edge.id === id ? { ...edge, data: { ...edge.data, labels: [...(edge.data?.labels || []), newLabel] } } : edge));
        if (onLabelSelect) onLabelSelect(newLabel.id);
    }, [id, setEdges, screenToFlowPosition, labelX, labelY, onLabelSelect]);

    const handleEdgeClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setEdges(eds => eds.map(ed => ({ ...ed, selected: ed.id === id })));
        if (onLabelSelect) onLabelSelect(null);
    }, [id, setEdges, setNodes, onLabelSelect]);

    const handleLabelSelectWrapper = useCallback((lid: string) => {
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        if (onLabelSelect) onLabelSelect(lid);
    }, [setNodes, onLabelSelect]);

    if (!pathString || !allPoints || allPoints.length < 2) return null;

    return (
        <g>
            <EdgeVisuals
                pathString={pathString}
                allPoints={allPoints}
                style={style}
                markerEnd={markerEnd}
                selected={selected}
                isManual={isManual}
                onEdgeClick={handleEdgeClick}
                onEdgeDoubleClick={handleDoubleClick}
                onSegmentMouseDown={handleSegmentMouseDown}
            />
            <EdgeLabelList
                labels={labels}
                anchorX={labelX}
                anchorY={labelY}
                allPoints={allPoints}
                selectedLabelId={selectedLabelId}
                onSelect={handleLabelSelectWrapper}
                onChange={updateLabelText}
                onDelete={deleteLabel}
                onPositionChange={updateLabelPosition}
            />
        </g>
    );
};

export default EditableEdge;