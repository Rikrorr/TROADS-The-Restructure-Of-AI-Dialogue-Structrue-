// src/hooks/useStreamAI.ts
import { useCallback, useRef, useEffect } from 'react';
import { useFlowActions } from './useFlowActions';
import type { Node } from 'reactflow';

// 定义一个全局的流状态管理器，避免多个实例冲突
const globalStreamingState = new Map<string, { 
    intervalId: number | null, 
    timeoutId: number | null,
    maxTimeoutId: number | null,
    state: {
        nodeId: string,
        fakeAnswer: string,
        i: number,
        currentAnswer: string
    }
}>();

export const useStreamAI = (setNodes?: React.Dispatch<React.SetStateAction<Node[]>>) => {
    const { updateNodeData, getNodes } = useFlowActions(setNodes);

    // 清理函数
    const cleanupStreamingState = useCallback((nodeId: string) => {
        const state = globalStreamingState.get(nodeId);
        if (state) {
            if (state.intervalId) clearInterval(state.intervalId);
            if (state.timeoutId) clearTimeout(state.timeoutId);
            if (state.maxTimeoutId) clearTimeout(state.maxTimeoutId);
            globalStreamingState.delete(nodeId);
        }
    }, []);

    // 组件卸载时的清理逻辑
    useEffect(() => {
        return () => {
            // 清理所有活动的流
            for (const nodeId of globalStreamingState.keys()) {
                cleanupStreamingState(nodeId);
            }
        };
    }, [cleanupStreamingState]);

    const triggerStream = useCallback((nodeId: string, question: string) => {
        console.log(`Starting stream for node: ${nodeId}, question: ${question}`);
        
        // 先清理之前的流状态（如果存在）
        cleanupStreamingState(nodeId);

        // 设置当前流式传输的状态
        const fakeAnswer = `针对该问题的回答...
(模拟流式输出)

1. 修复了 ESLint prefer-const 报错。
2. 使用 useFlowActions 解耦。
3. 代码更加规范，且修复了内存泄漏风险。

(模拟结束)`;
        
        // 初始化状态
        const initialState = {
            nodeId,
            fakeAnswer,
            i: 0,
            currentAnswer: ''
        };
        
        globalStreamingState.set(nodeId, {
            intervalId: null,
            timeoutId: null,
            maxTimeoutId: null,
            state: initialState
        });

        // 1. 设置 Loading
        updateNodeData(nodeId, { question, status: 'loading' });
        console.log(`Set loading status for ${nodeId}`);

        // 2. 模拟网络请求延迟 (Loading 阶段)
        const timeoutId = window.setTimeout(() => {
            console.log(`Starting streaming for ${nodeId}`);
            // 开始 Streaming
            updateNodeData(nodeId, { status: 'streaming', answer: '' });

            // 获取当前状态
            const currentState = globalStreamingState.get(nodeId);
            if (!currentState) return;
            
            // 设置最大超时保护，确保状态最终会被设置为completed
            const maxTimeoutId = window.setTimeout(() => {
                console.log(`Max timeout reached for ${nodeId}, forcing completed status`);
                // 如果由于某些原因interval没有正常结束，强制设置为completed
                updateNodeData(nodeId, { status: 'completed' });
                
                // 清理定时器
                const state = globalStreamingState.get(nodeId);
                if (state && state.intervalId) {
                    clearInterval(state.intervalId);
                    state.intervalId = null;
                }
                
                // 清理全局状态
                globalStreamingState.delete(nodeId);
            }, 10000); // 10秒后强制完成
            
            // 更新状态中的maxTimeoutId
            currentState.maxTimeoutId = maxTimeoutId;

            // 3. 模拟打字机效果 (Streaming 阶段)
            const intervalId = window.setInterval(() => {
                const state = globalStreamingState.get(nodeId);
                if (!state) {
                    console.log(`State not found for ${nodeId}, clearing interval`);
                    clearInterval(intervalId);
                    return;
                }
                
                console.log(`Interval tick: nodeId=${state.state.nodeId}, i=${state.state.i}, length=${state.state.fakeAnswer.length}`);
                
                // 检查节点是否仍然存在于流程图中
                const nodeExists = getNodes().some(node => node.id === state.state.nodeId);
                if (!nodeExists) {
                    console.log(`Node ${state.state.nodeId} no longer exists`);
                    // 节点已被删除，清理定时器
                    clearInterval(intervalId);
                    if (state.maxTimeoutId) clearTimeout(state.maxTimeoutId);
                    
                    // 从全局状态中移除
                    globalStreamingState.delete(nodeId);
                    return;
                }
                
                if (state.state.i < state.state.fakeAnswer.length) {
                    state.state.currentAnswer += state.state.fakeAnswer.charAt(state.state.i);
                    updateNodeData(state.state.nodeId, { answer: state.state.currentAnswer });
                    state.state.i++;
                } else {
                    console.log(`Stream completed for ${state.state.nodeId}, setting completed status`);
                    // 4. 完成 - 清理并设置完成状态
                    clearInterval(intervalId);
                    if (state.maxTimeoutId) clearTimeout(state.maxTimeoutId);
                    
                    // 确保完成状态更新
                    updateNodeData(state.state.nodeId, { status: 'completed' });
                    
                    // 为了确保UI更新，额外触发一次更新
                    setTimeout(() => {
                        updateNodeData(state.state.nodeId, { 
                            status: 'completed',
                            answer: state.state.currentAnswer,
                            __timestamp: Date.now() // 添加时间戳强制UI更新
                        });
                    }, 50);
                    
                    // 从全局状态中移除
                    globalStreamingState.delete(nodeId);
                }
            }, 20);
            
            // 更新状态中的intervalId
            currentState.intervalId = intervalId;

        }, 600);
        
        // 更新状态中的timeoutId
        const state = globalStreamingState.get(nodeId);
        if (state) {
            state.timeoutId = timeoutId;
        }
    }, [updateNodeData, getNodes, cleanupStreamingState]);

    return { triggerStream };
};