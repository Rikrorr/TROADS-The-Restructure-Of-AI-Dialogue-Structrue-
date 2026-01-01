import { memo, useState, useMemo } from 'react';
import { Position, useReactFlow, type NodeProps } from 'reactflow';
import { Layers } from 'lucide-react';
import type { GroupBlockData } from '../../../types'; // 确保路径正确
//import { LAYOUT_CONFIG } from '../../../constants';   // 确保路径正确
import { BaseNodeWrapper, type HandleConfig } from '../base';

const groupInnerStyles = {
    header: { position: 'absolute' as const, top: 0, left: 0, right: 0, height: '40px', padding: '0 15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'move' },
    icon: { color: '#666' },
    input: { background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 'bold', color: '#333', outline: 'none', width: '100%' }
};

// 🔥 修复点：修改为 export const (具名导出)，并移除底部的 export default
export const GroupNode = memo(({ id, data, selected }: NodeProps<GroupBlockData>) => {
    const { setNodes } = useReactFlow();
    const [label, setLabel] = useState(data.label || '上下文组');

    if (data.label && data.label !== label) { setLabel(data.label); }

    const handleLabelChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const val = evt.target.value; setLabel(val);
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
    };

    // 配置隐形 Handle
    const handlesConfig: HandleConfig[] = useMemo(() => [
        { type: 'target', position: Position.Top, style: { opacity: 0 } },
        { type: 'source', position: Position.Bottom, style: { opacity: 0 } }
    ], []);

    return (
        <BaseNodeWrapper
            id={id}
            selected={selected}
            onResize={data.onResize}
            handles={handlesConfig}
            borderStyle="dashed" // 虚线边框
            selectionColor="#2196F3" // 选中变蓝
            style={{
                // 核心修改：宽度读取常量，高度 100% 由 React Flow 处理
                width: `100%`,
                height: '100%',
                backgroundColor: 'rgba(240, 242, 245, 0.7)',
                paddingTop: '40px',
                paddingLeft: '20px',
                paddingRight: '20px',
                paddingBottom: '20px',
                borderRadius: '12px'
            }}
        >
            {/* Header: 拖拽区域 */}
            <div style={groupInnerStyles.header} className="custom-drag-handle">
                <Layers size={16} style={groupInnerStyles.icon} />
                <input className="nodrag" value={label} onChange={handleLabelChange} style={groupInnerStyles.input} />
            </div>

            {/* Content: 占位区域 */}
            <div className="nodrag" style={{ width: '100%', height: '100%', cursor: 'default' }} />
        </BaseNodeWrapper>
    );
});

// ❌ 删除这一行
// export default GroupNode;