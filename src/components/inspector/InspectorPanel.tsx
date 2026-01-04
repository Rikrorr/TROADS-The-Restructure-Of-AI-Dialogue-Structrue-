// src/components/inspector/InspectorPanel.tsx
import React, { memo, useState, useMemo, useRef } from 'react';
import {
    PlusCircle, Edit3, Palette, Trash2,
    Type, Settings, Layers, X,
    ZoomIn, ZoomOut, Maximize,
    AlignLeft, Plus, ChevronRight,
    List, ArrowLeft, type LucideIcon,
    Save, FolderOpen, Camera, FileCode, Sliders
} from 'lucide-react';
import {
    useReactFlow,
    useNodes,
    useEdges,
    type Node,
    type Edge
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';


import type {
    TabId,
    CustomEdgeData,
    EdgeLabelData,
    QABlockData,
    GroupBlockData,
    NodeCallbacks
} from '../../types';

import { useDataPersistence } from '../../hooks/useDataPersistence';

// -----------------------------------------------------------------------------
// 1. 样式常量 (建议：后续将此对象移回 constants.ts 统一管理)
// -----------------------------------------------------------------------------
const SIDEBAR_WIDTH = 60;

// 🔥 优化：将分散的内联样式集中管理，避免渲染时重复创建对象
const STYLES = {
    // 容器布局
    wrapper: { position: 'relative' as const, height: '100%', display: 'flex', backgroundColor: '#fff' },
    sidebar: { width: SIDEBAR_WIDTH, height: '100%', backgroundColor: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '16px 0', gap: '12px', pointerEvents: 'all' as const, zIndex: 20 },
    detailPanel: { position: 'absolute' as const, left: SIDEBAR_WIDTH, top: 0, bottom: 0, width: 300, backgroundColor: '#fff', boxShadow: '4px 0 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', pointerEvents: 'all' as const, borderRight: '1px solid #f0f0f0', zIndex: 10 },
    spacer: { flex: 1 },

    // 面板结构
    panelHeader: { padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '14px', fontWeight: 600, color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' },
    panelBody: { flex: 1, padding: '16px', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '16px' },

// 🔥 Bottom Controls: 底部控制区样式调整
    bottomControls: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px', // 稍微调小间距，因为按钮变多了
        paddingTop: '16px',
        paddingBottom: '16px',
        borderTop: '1px solid #f0f0f0',
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#f9fafb' // 底部稍微给点浅灰背景，区分功能区
    },


    // 原子组件样式
    formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', fontFamily: 'inherit' },
    textarea: { width: '100%', minHeight: 80, padding: '8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '13px', lineHeight: 1.5, resize: 'vertical' as const, outline: 'none', fontFamily: 'inherit' },
    select: { width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', backgroundColor: '#fff' },
    readOnlyText: { width: '100%', padding: '8px', borderRadius: 6, backgroundColor: '#f5f5f5', border: '1px solid #eee', fontSize: '11px', color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' as const, userSelect: 'all' as const },

    // 按钮
    iconBtn: (active: boolean, danger: boolean = false) => ({ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: danger ? '#ff4444' : (active ? '#2196F3' : '#555'), backgroundColor: active ? '#E3F2FD' : 'transparent', border: 'none', transition: 'all 0.2s' }),
    createBtn: { padding: '4px 8px', backgroundColor: '#E3F2FD', color: '#1976D2', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
    backBtn: { width: '100%', padding: '4px 8px', justifyContent:'center', backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#999' },

    // 通用布局
    row: { display: 'flex', gap: 10, alignItems: 'center' },
    rowGap8: { display: 'flex', gap: 8, alignItems: 'center' },
    divider: { height: 1, backgroundColor: '#eee', margin: '8px 0' },

    // 列表项
    sectionHeader: { fontSize: '12px', fontWeight: 'bold', color: '#333', marginTop: '16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '4px' },
    listContainer: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '8px', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px', backgroundColor: '#fafafa', minHeight: '100px', maxHeight: '300px' },
    emptyText: { textAlign: 'center' as const, color: '#999', fontSize: 12, padding: 10 },
    listItem: { padding: '10px', border: '1px solid #eee', borderRadius: 6, backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' as const, gap: 4 },
    listItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    listItemTitle: { fontSize: 13, fontWeight: 'bold', color: '#333' },
    listItemSubtitle: { fontSize: 10, color: '#999', fontFamily: 'monospace' },

    // Color Picker 特定
    colorInput: { width: 30, height: 30, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 },
    colorTextInput: { flex: 1 }, // 将合并到 input 样式

    separator: { width: '40%', height: 1, backgroundColor: '#d1d5db', margin: '4px 0' } // 分割线加深一点颜色
};

// -----------------------------------------------------------------------------
// 2. 通用组件
// -----------------------------------------------------------------------------

interface IconButtonProps {
    icon: LucideIcon;
    active?: boolean;
    danger?: boolean;
    onClick: () => void;
    title: string;
}
const IconButton = ({ icon: Icon, active = false, danger = false, onClick, title }: IconButtonProps) => (
    <button style={STYLES.iconBtn(active, danger)} onClick={onClick} title={title}>
        <Icon size={20} strokeWidth={2} />
    </button>
);

interface ReadOnlyFieldProps {
    label: string;
    value: string | number;
}
const ReadOnlyField = ({ label, value }: ReadOnlyFieldProps) => (
    <div style={STYLES.formGroup}>
        <div style={STYLES.label}>{label}</div>
        <div style={STYLES.readOnlyText}>{value}</div>
    </div>
);

interface ControlInputProps {
    label: string;
    value?: string | number;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    rows?: boolean;
}
const ControlInput = ({ label, value, onChange, type = "text", placeholder = "", rows }: ControlInputProps) => (
    <div style={STYLES.formGroup}>
        <div style={STYLES.label}>{label}</div>
        {rows ? (
            <textarea style={STYLES.textarea} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        ) : (
            <input type={type} style={STYLES.input} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        )}
    </div>
);

interface ColorPickerProps {
    label: string;
    value?: string;
    onChange: (value: string) => void;
}
const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
    const [localValue, setLocalValue] = useState(value || '#ffffff');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChange = (newVal: string) => {
        setLocalValue(newVal);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(newVal);
        }, 100);
    };

    return (
        <div style={STYLES.formGroup}>
            <div style={STYLES.label}>{label}</div>
            <div style={STYLES.rowGap8}>
                <input
                    type="color"
                    value={localValue}
                    onChange={e => handleChange(e.target.value)}
                    style={STYLES.colorInput}
                />
                <input
                    type="text"
                    value={localValue}
                    onChange={e => handleChange(e.target.value)}
                    style={{ ...STYLES.input, ...STYLES.colorTextInput }}
                    placeholder="#RRGGBB"
                />
            </div>
        </div>
    );
};


// =============================================================================
// 🔥 新增：API 设置弹窗组件 (定义在 InspectorPanel 内部)
// =============================================================================
// 定义预设配置
const PRESETS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo'
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat'
    },
    moonshot: {
        name: 'Moonshot (Kimi)',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k'
    },
    ollama: {
        name: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3'
    },
    lmstudio: {
        name: 'LM Studio (Local)',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model'
    }
};

type ProviderKey = keyof typeof PRESETS | 'custom';

const ApiSettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    // 读取保存的值
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('troads_api_key') || '');
    const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('troads_base_url') || PRESETS.openai.baseUrl);
    const [model, setModel] = useState(() => localStorage.getItem('troads_model') || PRESETS.openai.model);

    // UI 状态：模式 ('cloud' | 'local')
    const [mode, setMode] = useState<'cloud' | 'local'>(() => {
        const url = localStorage.getItem('troads_base_url') || '';
        return url.includes('localhost') || url.includes('127.0.0.1') ? 'local' : 'cloud';
    });

    // UI 状态：当前选中的厂商
    const [provider, setProvider] = useState<ProviderKey>('custom');

    // 切换厂商时的联动逻辑
    const handleProviderChange = (newProvider: ProviderKey) => {
        setProvider(newProvider);
        if (newProvider !== 'custom') {
            const preset = PRESETS[newProvider as keyof typeof PRESETS];
            setBaseUrl(preset.baseUrl);
            setModel(preset.model);
        }
    };

    // 切换模式时的默认值重置
    const handleModeChange = (newMode: 'cloud' | 'local') => {
        setMode(newMode);
        setProvider('custom'); // 切换模式后重置为自定义，防止逻辑冲突
        if (newMode === 'local') {
            setBaseUrl(PRESETS.ollama.baseUrl);
            setModel(PRESETS.ollama.model);
        } else {
            setBaseUrl(PRESETS.openai.baseUrl);
            setModel(PRESETS.openai.model);
        }
    };

    const handleSave = () => {
        localStorage.setItem('troads_api_key', apiKey);
        localStorage.setItem('troads_base_url', baseUrl);
        localStorage.setItem('troads_model', model);
        alert(`设置已保存！\n当前模式: ${mode === 'local' ? '🏠 本地部署' : '☁️ 云端 API'}`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'white', padding: '24px', borderRadius: '12px',
                width: '420px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1f2937', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={20} /> LLM 连接设置
                </h3>

                {/* 1. 顶部切换卡 (Toggle) */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px', marginBottom: '20px' }}>
                    <button
                        onClick={() => handleModeChange('cloud')}
                        style={{
                            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                            backgroundColor: mode === 'cloud' ? '#fff' : 'transparent',
                            color: mode === 'cloud' ? '#2563eb' : '#6b7280',
                            boxShadow: mode === 'cloud' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        ☁️ 云端 API
                    </button>
                    <button
                        onClick={() => handleModeChange('local')}
                        style={{
                            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                            backgroundColor: mode === 'local' ? '#fff' : 'transparent',
                            color: mode === 'local' ? '#10b981' : '#6b7280',
                            boxShadow: mode === 'local' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        🏠 本地部署
                    </button>
                </div>

                {/* 2. 厂商预设 (仅在云端模式或本地模式显示对应的) */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={STYLES.label}>快速预设</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {mode === 'cloud' ? (
                            <>
                                <button style={provider === 'openai' ? activeChipStyle : chipStyle} onClick={() => handleProviderChange('openai')}>OpenAI</button>
                                <button style={provider === 'deepseek' ? activeChipStyle : chipStyle} onClick={() => handleProviderChange('deepseek')}>DeepSeek</button>
                                <button style={provider === 'moonshot' ? activeChipStyle : chipStyle} onClick={() => handleProviderChange('moonshot')}>Kimi</button>
                            </>
                        ) : (
                            <>
                                <button style={provider === 'ollama' ? activeChipStyle : chipStyle} onClick={() => handleProviderChange('ollama')}>Ollama</button>
                                <button style={provider === 'lmstudio' ? activeChipStyle : chipStyle} onClick={() => handleProviderChange('lmstudio')}>LM Studio</button>
                            </>
                        )}
                        <button style={provider === 'custom' ? activeChipStyle : chipStyle} onClick={() => setProvider('custom')}>自定义</button>
                    </div>
                </div>

                {/* 3. API Key (仅云端需要，本地选填) */}
                {mode === 'cloud' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={STYLES.label}>API Key <span style={{color:'red'}}>*</span></label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setProvider('custom'); }}
                            placeholder="sk-..."
                            style={STYLES.input}
                        />
                    </div>
                )}

                {/* 4. Base URL */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={STYLES.label}>Base URL (接口地址)</label>
                    <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => { setBaseUrl(e.target.value); setProvider('custom'); }}
                        placeholder="https://..."
                        style={STYLES.input}
                    />
                    {mode === 'local' && <div style={{fontSize: '11px', color: '#6b7280', marginTop: '4px'}}>💡 提示: 确保本地服务已允许跨域 (CORS)</div>}
                </div>

                {/* 5. Model Name */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={STYLES.label}>模型名称 (Model ID)</label>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => { setModel(e.target.value); setProvider('custom'); }}
                        placeholder={mode === 'local' ? "例如: llama3, qwen2" : "例如: gpt-4o, deepseek-chat"}
                        style={STYLES.input}
                    />
                </div>

                {/* 底部按钮 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', color: '#374151' }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        style={{ padding: '8px 16px', background: mode === 'local' ? '#10b981' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                    >
                        保存并生效
                    </button>
                </div>
            </div>
        </div>
    );
};

// 辅助样式
const chipStyle: React.CSSProperties = {
    padding: '4px 10px', borderRadius: '16px', border: '1px solid #e5e7eb',
    backgroundColor: '#fff', fontSize: '12px', cursor: 'pointer', color: '#4b5563'
};
const activeChipStyle: React.CSSProperties = {
    ...chipStyle,
    borderColor: '#2563eb', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 600
};


// -----------------------------------------------------------------------------
// 3. 主面板组件
// -----------------------------------------------------------------------------

interface InspectorPanelProps {
    selectedNode: Node | null;
    selectedEdge: Edge | null;
    selectedLabelId: string | null;
    onCreate: () => void;
    onDelete: () => void;
    onUpdateNode: (id: string, data: Record<string, unknown>) => void;

    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    onLayout?: () => void;

    nodeCallbacks?: NodeCallbacks;
}

export const InspectorPanel = memo(({ selectedNode: propSelectedNode, selectedEdge: propSelectedEdge, selectedLabelId, onCreate, onUpdateNode, onDelete,setNodes, setEdges,onLayout, nodeCallbacks }: InspectorPanelProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const nodes = useNodes();
    const edges = useEdges();

    const { exportToJson, importFromJson, exportToImage, importFromGeminiHtml } = useDataPersistence(setNodes, setEdges, onLayout, nodeCallbacks);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // 隐藏的文件上传 input ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const htmlInputRef = useRef<HTMLInputElement>(null);

    const activeNode = useMemo(() => nodes.find(n => n.id === propSelectedNode?.id) || null, [nodes, propSelectedNode]);

    // Edge 泛型断言
    const activeEdge = useMemo(() =>
            edges.find(e => e.id === propSelectedEdge?.id) as Edge<CustomEdgeData> | undefined || null
        , [edges, propSelectedEdge]);

    const [activeTab, setActiveTab] = useState<TabId | null>(null);
    const shouldBackToListRef = useRef(false);

    const isEdgeSelected = !!activeEdge && !selectedLabelId;
    const isLabelSelected = !!activeEdge && !!selectedLabelId;

    const toggleTab = (tab: TabId) => {
        setActiveTab(activeTab === tab ? null : tab);
    };

    const preventPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleDeleteWrapper = () => {
        onDelete();
        setActiveTab(null);
    };

    const handleDeleteLabel = () => {
        if (isLabelSelected && activeEdge) {
            setEdges(eds => eds.map(e => {
                if(e.id !== activeEdge.id) return e;
                return {
                    ...e,
                    data: {
                        ...e.data,
                        selectedLabelId: null,
                        labels: e.data.labels?.filter((l: EdgeLabelData) => l.id !== selectedLabelId)
                    }
                }
            }));
            shouldBackToListRef.current = true;
            setActiveTab('LABEL_LIST');
        }
    }

    const handleCreateLabel = () => {
        if (!activeEdge) return;
        const newLabelId = uuidv4();
        const newLabel: EdgeLabelData = {
            id: newLabelId, text: '新关系', offsetX: 0, offsetY: 0,
            style: { fontSize: 12, color: '#333', backgroundColor: '#fff', borderColor: '#4CAF50', borderWidth: 1 }
        };
        setEdges(eds => eds.map(e => e.id === activeEdge.id ? {
            ...e, data: { ...e.data, labels: [...(e.data?.labels || []), newLabel] }
        } : e));
    };

    const selectLabel = (lId: string | null) => {
        activeEdge?.data?.onLabelSelect?.(lId);
    };

    const handleBackToList = () => {
        shouldBackToListRef.current = true;
        selectLabel(null);
    };

    const renderDetailContent = () => {
        if (!activeTab) return null;
        let title = '';
        let content = null;

        if (activeNode && activeNode.type === 'chatNode') {
            const data = activeNode.data as QABlockData;

            if (activeTab === 'EDIT') {
                title = '编辑问答内容';
                content = (
                    <>
                        <ReadOnlyField label="节点 ID" value={activeNode.id} />
                        <ControlInput label="问题 / Prompt" value={data.question} onChange={(v: string) => onUpdateNode(activeNode.id, { question: v })} rows={true} />
                        <div style={STYLES.divider} />
                        {data.answer && <ControlInput label="AI 回答缓存" value={data.answer} onChange={(v: string) => onUpdateNode(activeNode.id, { answer: v })} rows={true} />}
                    </>
                );
            } else if (activeTab === 'STYLE') {
                title = '节点样式';
                content = <ColorPicker key={activeNode.id} label="背景颜色" value={activeNode.style?.backgroundColor} onChange={(v: string) => setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, style: { ...n.style, backgroundColor: v } } : n))} />;
            }
        } else if (activeNode && activeNode.type === 'groupNode') {
            const data = activeNode.data as GroupBlockData;

            if (activeTab === 'EDIT') {
                title = '编辑分组';
                content = (
                    <>
                        <ReadOnlyField label="分组 ID" value={activeNode.id} />
                        <ControlInput label="分组标题" value={data.label || ''} onChange={(v: string) => onUpdateNode(activeNode.id, { label: v })} />
                    </>
                );
            } else if (activeTab === 'STYLE') {
                title = '分组样式';
                content = (
                    <>
                        <ColorPicker key={activeNode.id} label="背景颜色" value={activeNode.style?.backgroundColor} onChange={(v: string) => setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, style: { ...n.style, backgroundColor: v } } : n))} />
                        <div style={STYLES.row}><ControlInput label="宽度" value={activeNode.style?.width || 400} type="number" onChange={(v: string) => setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, style: { ...n.style, width: parseInt(v) } } : n))} /></div>
                    </>
                );
            }
        } else if (isEdgeSelected && activeEdge && activeTab === 'STYLE') {
            title = '线段样式';
            content = (
                <>
                    <ColorPicker
                        key={activeEdge.id}
                        label="线条颜色"
                        value={activeEdge.style?.stroke || '#B0BEC5'}
                        onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, style: { ...e.style, stroke: v } } : e))}
                    />
                    <div style={STYLES.row}>
                        <ControlInput
                            label="线宽 (px)"
                            type="number"
                            value={activeEdge.style?.strokeWidth || 2}
                            onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, style: { ...e.style, strokeWidth: parseInt(v) || 2 } } : e))}
                        />
                        <div style={{...STYLES.formGroup, flex: 1}}>
                            <div style={STYLES.label}>线型</div>
                            <select
                                style={STYLES.select}
                                value={activeEdge.style?.strokeDasharray ? 'dashed' : 'solid'}
                                onChange={(e) => setEdges(eds => eds.map(ed => ed.id === activeEdge.id ? {
                                    ...ed,
                                    style: {
                                        ...ed.style,
                                        strokeDasharray: e.target.value === 'dashed' ? '5,5' : undefined
                                    }
                                } : ed))}
                            >
                                <option value="solid">实线</option>
                                <option value="dashed">虚线</option>
                            </select>
                        </div>
                    </div>
                </>
            );
        } else if (isEdgeSelected && activeEdge && activeTab === 'LABEL_LIST') {
            const labels = activeEdge.data?.labels || [];
            title = '字段管理';
            content = (
                <>
                    <div style={STYLES.sectionHeader}>
                        <span>字段列表 ({labels.length})</span>
                        <button style={STYLES.createBtn} onClick={handleCreateLabel}><Plus size={12}/> 新建</button>
                    </div>
                    <div style={STYLES.listContainer}>
                        {labels.length === 0 && <div style={STYLES.emptyText}>暂无字段，点击上方按钮添加</div>}
                        {labels.map((lbl: EdgeLabelData) => (
                            <div key={lbl.id} style={STYLES.listItem} onClick={(e) => { e.stopPropagation(); selectLabel(lbl.id); }}>
                                <div style={STYLES.listItemHeader}>
                                    <span style={STYLES.listItemTitle}>{lbl.text || '未命名'}</span>
                                    <ChevronRight size={14} color="#ccc"/>
                                </div>
                                <div style={STYLES.listItemSubtitle}>ID: {lbl.id.slice(0, 6)}...</div>
                            </div>
                        ))}
                    </div>
                </>
            );
        } else if (isLabelSelected && activeEdge) {
            const currentLabel = activeEdge.data?.labels?.find((l: EdgeLabelData) => l.id === selectedLabelId);
            if (currentLabel) {
                if (activeTab === 'EDIT') {
                    title = '编辑字段';
                    content = (
                        <>
                            <ControlInput label="标签文本" value={currentLabel.text} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, text: v } : l) } } : e))} />
                            <div style={STYLES.divider}/>
                            <button style={STYLES.backBtn} onClick={handleBackToList}>
                                <ArrowLeft size={12}/> 返回字段列表
                            </button>
                        </>
                    );
                } else if (activeTab === 'STYLE') {
                    title = '字段外观';
                    content = (
                        <>
                            <div style={STYLES.row}>
                                <ControlInput label="大小" type="number" value={currentLabel.style?.fontSize || 12} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, style: {...l.style, fontSize: parseInt(v) || 12} } : l) } } : e))} />
                                <ColorPicker key={`${selectedLabelId}-color`} label="文字颜色" value={currentLabel.style?.color || '#333333'} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, style: {...l.style, color: v} } : l) } } : e))} />
                            </div>
                            <div style={STYLES.divider} />
                            <ColorPicker key={`${selectedLabelId}-bg`} label="背景颜色" value={currentLabel.style?.backgroundColor || '#ffffff'} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, style: {...l.style, backgroundColor: v} } : l) } } : e))} />
                            <div style={STYLES.row}>
                                <ColorPicker key={`${selectedLabelId}-border`} label="边框颜色" value={currentLabel.style?.borderColor || '#4CAF50'} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, style: {...l.style, borderColor: v} } : l) } } : e))} />
                                <ControlInput label="边框粗细" type="number" value={currentLabel.style?.borderWidth || 1} onChange={(v: string) => setEdges(eds => eds.map(e => e.id === activeEdge.id ? { ...e, data: { ...e.data, labels: e.data.labels?.map((l: EdgeLabelData) => l.id === selectedLabelId ? { ...l, style: {...l.style, borderWidth: parseInt(v) || 1} } : l) } } : e))} />
                            </div>
                        </>
                    );
                }
            }
        }

        if (!content) return null;
        return (
            <div style={STYLES.detailPanel} onClick={preventPropagation}>
                <div style={STYLES.panelHeader}>
                    {title}
                    <button style={STYLES.closeBtn} onClick={() => setActiveTab(null)}>
                        <X size={16} />
                    </button>
                </div>
                <div style={STYLES.panelBody}>{content}</div>
            </div>
        );
    };

    return (
        <div style={STYLES.wrapper}>
            <div style={STYLES.sidebar} onClick={preventPropagation}>
                {!activeNode && !activeEdge && <IconButton icon={PlusCircle} title="新建话题" onClick={onCreate} />}

                {activeNode && activeNode.type === 'chatNode' && (
                    <>
                        <IconButton icon={Edit3} active={activeTab === 'EDIT'} onClick={() => toggleTab('EDIT')} title="编辑内容" />
                        <IconButton icon={Palette} active={activeTab === 'STYLE'} onClick={() => toggleTab('STYLE')} title="样式" />
                        <div style={{height: 10}} />
                        <IconButton icon={Trash2} danger onClick={handleDeleteWrapper} title="删除节点" />
                    </>
                )}

                {activeNode && activeNode.type === 'groupNode' && (
                    <>
                        <IconButton icon={Type} active={activeTab === 'EDIT'} onClick={() => toggleTab('EDIT')} title="编辑标题" />
                        <IconButton icon={Layers} active={activeTab === 'STYLE'} onClick={() => toggleTab('STYLE')} title="分组样式" />
                        <div style={{height: 10}} />
                        <IconButton icon={Trash2} danger onClick={handleDeleteWrapper} title="删除分组" />
                    </>
                )}

                {isEdgeSelected && (
                    <>
                        <IconButton icon={Sliders} active={activeTab === 'STYLE'} onClick={() => toggleTab('STYLE')} title="线段样式" />
                        <IconButton icon={List} active={activeTab === 'LABEL_LIST'} onClick={() => toggleTab('LABEL_LIST')} title="字段管理" />
                        <div style={{height: 10}} />
                        <IconButton icon={Trash2} danger onClick={handleDeleteWrapper} title="删除连线" />
                    </>
                )}

                {isLabelSelected && (
                    <>
                        <IconButton icon={AlignLeft} active={activeTab === 'EDIT'} onClick={() => toggleTab('EDIT')} title="编辑文本" />
                        <IconButton icon={Palette} active={activeTab === 'STYLE'} onClick={() => toggleTab('STYLE')} title="字段样式" />
                        <div style={{height: 10}} />
                        <IconButton icon={Trash2} danger onClick={handleDeleteLabel} title="删除字段" />
                    </>
                )}

                {/* 2. 占位符：把下面的推到底部 */}
                <div style={STYLES.spacer} />

                {/* 3. 🔥 统一底部控制区 (视图控制 + 项目管理) */}
                <div style={STYLES.bottomControls}>
                    {/* 视图缩放 */}
                    <IconButton icon={ZoomIn} onClick={() => zoomIn()} title="放大" />
                    <IconButton icon={Maximize} onClick={() => fitView()} title="适应屏幕" />
                    <IconButton icon={ZoomOut} onClick={() => zoomOut()} title="缩小" />

                    {/* 分割线 */}
                    <div style={STYLES.separator} />

                    {/* 项目管理 */}
                    <IconButton icon={Save} onClick={exportToJson} title="保存项目 (JSON)" />

                    <IconButton icon={FolderOpen} onClick={() => fileInputRef.current?.click()} title="读取项目 (JSON)" />
                    <input type="file" ref={fileInputRef} onChange={importFromJson} style={{ display: 'none' }} accept=".json" />

                    {/* 🔥 也不要忘了我们刚做的 Gemini 导入功能 */}
                    <IconButton icon={FileCode} onClick={() => htmlInputRef.current?.click()} title="导入 Gemini (HTML)" />
                    <input type="file" ref={htmlInputRef} onChange={importFromGeminiHtml} style={{ display: 'none' }} accept=".html,.htm" />

                    <IconButton icon={Camera} onClick={exportToImage} title="导出图片 (PNG)" />

                    <div style={STYLES.separator} />
                    <IconButton icon={Settings} onClick={() => setIsSettingsOpen(true)} title="LLM API 设置" />
                </div>
            </div>

            {renderDetailContent()}
            <ApiSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
});