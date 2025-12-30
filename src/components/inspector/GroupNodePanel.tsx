// src/components/inspector/GroupNodePanel.tsx
import { useReactFlow, type Node } from 'reactflow';
import { ReadOnlyField, ControlInput, ColorPicker } from './CommonUI';
import { STYLES } from './constants';

// 🔥 引入具体的 GroupBlockData 类型
import type { TabId, GroupBlockData } from '../../types';

interface GroupNodePanelProps {
    // 🔥 修复: 指定 Node 的泛型数据类型
    node: Node<GroupBlockData>;
    activeTab: TabId;
    // 🔥 修复: 将 data: any 替换为 Record<string, unknown>
    onUpdateNode: (id: string, data: Record<string, unknown>) => void;
}

export const GroupNodePanel = ({ node, activeTab, onUpdateNode }: GroupNodePanelProps) => {
    const { setNodes } = useReactFlow();

    if (activeTab === 'EDIT') {
        return (
            <>
                <ReadOnlyField label="分组 ID" value={node.id} />
                <ControlInput
                    label="分组标题"
                    // 因为指定了泛型，这里的 .label 会有自动补全
                    value={node.data.label || ''}
                    onChange={(v: string) => onUpdateNode(node.id, { label: v })}
                />
            </>
        );
    }
    if (activeTab === 'STYLE') {
        return (
            <>
                <ColorPicker
                    label="背景颜色"
                    value={node.style?.backgroundColor}
                    onChange={(v: string) => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, backgroundColor: v } } : n))}
                />
                <div style={STYLES.row}>
                    <ControlInput
                        label="宽度"
                        value={node.style?.width || 400}
                        type="number"
                        // 🔥 修复: 将 v: any 改为 v: string，并增加 parse 安全处理
                        onChange={(v: string) => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, width: parseInt(v) || 400 } } : n))}
                    />
                </div>
            </>
        );
    }
    return null;
};