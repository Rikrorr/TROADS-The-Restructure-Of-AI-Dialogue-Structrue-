// src/utils/__tests__/layoutUtils.test.ts
import { LayoutUtils } from '../layoutUtils';
import { LAYOUT_CONFIG } from '../../constants';
import type { Node } from 'reactflow';

// Mock 一些基础数据
const createMockNode = (id: string, y: number, height: number, parentId: string): Node => ({
    id,
    type: 'chatNode',
    position: { x: 20, y },
    style: { height },
    parentNode: parentId,
    data: {},
});

const createMockGroup = (id: string, height: number): Node => ({
    id,
    type: 'groupNode',
    position: { x: 0, y: 0 },
    style: { height, width: 300 },
    data: {},
});

describe('LayoutUtils (自动布局算法)', () => {
    // 准备测试数据
    const groupId = 'group-1';
    const groupNode = createMockGroup(groupId, 300); // 初始高度 300
    const nodeA = createMockNode('node-A', 50, 100, groupId); // 顶部节点
    const nodeB = createMockNode('node-B', 170, 100, groupId); // 底部节点 (50+100+20gap = 170)

    const initialNodes = [groupNode, nodeA, nodeB];

    it('场景 1: 上方节点变高，下方节点应自动下移', () => {
        // 动作：Node A 从 100 变高到 200 (增加了 100px)
        const newHeight = 200;
        const resultNodes = LayoutUtils.adjustLayoutAfterResize(
            initialNodes,
            'node-A',
            newHeight
        );

        // 断言 1: Node A 高度更新了
        const newNodeA = resultNodes.find(n => n.id === 'node-A');
        expect(newNodeA?.style?.height).toBe(200);

        // 断言 2: Node B 的 Y 坐标下移了
        // 原 Y(170) + 增量(100) = 270
        const newNodeB = resultNodes.find(n => n.id === 'node-B');
        // 重新计算逻辑: 50(A.y) + 200(A.h) + 20(gap) = 270
        expect(newNodeB?.position.y).toBe(270);
    });

    it('场景 2: 子节点变高，父分组高度应自适应增加', () => {
        const newHeight = 200; // Node A 增加 100
        const resultNodes = LayoutUtils.adjustLayoutAfterResize(
            initialNodes,
            'node-A',
            newHeight
        );

        const newGroup = resultNodes.find(n => n.id === groupId);

        // 原底边: 170(B.y) + 100(B.h) = 270
        // 新底边: 270(B.y) + 100(B.h) = 370
        // Group 高度 = 370 + PADDING_BOTTOM(假设是20) = 390
        // 原高度 300 -> 增加了接近 100
        const expectedHeight = 270 + 100 + LAYOUT_CONFIG.GROUP_PADDING_BOTTOM;
        expect(newGroup?.style?.height).toBe(expectedHeight);
    });

    it('场景 3: 数据不可变性 (Immutability)', () => {
        // 确保没有修改原数组
        LayoutUtils.adjustLayoutAfterResize(initialNodes, 'node-A', 200);
        expect(initialNodes[0].style?.height).toBe(300); // 原数据不变
    });
});