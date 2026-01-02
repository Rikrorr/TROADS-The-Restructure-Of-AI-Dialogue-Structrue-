// src/hooks/useStreamAI.ts
import { useCallback, useRef, useEffect } from 'react';
import { useFlowActions } from './useFlowActions';
import type { Node } from 'reactflow';

export const useStreamAI = (setNodes?: React.Dispatch<React.SetStateAction<Node[]>>) => {
    const { updateNodeData } = useFlowActions(setNodes);

    // 1. 使用 ref 存储定时器 ID，这样即使组件重渲染，ID 也不会丢失
    // 使用 ReturnType<typeof ...> 是为了兼容浏览器环境和 NodeJS 环境的类型定义
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 2. 组件卸载时的清理逻辑 (防止内存泄漏的核心)
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const triggerStream = useCallback((nodeId: string, question: string) => {
        // 在开始新任务前，先清理上一次可能未完成的任务
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);

        // 1. 设置 Loading
        updateNodeData(nodeId, { question, status: 'loading' });

        // 2. 模拟网络请求延迟 (Loading 阶段)
        timeoutRef.current = setTimeout(() => {
            // 开始 Streaming
            updateNodeData(nodeId, { status: 'streaming', answer: '' });

            const fakeAnswer = `针对该问题的回答...\n(模拟流式输出)\n\n1. 修复了 ESLint prefer-const 报错。\n2. 使用 useFlowActions 解耦。\n3. 代码更加规范，且修复了内存泄漏风险。\n\n(模拟结束)`;
            let i = 0;
            let currentAnswer = '';

            // 3. 模拟打字机效果 (Streaming 阶段)
            intervalRef.current = setInterval(() => {
                if (i < fakeAnswer.length) {
                    currentAnswer += fakeAnswer.charAt(i);
                    updateNodeData(nodeId, { answer: currentAnswer });
                    i++;
                } else {
                    // 4. 完成
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    updateNodeData(nodeId, { status: 'completed' });
                }
            }, 20);

        }, 600);
    }, [updateNodeData]);

    return { triggerStream };
};