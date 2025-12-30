export const LAYOUT_CONFIG = {
    GROUP_PADDING_TOP: 30,
    GROUP_PADDING_BOTTOM: 15,
    GROUP_WIDTH: 400,
    NODE_GAP: 15,
    NODE_PADDING_X: 12,
    DEFAULT_NODE_HEIGHT: 150,
    INIT_X: 250,
    INIT_Y: 50,
    OFFSET_Y: 300,
    BRANCH_OFFSET_X: 60,
};

export const STYLES = {
    EDGE_EDITABLE: { stroke: '#FF9800', strokeWidth: 2, strokeDasharray: '5,5' },
    EDGE_STEP: { stroke: '#4CAF50', strokeWidth: 2 },
    NODE_WIDTH: LAYOUT_CONFIG.GROUP_WIDTH - (LAYOUT_CONFIG.NODE_PADDING_X * 2),
};