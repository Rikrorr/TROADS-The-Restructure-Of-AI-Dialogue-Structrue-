import React from 'react';
import { BaseEdge } from 'reactflow';

// 全局配置
export const PATH_OPTIONS = {
    defaultOffset: 30, // 默认拖拽距离
};

interface BaseEdgePathProps {
    path: string;
    style?: React.CSSProperties;
    markerEnd?: string;
    selected?: boolean;
}

export const BaseEdgePath = ({ path, style, markerEnd, selected }: BaseEdgePathProps) => {
    return (
        <BaseEdge
            path={path}
            markerEnd={markerEnd}
            style={{
                // 1. 设置默认的基础样式
                strokeWidth: 2,
                stroke: '#B0BEC5',

                // 2. 如果没有任何外部 style 传入，可以在这里处理 selected 的默认表现
                // 但为了让 EdgeVisuals 全权控制，建议把 ...style 放在最后

                // 3. 🔥 核心修复：将 ...style 放在最后 🔥
                // 这样 EdgeVisuals 计算好的颜色(stroke)和线型(strokeDasharray)才能生效
                ...style,

                // 4. 强制性的布局样式 (保持不变)
                fill: 'none',
                strokeLinejoin: 'round',
                strokeLinecap: 'round',
            }}
        />
    );
};