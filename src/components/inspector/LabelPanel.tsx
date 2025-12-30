// src/components/inspector/LabelPanel.tsx
import { useReactFlow, type Edge } from 'reactflow';
import { ArrowLeft } from 'lucide-react';
import { ControlInput, ColorPicker } from './CommonUI';
import { STYLES } from './constants';
// 🔥 修复: 引入具体类型
import type { TabId, CustomEdgeData, EdgeLabelData } from '../../types';

interface LabelPanelProps {
    // 🔥 修复: 指定 Edge 的泛型
    edge: Edge<CustomEdgeData>;
    labelId: string;
    activeTab: TabId;
    handleBackToList: () => void;
}

export const LabelPanel = ({ edge, labelId, activeTab, handleBackToList }: LabelPanelProps) => {
    const { setEdges } = useReactFlow();

    // 🔥 修复: 使用 EdgeLabelData 类型
    const currentLabel = edge.data?.labels?.find((l: EdgeLabelData) => l.id === labelId);

    if (!currentLabel) return null;

    if (activeTab === 'EDIT') {
        return (
            <>
                <ControlInput
                    label="标签文本"
                    value={currentLabel.text}
                    onChange={(v: string) => setEdges(eds => eds.map(e => {
                        if (e.id !== edge.id) return e;
                        return {
                            ...e,
                            data: {
                                ...e.data,
                                // 🔥 修复: 显式类型 EdgeLabelData
                                labels: e.data.labels?.map((l: EdgeLabelData) =>
                                    l.id === labelId ? { ...l, text: v } : l
                                )
                            }
                        };
                    }))}
                />
                <div style={STYLES.divider} />
                <button
                    style={{ ...STYLES.createBtn, width: '100%', justifyContent: 'center', backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #ddd' }}
                    onClick={handleBackToList}
                >
                    <ArrowLeft size={12} /> 返回字段列表
                </button>
            </>
        );
    }

    if (activeTab === 'STYLE') {
        return (
            <>
                <div style={STYLES.row}>
                    <ControlInput
                        label="大小"
                        type="number"
                        value={currentLabel.style?.fontSize || 12}
                        onChange={(v: string) => setEdges(eds => eds.map(e => {
                            if (e.id !== edge.id) return e;
                            return {
                                ...e,
                                data: {
                                    ...e.data,
                                    labels: e.data.labels?.map((l: EdgeLabelData) =>
                                        l.id === labelId ? { ...l, style: { ...l.style, fontSize: parseInt(v) || 12 } } : l
                                    )
                                }
                            };
                        }))}
                    />
                    <ColorPicker
                        label="文字颜色"
                        value={currentLabel.style?.color || '#333333'}
                        onChange={(v: string) => setEdges(eds => eds.map(e => {
                            if (e.id !== edge.id) return e;
                            return {
                                ...e,
                                data: {
                                    ...e.data,
                                    labels: e.data.labels?.map((l: EdgeLabelData) =>
                                        l.id === labelId ? { ...l, style: { ...l.style, color: v } } : l
                                    )
                                }
                            };
                        }))}
                    />
                </div>
                <div style={STYLES.divider} />
                <ColorPicker
                    label="背景颜色"
                    value={currentLabel.style?.backgroundColor || '#ffffff'}
                    onChange={(v: string) => setEdges(eds => eds.map(e => {
                        if (e.id !== edge.id) return e;
                        return {
                            ...e,
                            data: {
                                ...e.data,
                                labels: e.data.labels?.map((l: EdgeLabelData) =>
                                    l.id === labelId ? { ...l, style: { ...l.style, backgroundColor: v } } : l
                                )
                            }
                        };
                    }))}
                />
                <div style={STYLES.row}>
                    <ColorPicker
                        label="边框颜色"
                        value={currentLabel.style?.borderColor || '#4CAF50'}
                        onChange={(v: string) => setEdges(eds => eds.map(e => {
                            if (e.id !== edge.id) return e;
                            return {
                                ...e,
                                data: {
                                    ...e.data,
                                    labels: e.data.labels?.map((l: EdgeLabelData) =>
                                        l.id === labelId ? { ...l, style: { ...l.style, borderColor: v } } : l
                                    )
                                }
                            };
                        }))}
                    />
                    <ControlInput
                        label="边框粗细"
                        type="number"
                        value={currentLabel.style?.borderWidth || 1}
                        onChange={(v: string) => setEdges(eds => eds.map(e => {
                            if (e.id !== edge.id) return e;
                            return {
                                ...e,
                                data: {
                                    ...e.data,
                                    labels: e.data.labels?.map((l: EdgeLabelData) =>
                                        l.id === labelId ? { ...l, style: { ...l.style, borderWidth: parseInt(v) || 1 } } : l
                                    )
                                }
                            };
                        }))}
                    />
                </div>
            </>
        );
    }
    return null;
};