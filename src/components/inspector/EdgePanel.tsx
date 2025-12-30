// src/components/inspector/EdgePanel.tsx
import { useReactFlow, type Edge } from 'reactflow';
import { Plus, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// 🔥 修复 1: UI 组件来自 CommonUI
import { ControlInput, ColorPicker } from './CommonUI';
// 🔥 修复 2: 样式常量来自 constants (之前拆分出来的文件)
import { STYLES, EXTRA_STYLES } from './constants';

// 🔥 修复 3: 引入 EdgeLabelData 以解决 any 报错
import type { TabId, EdgeLabelData } from '../../types';

interface EdgePanelProps {
    edge: Edge;
    activeTab: TabId;
    selectLabel: (id: string) => void;
}

export const EdgePanel = ({ edge, activeTab, selectLabel }: EdgePanelProps) => {
    const { setEdges } = useReactFlow();

    const handleCreateLabel = () => {
        // 创建新标签数据
        const newLabel: EdgeLabelData = {
            id: uuidv4(),
            text: '新关系',
            offsetX: 0,
            offsetY: 0,
            style: { fontSize: 12, color: '#333', backgroundColor: '#fff', borderColor: '#4CAF50', borderWidth: 1 }
        };

        setEdges(eds => eds.map(e => e.id === edge.id ? {
            ...e,
            data: { ...e.data, labels: [...(e.data?.labels || []), newLabel] }
        } : e));
    };

    if (activeTab === 'STYLE') {
        return (
            <>
                <ColorPicker label="线条颜色" value={edge.style?.stroke || '#B0BEC5'} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === edge.id ? { ...e, style: { ...e.style, stroke: v } } : e))} />
                <div style={STYLES.row}>
                    <ControlInput label="线宽 (px)" type="number" value={edge.style?.strokeWidth || 2} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === edge.id ? { ...e, style: { ...e.style, strokeWidth: parseInt(v) || 2 } } : e))} />
                    <div style={STYLES.formGroup}>
                        <div style={STYLES.label}>线型</div>
                        <select style={STYLES.input} value={edge.style?.strokeDasharray ? 'dashed' : 'solid'} onChange={(e) => setEdges(eds => eds.map(ed => ed.id === edge.id ? { ...ed, style: { ...ed.style, strokeDasharray: e.target.value === 'dashed' ? '5,5' : undefined } } : ed))}>
                            <option value="solid">实线</option>
                            <option value="dashed">虚线</option>
                        </select>
                    </div>
                </div>
            </>
        );
    }

    if (activeTab === 'LABEL_LIST') {
        const labels = (edge.data?.labels || []) as EdgeLabelData[];
        return (
            <>
                <div style={EXTRA_STYLES.sectionTitle}>
                    <span>字段列表 ({labels.length})</span>
                    <button style={STYLES.createBtn} onClick={handleCreateLabel}><Plus size={12} /> 新建</button>
                </div>
                <div style={EXTRA_STYLES.scrollArea}>
                    {labels.length === 0 && <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: 10 }}>暂无字段</div>}
                    {/* 🔥 修复 4: 这里将 any 替换为 EdgeLabelData */}
                    {labels.map((lbl: EdgeLabelData) => (
                        <div key={lbl.id} style={STYLES.listItem} onClick={(e) => { e.stopPropagation(); selectLabel(lbl.id); }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>{lbl.text || '未命名'}</span>
                                <ChevronRight size={14} color="#ccc" />
                            </div>
                            <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>ID: {lbl.id.slice(0, 6)}...</div>
                        </div>
                    ))}
                </div>
            </>
        );
    }
    return null;
};