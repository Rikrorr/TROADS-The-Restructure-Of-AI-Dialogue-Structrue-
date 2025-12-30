import React from 'react';
import { useReactFlow, type Node } from 'reactflow';
import { ReadOnlyField, ControlInput, ColorPicker } from './CommonUI'; // 路径变更
import { STYLES } from './constants.ts'; // 路径变更
import type { TabId } from '../../types.ts'; // 路径变更

interface ChatNodePanelProps {
    node: Node;
    activeTab: TabId;
    onUpdateNode: (id: string, data: Record<string, unknown>) => void; // 修复 any
}

export const ChatNodePanel = ({ node, activeTab, onUpdateNode }: ChatNodePanelProps) => {
    const { setNodes } = useReactFlow();

    if (activeTab === 'EDIT') {
        return (
            <>
                <ReadOnlyField label="节点 ID" value={node.id} />
                <ControlInput label="问题 / Prompt" value={node.data.question as string} onChange={(v) => onUpdateNode(node.id, { question: v })} rows={true} />
                <div style={STYLES.divider} />
                {node.data.answer && <ControlInput label="AI 回答缓存" value={node.data.answer as string} onChange={(v) => onUpdateNode(node.id, { answer: v })} rows={true} />}
            </>
        );
    }
    // ... STYLE 部分保持逻辑不变，引用 STYLES 和 ColorPicker 即可
    if (activeTab === 'STYLE') {
        return (
            <ColorPicker label="背景颜色" value={node.style?.backgroundColor} onChange={(v) => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, backgroundColor: v } } : n))} />
        );
    }
    return null;
};