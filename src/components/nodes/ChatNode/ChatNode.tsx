// src/components/nodes/chat/ChatNode.tsx
import React, { memo, useState, useEffect, useMemo, useCallback, type KeyboardEvent, type CSSProperties } from 'react';
import { Position, type NodeProps, useReactFlow } from 'reactflow'; // 引入“指南针”、“快递单”、“万能遥控器”
import { Bot, User, Send, Loader2, ArrowDown } from 'lucide-react'; // 引入“装饰画”（图标）
import type { QABlockData } from '../../../types'; // 引入咱们自定义的数据格式
import { BaseNodeWrapper, type HandleConfig } from '../base'; // 引入之前那个“智能相框”

// --- 🏗️ 模块 1: 静态样式定义 (装修清单) ---
// 设计思路：把不需要动的样式写在组件外面，避免每次渲染都重新创建对象（省内存）。
const contentStyles = {
    // 动态样式：根据状态（输入中、完成、加载）返回不同的进度条颜色
    progressBar: (status: string): CSSProperties => ({
        height: '4px',
        background: status === 'completed' ? '#4CAF50' : (status === 'input' ? '#ccc' : '#2196F3'), // 绿、灰、蓝三色切换
        width: '100%',
        transition: 'all 0.3s ease' // 颜色变化时有个平滑过渡
    }),
    inputSection: { padding: '15px', background: '#F5F7FA', borderBottom: '1px solid #eee' } as CSSProperties,
    headerText: { display: 'flex', alignItems: 'center', marginBottom: '8px', color: '#1976D2', fontWeight: 'bold', fontSize: '13px' } as CSSProperties,
    textarea: { width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', resize: 'none', outline: 'none', marginBottom: '8px', display: 'block', fontFamily: 'inherit', fontSize: '13px' } as CSSProperties,
    submitBtn: { marginLeft: 'auto', background: '#1976D2', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' } as CSSProperties,
    questionText: { fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap', minHeight: '20px', wordBreak: 'break-word' as const } as CSSProperties,
    answerSection: { padding: '15px', background: '#fff' } as CSSProperties,
    answerText: { fontSize: '14px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' as const } as CSSProperties,
    extendBtn: { background: '#fff', border: '1px solid #4CAF50', color: '#4CAF50', borderRadius: '20px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' } as CSSProperties
};

// --- 🧩 模块 2: 子组件拆分 (小零件) ---
// 设计思路：把“输入框”和“展示框”拆出来，让主代码看起来清爽点。

// 2.1 输入模式组件：用于打字
interface InputModeProps {
    text: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onSubmit: () => void;
}

const InputMode = ({ text, onChange, onKeyDown, onSubmit }: InputModeProps) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
            className="nodrag" // ⚠️ 关键点：加上这个类名，告诉 React Flow “在这里拖拽是选文字，别拖动整个节点！”
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onMouseDown={(e) => e.stopPropagation()} // 阻止事件冒泡，防止点击输入框选中了节点
            placeholder="Input..."
            style={contentStyles.textarea}
            autoFocus // 自动聚焦，方便直接打字
        />
        <button
            className="nodrag" // 按钮也不能触发节点拖拽
            onClick={onSubmit}
            onMouseDown={(e) => e.stopPropagation()}
            style={contentStyles.submitBtn}
        >
            <Send size={12} /> Submit
        </button>
    </div>
);

// 2.2 展示模式组件：用于显示问题
const DisplayMode = ({ text }: { text: string }) => (
    <div
        className="nodrag"
        onMouseDown={(e) => e.stopPropagation()}
        style={contentStyles.questionText}
    >
        {text || '(Empty)'}
    </div>
);

// --- 🚀 模块 3: 主组件 ChatNode (大厨开始做菜) ---
// 使用 memo (保安) 包裹，防止父组件刷新导致所有 ChatNode 无意义重绘
export const ChatNode = memo(({ id, data, selected }: NodeProps<QABlockData>) => {
    // 🛠️ 1. 拿到万能遥控器，准备用来选中节点
    const { setNodes } = useReactFlow();

    // 🧠 2. 性能优化策略：本地缓冲 (Local Buffer)
    // 为什么不直接用 props.data.question？
    // 因为打字速度很快，如果每敲一个字都去更新全局 Flow 数据，会导致几百个节点一起闪烁（重绘），卡顿！
    // 所以先存在这个本地小本本 (inputText) 上，等回车了再提交给全局。
    const [inputText, setInputText] = useState(data.question || '');

    // 🔄 3. 数据同步策略 (useEffect 管家)
    // 场景：如果 Inspector（右侧属性面板）修改了问题，或者撤销/重做了，data.question 变了。
    // 这时候本地小本本必须得跟进，保持一致。
    useEffect(() => {
        // 如果外部数据变了，且跟我不一样，我就更新
        if (data.question !== undefined && data.question !== inputText) {
            setInputText(data.question);
        }
        // 我们有意不将 inputText 加入依赖，因为我们只关心“外部 Props 的变化”
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.question]);

    // ⚡️ 4. 激活节点动作 (useCallback 录音机)
    // 功能：把当前节点设为“选中状态”，其他的设为“未选中”。
    const activateNode = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === id })));
    }, [id, setNodes]); // 依赖：只有 ID 或遥控器变了才重新录制

    // ⌨️ 5. 输入处理：打字时只更新本地小本本
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
    };

    // 📤 6. 提交处理：点击发送按钮
    const handleSubmit = () => {
        if (inputText.trim()) {
            activateNode(); // 先选中自己
            // 🔥 核心逻辑：这里才真正调用父级传入的 onAsk，触发 AI 请求和全局数据更新
            data.onAsk(id, inputText);
        }
    };

    // ⌨️ 7. 键盘快捷键：Ctrl + Enter 发送
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault(); // 阻止默认换行
            handleSubmit();
        }
    };

    // 🖱️ 8. 点击节点：仅选中，不干别的
    const handleNodeClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // 别传给画布，防止点画布取消选中
        activateNode();
    };

    // 🖱️ 9. 双击 Handle (连接点) 的处理
    // 修复 React Compiler / Hook 依赖问题
    const onHandleDoubleClick = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
        e.preventDefault();
        activateNode();
        // 如果上层传了处理函数，就执行
        if (data.onHandleDoubleClick) {
            data.onHandleDoubleClick(id, handleId);
        }
    }, [activateNode, data, id]); // data 本身作为依赖是安全的，因为 React Flow 会保持 data 引用稳定直到更新

    // 🔌 10. 连接点配置 (useMemo 账本)
    // 定义这个节点左右两边的小耳朵长啥样、在哪儿。
    const handlesConfig: HandleConfig[] = useMemo(() => [
        {
            // 左边的输入点
            id: 'left-source', type: 'source', position: Position.Left,
            style: { left: '-8px', width: '14px', height: '14px', background: '#fff', border: '3px solid #2196F3' },
            onDoubleClick: onHandleDoubleClick
        },
        {
            // 右边的输出点
            id: 'right-source', type: 'source', position: Position.Right,
            style: { right: '-8px', width: '14px', height: '14px', background: '#fff', border: '3px solid #2196F3' },
            onDoubleClick: onHandleDoubleClick
        }
    ], [onHandleDoubleClick]); // 只有双击处理函数变了，才重新生成配置

    return (
        // 🖼️ 使用之前写好的“智能相框”包裹内容
        <BaseNodeWrapper
            id={id}
            selected={selected}
            handles={handlesConfig} // 把耳朵安上
            onResize={data.onResize} // 告诉相框：尺寸变了跟谁汇报
            onClick={handleNodeClick}
            onContextMenu={e => e.preventDefault()} // 禁用默认右键菜单
            style={{ padding: '0', background: '#fff', overflow: 'hidden' }}
            selectionColor="#FF5722" // 选中变橙色
            borderStyle="solid"
        >
            {/* 📊 顶部进度条：展示不同颜色 */}
            <div style={contentStyles.progressBar(data.status)} />

            {/* 📝 上半部分：我的提问区域 */}
            <div style={contentStyles.inputSection}>
                <div style={contentStyles.headerText}>
                    <User size={14} style={{ marginRight: 6 }} />
                    <span>我的提问</span>
                </div>
                {/* 状态机判断：如果是 'input' 状态显示输入框，否则显示纯文本 */}
                {data.status === 'input' ? (
                    <InputMode
                        text={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onSubmit={handleSubmit}
                    />
                ) : (
                    <DisplayMode text={data.question || inputText} />
                )}
            </div>

            {/* 🤖 下半部分：AI 回答区域 */}
            {/* 只有在“流式输出中”或“已完成”时才显示 */}
            {(data.status === 'streaming' || data.status === 'completed') && (
                <div style={contentStyles.answerSection}>
                    <div style={{ ...contentStyles.headerText, color: '#4CAF50' }}>
                        <Bot size={14} style={{ marginRight: 6 }} />
                        <span>AI 回答</span>
                    </div>
                    {/* 显示回答内容，nodrag 防止选文字时拖动节点 */}
                    <div className="nodrag" onMouseDown={(e) => e.stopPropagation()} style={contentStyles.answerText}>
                        {data.answer}
                    </div>
                </div>
            )}

            {/* ⏳ Loading 状态：转圈圈 */}
            {data.status === 'loading' && (
                <div style={{ padding: '15px', display: 'flex', justifyContent: 'center' }}>
                    <Loader2 className="spin-animation" size={16} color="#2196F3" />
                </div>
            )}

            {/* 🔗 追问按钮 */}
            {/* 逻辑：只有回答完了，且是当前链路最后一个节点，才允许追问 */}
            {data.status === 'completed' && data.isLast && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 15px 0', marginTop: '-10px', position: 'relative', zIndex: 10 }}>
                    <button
                        className="nodrag"
                        // 点击触发 data.onExtend，在下方生成新节点
                        onClick={(e) => { e.stopPropagation(); activateNode(); data.onExtend(id, data.superBlockId); }}
                        style={contentStyles.extendBtn}
                    >
                        <ArrowDown size={14} /> 追问
                    </button>
                </div>
            )}
        </BaseNodeWrapper>
    );
});