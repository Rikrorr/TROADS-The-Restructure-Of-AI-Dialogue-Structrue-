import React from 'react';
import { type ConnectionLineComponentProps, EdgeLabelRenderer } from 'reactflow';

export const CustomConnectionLine = ({
                                         fromX,
                                         fromY,
                                         toX,
                                         toY,
                                         connectionStatus
                                     }: ConnectionLineComponentProps) => {
    const straightPath = `M${fromX},${fromY} L${toX},${toY}`;
    const strokeColor = connectionStatus === 'valid' ? '#4CAF50' : '#b0b0b0';
    return (
        <g>
            <EdgeLabelRenderer>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5000, overflow: 'visible' }} className="nodrag nopan">
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
                        <path d={straightPath} fill="none" stroke={strokeColor} strokeWidth={2} strokeDasharray="5, 5" style={{ transition: 'stroke 0.2s' }} />
                        <circle cx={toX} cy={toY} r={4} fill={strokeColor} stroke="#fff" strokeWidth={1.5} />
                    </svg>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
};