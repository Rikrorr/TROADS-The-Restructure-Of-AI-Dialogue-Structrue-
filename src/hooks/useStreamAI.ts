// src/hooks/useStreamAI.ts
import { useCallback, useRef } from 'react';
import type { Node } from 'reactflow';
import { useFlowActions } from './useFlowActions';

export const useStreamAI = (
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>
) => {
    // 🔥 修复 1: 移除第二个参数，只传 setNodes
    // 因为您的 useFlowActions 定义只接受一个参数，这样就匹配了
    const { updateNodeData } = useFlowActions(setNodes);

    // 用 ref 存储当前的 reader，以便后续实现“停止生成”功能（预留）
    const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

    const triggerStream = useCallback(async (nodeId: string, question: string) => {
        // 1. 读取配置
        const apiKey = localStorage.getItem('troads_api_key');
        const baseUrl = localStorage.getItem('troads_base_url') || 'https://api.openai.com/v1';
        const model = localStorage.getItem('troads_model') || 'gpt-3.5-turbo';

        // 2. 将状态置为 loading
        updateNodeData(nodeId, { status: 'loading', question });

        // ==================================================================================
        // 分支 A: 如果有 API Key -> 真实请求
        // ==================================================================================
        if (apiKey) {
            try {
                // 3. 发起 Fetch 请求
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: "You are a helpful assistant assisting with thinking processes." },
                            { role: "user", content: question }
                        ],
                        stream: true // 开启流式
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errText}`);
                }

                if (!response.body) throw new Error('No response body');

                // 4. 处理流式响应
                const reader = response.body.getReader();
                readerRef.current = reader;
                const decoder = new TextDecoder();

                // 状态转为 streaming，清空 answer 准备接收
                updateNodeData(nodeId, { status: 'streaming', answer: '' });

                let fullAnswer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    // OpenAI 返回的数据可能包含多行 "data: {...}"
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        if (line === 'data: [DONE]') continue;
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.replace('data: ', '');
                                const json = JSON.parse(jsonStr);
                                const content = json.choices[0]?.delta?.content || '';

                                if (content) {
                                    fullAnswer += content;
                                    // 实时更新 UI
                                    updateNodeData(nodeId, { answer: fullAnswer });
                                }
                            } catch (e) {
                                console.warn('JSON parse error', e);
                            }
                        }
                    }
                }

                // 5. 完成
                updateNodeData(nodeId, { status: 'completed' });

            } catch (error: unknown) { // 🔥 修复 2: 使用 unknown 类型
                console.error('Stream AI Error:', error);

                // 安全地获取错误信息
                const errorMessage = error instanceof Error ? error.message : String(error);

                updateNodeData(nodeId, {
                    status: 'input', // 回退到 input 允许重试
                    answer: `请求失败: ${errorMessage}`
                });
            }

        }
            // ==================================================================================
            // 分支 B: 如果没有 API Key -> 模拟数据 (测试用)
        // ==================================================================================
        else {
            console.log("未检测到 API Key，使用模拟模式...");

            // 模拟网络延迟
            setTimeout(() => {
                updateNodeData(nodeId, { status: 'streaming', answer: '' });

                const mockResponse = `[模拟模式] 你好！这是一个测试回复。\n\n针对你的问题：“${question}”\n\n我的回答是：因为你没有在左下角设置 API Key，所以我只能假装思考一下。请点击左下角设置图标填入 Key 来体验真实 AI 能力。\n\n(这里是模拟的打字机效果...)`;

                let i = 0;
                const interval = setInterval(() => {
                    if (i < mockResponse.length) {
                        updateNodeData(nodeId, { answer: mockResponse.slice(0, i + 1) });
                        i++;
                    } else {
                        clearInterval(interval);
                        updateNodeData(nodeId, { status: 'completed' });
                    }
                }, 30); // 打字速度
            }, 1000); // 启动延迟
        }

    }, [updateNodeData]);

    return { triggerStream };
};