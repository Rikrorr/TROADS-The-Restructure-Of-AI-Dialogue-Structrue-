// src/utils/geminiParser.ts
import { v4 as uuidv4 } from 'uuid';
import type { Node as RFNode, Edge } from 'reactflow';
import { LAYOUT_CONFIG } from '../constants';

export interface ProjectData {
    version: string;
    nodes: RFNode[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
}

interface ParsedTurn {
    role: 'user' | 'model';
    text: string;
}

/**
 * 策略 A: 基于 Angular 类名的 DOM 解析 (优先级最高)
 * 针对您提供的代码片段：.conversation-container -> .query-text-line / .markdown
 */
const parseFromAngularDom = (doc: Document): ParsedTurn[] => {
    const turns: ParsedTurn[] = [];

    // 1. 找到所有的对话容器
    // 根据您的片段，每个对话轮次都被包在 .conversation-container 里
    const containers = doc.querySelectorAll('.conversation-container');

    containers.forEach(container => {
        // --- 提取用户提问 ---
        // 您的片段显示：<p class="query-text-line ...">问题内容</p>
        const userQueryEl = container.querySelector('.query-text-line');
        if (userQueryEl) {
            const text = (userQueryEl as HTMLElement).innerText.trim();
            if (text) {
                turns.push({ role: 'user', text });
            }
        }

        // --- 提取模型回答 ---
        // 您的片段显示：<div class="markdown ...">回答内容</div>
        const modelResponseEl = container.querySelector('.markdown');
        if (modelResponseEl) {
            // 🔥🔥🔥 修复点：将 let 改为 const
            const text = (modelResponseEl as HTMLElement).innerText.trim();

            // 简单的噪音过滤 (过滤掉系统内部版本号字符串)
            if (text && !text.startsWith('%.@.') && !text.includes('boq_assistant')) {
                turns.push({ role: 'model', text });
            }
        }
    });

    return turns;
};

/**
 * 策略 B: 脚本数据挖掘 (备用)
 * 如果 DOM 解析失败，再尝试去脚本里挖
 */
const parseFromScript = (htmlString: string): ParsedTurn[] => {
    const turns: ParsedTurn[] = [];
    // 简单的脚本正则提取，仅作为备用
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(htmlString)) !== null) {
        const content = match[1];
        if (!content.includes('WIZ_global_data')) continue;

        // 寻找包含特殊分隔符的字符串
        const magicStringRegex = /"((?:[^"\\]|\\.)*?[\u2230\u221e].*?)"/g;
        let strMatch;
        while ((strMatch = magicStringRegex.exec(content)) !== null) {
            try {
                const decoded = JSON.parse(`"${strMatch[1]}"`);
                if (decoded.includes('∰')) {
                    const rawTurns = decoded.split('∰');
                    rawTurns.forEach((rawTurn: string) => {
                        const parts = rawTurn.split('∞');
                        if (parts.length >= 1 && parts[0].trim()) {
                            turns.push({ role: 'user', text: parts[0].trim() });
                            if (parts.length > 1) {
                                const ans = parts[parts.length - 1].trim();
                                if (ans) turns.push({ role: 'model', text: ans });
                            }
                        }
                    });
                }
            } catch { /* ignore */ }
        }
    }
    return turns;
};

export const convertHtmlToProjectData = (htmlString: string): ProjectData => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 1. 优先尝试 Angular DOM 解析 (这是针对您的文件最准确的)
    let turns = parseFromAngularDom(doc);

    // 2. 如果 DOM 解析没找到东西，尝试脚本解析 (兜底)
    if (turns.length === 0) {
        console.warn("DOM parsing empty, trying script parsing...");
        turns = parseFromScript(htmlString);
    }

    // 3. 构建节点
    const nodes: RFNode[] = [];
    const groupId = uuidv4();
    let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;

    nodes.push({
        id: groupId,
        type: 'groupNode',
        position: { x: 0, y: 0 },
        data: { label: `Gemini 导入 (${new Date().toLocaleDateString()})` },
        style: { width: LAYOUT_CONFIG.GROUP_WIDTH, height: 500, zIndex: -1 }
    });

    if (turns.length === 0) {
        nodes.push({
            id: uuidv4(),
            type: 'chatNode',
            position: { x: 20, y: currentY },
            parentNode: groupId,
            data: {
                question: "导入失败",
                answer: "未能解析到对话内容。请确保您保存的是包含对话的完整网页 HTML。",
                status: 'completed'
            },
            style: { width: LAYOUT_CONFIG.GROUP_WIDTH - 40 }
        });
    } else {
        // 4. 将线性的 Turns 合并为 Q&A 节点
        let i = 0;
        while (i < turns.length) {
            const t = turns[i];

            let question = "";
            let answer = "";

            if (t.role === 'user') {
                question = t.text;
                // 寻找紧随其后的 Model 回复
                if (i + 1 < turns.length && turns[i+1].role === 'model') {
                    answer = turns[i+1].text;
                    i += 2;
                } else {
                    answer = "（无回答）";
                    i++;
                }
            } else {
                // 如果是孤立的 Model 回复 (可能是开场白或解析错位)
                question = "（Gemini 信息）";
                answer = t.text;
                i++;
            }

            // 过滤掉系统内部代码
            if (answer.includes('boq_assistant') || (answer.length < 2 && question.includes('信息'))) {
                continue;
            }

            const nodeId = uuidv4();
            nodes.push({
                id: nodeId,
                type: 'chatNode',
                position: { x: 20, y: currentY },
                parentNode: groupId,
                data: {
                    question: question.slice(0, 500),
                    answer: answer,
                    status: 'completed',
                    isLast: i >= turns.length
                },
                style: { width: LAYOUT_CONFIG.GROUP_WIDTH - 40 }
            });

            // 估算高度
            const estimatedHeight = 200 + (answer.length / 25) * 20;
            currentY += Math.max(300, estimatedHeight);
        }
    }

    // 修正分组高度
    if (nodes.length > 1) {
        nodes[0].style = { ...nodes[0].style, height: currentY + 100 };
    }

    return {
        version: '1.0.0',
        nodes: nodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    };
};