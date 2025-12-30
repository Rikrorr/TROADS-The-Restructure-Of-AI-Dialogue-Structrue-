// src/components/nodes/base/BaseNodeWrapper.tsx
import React, { memo, useRef, useEffect, useMemo } from 'react';
import { Handle } from 'reactflow'; // 引入 React Flow 的核心组件，用于创建连线锚点
import type { BaseNodeWrapperProps } from './types'; // 引入类型定义

/**
 * 🎨 默认 Handle (连接点) 样式
 * 设计思路：提供一套统一的基础样式，保证所有节点的连接点视觉一致。
 * 业务组件可以通过 handles 属性覆盖这些样式。
 */
const defaultHandleStyle = {
    zIndex: 10,           // 保证连接点浮在节点内容之上
    width: '10px',        // 触点宽度
    height: '10px',       // 触点高度
    background: '#fff',   // 默认为白色填充
    border: '2px solid #777' // 灰色边框
};

/**
 * 📦 BaseNodeWrapper (节点通用外壳组件)
 * * 核心设计哲学：【装饰器模式】 + 【逻辑复用】
 * 这是一个“高阶容器”，它不关心节点里面具体显示什么（ChatNode 还是 ImageNode）。
 * 它只负责处理所有节点共有的逻辑：
 * 1. 📏 尺寸测量与上报 (Auto-Layout 的基础)
 * 2. 💅 选中状态的高亮样式 (Selected State)
 * 3. ⚓️ 连接点 (Handles) 的渲染
 */
export const BaseNodeWrapper = memo(({
                                         id,             // 节点唯一 ID (React Flow 注入)
                                         selected,       // 当前是否被选中 (React Flow 注入)
                                         children,       // 具体的业务内容 (如 ChatNode 的 JSX)
                                         handles = [],   // 连接点配置数组
                                         onResize,       // 回调：当尺寸变化时通知父级 (关键逻辑)
                                         style = {},     // 外部传入的自定义样式
                                         className = '', // 外部传入的 CSS 类名
                                         selectionColor = '#FF5722', // 选中时的边框颜色 (默认橙色)
                                         borderStyle = 'solid',      // 边框风格
                                         onContextMenu,  // 右键菜单事件
                                         onClick         // 点击事件
                                     }: BaseNodeWrapperProps) => {

    // 引用真实的 DOM 节点，用于测量宽/高
    const containerRef = useRef<HTMLDivElement>(null);

    // 用于追踪组件是否已卸载，防止在卸载后设置 State 导致内存泄漏
    const isUnmounted = useRef(false);

    /**
     * 🧩 模块 1: 尺寸感知系统 (The Sensor)
     * ------------------------------------------------------------------
     * 实现思路：
     * 1. 监听：使用 ResizeObserver 监听 DOM 元素的几何变化。
     * 2. 防抖：使用 requestAnimationFrame 避免在一帧内频繁触发重绘 (FPS 优化)。
     * 3. 上报：将最新的 width/height 传给 onResize，进而触发 LayoutUtils 的自动重排。
     */
    useEffect(() => {
        // 如果没有传入回调、没有 ID 或 ref 未挂载，直接跳过，节省性能
        if (!onResize || !id || !containerRef.current) return;

        // 标记组件为活跃状态
        isUnmounted.current = false;
        let animationFrameId: number;

        // 创建 DOM 尺寸监听器
        const observer = new ResizeObserver((entries) => {
            // 安全检查：如果组件已卸载，停止执行
            if (isUnmounted.current) return;

            const entry = entries[0];
            // 防御性编程：如果尺寸无效，忽略
            if (!entry || entry.contentRect.width <= 0) return;

            // 清除上一帧的请求，确保只处理最新的一次变化
            cancelAnimationFrame(animationFrameId);

            // 在下一帧渲染前执行逻辑
            animationFrameId = requestAnimationFrame(() => {
                // 再次检查组件存活状态
                if (!isUnmounted.current && containerRef.current) {
                    // 🔥 核心动作：上报当前真实 DOM 尺寸
                    // offsetWidth/Height 包含了 padding 和 border，适合布局计算
                    onResize(id, containerRef.current.offsetWidth, containerRef.current.offsetHeight);
                }
            });
        });

        // 开始监听当前容器 div
        observer.observe(containerRef.current);

        // 清理函数：组件卸载时执行
        return () => {
            isUnmounted.current = true; // 标记死亡
            observer.disconnect();      // 停止监听 DOM
            cancelAnimationFrame(animationFrameId); // 取消未执行的动画帧
        };
    }, [id, onResize]); // 依赖项：只有 ID 或回调函数变化时才重启监听

    /**
     * 🎨 模块 2: 样式计算引擎 (Style Engine)
     * ------------------------------------------------------------------
     * 实现思路：
     * 1. 响应式：根据 `selected` 状态动态切换边框和阴影。
     * 2. 缓存：使用 useMemo 缓存样式对象，避免每次 Render 都创建新对象导致子组件不必要的重绘。
     * 3. 优先级：外部 style > 内部默认 style。
     */
    const containerStyle: React.CSSProperties = useMemo(() => ({
        position: 'relative',    // 相对定位，为了让绝对定位的 Handles 基于此定位
        boxSizing: 'border-box', // 边框盒模型，确保 width 包含 border/padding
        borderRadius: '8px',     // 统一 UI 风格：圆角
        transition: 'all 0.2s ease', // 添加平滑过渡动画 (选中/取消选中时会有呼吸感)
        ...style, // 展开合并外部传入的样式 (允许外部覆盖默认值)

        // 动态计算边框：选中时使用 selectionColor，未选中时使用灰色或传入样式
        border: selected
            ? `2px ${borderStyle} ${selectionColor}`
            : (style.border || `1px ${borderStyle} #E0E0E0`),

        // 动态计算阴影：选中时发光 (50%透明度)，未选中时显示轻微阴影
        boxShadow: selected
            ? `0 0 10px ${selectionColor}80`
            : (style.boxShadow || '0 2px 6px rgba(0,0,0,0.08)'),

        cursor: 'default', // 鼠标样式
    }), [selected, style, selectionColor, borderStyle]); // 仅当这些视觉相关的 props 变化时重新计算

    return (
        <div
            ref={containerRef}       // 绑定 Ref 以便测量尺寸
            className={className}    // 允许外部传入 class (如 Tailwind 类名)
            style={containerStyle}   // 应用计算好的样式
            onClick={onClick}        // 透传点击事件
            onContextMenu={onContextMenu} // 透传右键菜单事件
        >
            {/* 🧩 模块 3: 动态连接桩渲染器 (Dynamic Handle Renderer)
              ------------------------------------------------------------------
              实现思路：
              1. 遍历 handles 数组配置。
              2. 为每个配置生成一个 React Flow <Handle /> 组件。
              3. 这允许一个节点有任意数量、任意位置 (Top/Bottom/Left/Right) 的连接点。
            */}
            {handles.map((h, index) => (
                <Handle
                    key={`${h.type}-${index}-${h.id}`} // 唯一 Key，确保 React Diff 算法正常工作
                    id={h.id}               // Handle ID (连接线识别端点用)
                    type={h.type}           // 'source' (输出) 或 'target' (输入)
                    position={h.position}   // 位置：Position.Top / Bottom 等
                    isConnectable={h.isConnectable !== undefined ? h.isConnectable : true} // 是否允许连接
                    style={{ ...defaultHandleStyle, ...h.style }} // 合并默认样式和个性化样式
                    // 双击 Handle 的事件 (可用于触发特殊逻辑，如删除连线)
                    onDoubleClick={(e) => h.onDoubleClick?.(e, h.id || '')}
                />
            ))}

            {/* 🧩 模块 4: 业务内容插槽 (Content Slot)
              ------------------------------------------------------------------
              实现思路：
              这里渲染具体的业务组件 (如 ChatNode 里的输入框和 Markdown)。
              Wrapper 不关心这里面是什么，只负责把它包起来。
            */}
            {children}
        </div>
    );
});