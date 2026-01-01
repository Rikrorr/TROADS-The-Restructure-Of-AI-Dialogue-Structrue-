// src/utils/geminiParser.ts
import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from 'reactflow';
import { LAYOUT_CONFIG } from '../constants';
import { NodeFactory } from './nodeFactory';
import type { NodeCallbacks, ProjectData } from '../types';

// =========================================================================
// 1. 类型与 Mock 回调
// =========================================================================

interface ParsedTurn {
    role: 'user' | 'model';
    text: string;
}

// 虚拟回调：用于导入的静态节点占位
// 实际交互逻辑通常由 App 层的 Context 或 Hydration 接管
const mockCallbacks: NodeCallbacks = {
    onAsk: () => console.log('Mock onAsk'),
    onHandleDoubleClick: () => console.log('Mock onHandleDoubleClick'),
    onExtend: () => console.log('Mock onExtend'),
    // onResize 可选，这里省略
};

// =========================================================================
// 2. 解析策略 (DOM & Script)
// =========================================================================

/** 策略 A: 基于 Angular DOM 解析 (针对标准导出) */
const parseFromAngularDom = (doc: Document): ParsedTurn[] => {
    const turns: ParsedTurn[] = [];
    const containers = doc.querySelectorAll('.conversation-container');

    containers.forEach(container => {
        // 提取用户提问
        const userQueryEl = container.querySelector('.query-text-line');
        if (userQueryEl) {
            const text = (userQueryEl as HTMLElement).innerText.trim();
            if (text) turns.push({ role: 'user', text });
        }

        // 提取模型回答
        const modelResponseEl = container.querySelector('.markdown');
        if (modelResponseEl) {
            const text = (modelResponseEl as HTMLElement).innerText.trim();
            if (text && !text.startsWith('%.@.') && !text.includes('boq_assistant')) {
                turns.push({ role: 'model', text });
            }
        }
    });
    return turns;
};

/** 策略 B: 脚本数据挖掘 (兜底方案) */
const parseFromScript = (htmlString: string): ParsedTurn[] => {
    const turns: ParsedTurn[] = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(htmlString)) !== null) {
        const content = match[1];
        if (!content.includes('WIZ_global_data')) continue;

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

// =========================================================================
// 3. 核心转换逻辑 (Parser)
// =========================================================================

export const convertHtmlToProjectData = (htmlString: string): ProjectData => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 1. 执行解析
    let turns = parseFromAngularDom(doc);
    if (turns.length === 0) {
        console.warn("DOM parsing empty, trying script parsing...");
        turns = parseFromScript(htmlString);
    }

    const nodes: Node[] = [];
    const edges: Edge[] = []; // 保持为空，不自动生成连线

    // 生成唯一分组 ID
    const groupId = uuidv4();

    // 初始 Y 坐标
    // 注意：这里只给一个简单的增量，防止节点完全重叠。
    // 真正的高度和布局完全交给 useGraphLayout 的自动化机制。
    let currentY = LAYOUT_CONFIG.GROUP_PADDING_TOP;

    // 2. 创建分组节点 (GroupNode)
    const groupNode = NodeFactory.createGroup(
        groupId,
        { x: 0, y: 0 },
        `Gemini 导入 (${new Date().toLocaleDateString()})`
    );
    nodes.push(groupNode);

    // 辅助：添加节点到列表
    const addChatNode = (question: string, answer: string, isLast: boolean) => {
        // 🔥 使用 Factory 创建节点
        // 关键点：我们不在 style 中指定 height。
        // NodeFactory 默认 style.width 是固定的，但 height 留空。
        // 这允许 ChatNode 组件在渲染时根据内容自动撑开 DOM。
        const chatNode = NodeFactory.createChat(
            uuidv4(),
            { x: 20, y: currentY }, // 初始位置
            {
                question: question.slice(0, 500), // 限制问题长度
                answer: answer,
                status: 'completed',
                superBlockId: uuidv4(), // 补全核心 ID
                isLast: isLast
            },
            mockCallbacks,
            groupId
        );

        // 🔥 确保移除任何可能的高度设定，强制启用自适应
        if (chatNode.style) {
            chatNode.style.height = undefined;
        }

        nodes.push(chatNode);

        // 临时累加 Y (仅作为初始堆叠间距，非真实高度)
        currentY += 100;
    };

    // 3. 处理解析数据
    if (turns.length === 0) {
        addChatNode("导入失败", "未能解析到对话内容。请确保您保存的是包含对话的完整网页 HTML。", true);
    } else {
        let i = 0;
        while (i < turns.length) {
            const t = turns[i];
            let question = "";
            let answer = "";

            if (t.role === 'user') {
                question = t.text;
                if (i + 1 < turns.length && turns[i+1].role === 'model') {
                    answer = turns[i+1].text;
                    i += 2;
                } else {
                    answer = "（无回答）";
                    i++;
                }
            } else {
                question = "（Gemini 信息）";
                answer = t.text;
                i++;
            }

            if (answer.includes('boq_assistant') || (answer.length < 2 && question.includes('信息'))) {
                continue;
            }

            addChatNode(question, answer, i >= turns.length);
        }
    }

    // 4. 初始分组高度
    // 给一个较大的初始值，避免看起来像一条线。后续会自动收缩或撑大。
    groupNode.style = {
        ...groupNode.style,
        height: Math.max(300, currentY + 100)
    };

    return {
        version: '1.0.0',
        nodes: nodes,
        edges: edges,
        viewport: { x: 0, y: 0, zoom: 1 }
    };
};