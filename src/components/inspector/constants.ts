// src/components/inspector/constants.ts

export const SIDEBAR_WIDTH = 60;

export const EXTRA_STYLES = {
    sectionTitle: { fontSize: '12px', fontWeight: 'bold', color: '#333', marginTop: '16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '4px' },
    scrollArea: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '8px', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px', backgroundColor: '#fafafa', minHeight: '100px', maxHeight: '300px' }
};

export const STYLES = {
    wrapper: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, zIndex: 4000, display: 'flex', pointerEvents: 'none' as const },
    sidebar: { width: SIDEBAR_WIDTH, height: '100%', backgroundColor: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '16px 0', gap: '12px', pointerEvents: 'all' as const, boxShadow: '2px 0 8px rgba(0,0,0,0.02)' },
    detailPanel: { position: 'absolute' as const, left: SIDEBAR_WIDTH + 10, top: 20, bottom: 20, width: 300, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', pointerEvents: 'all' as const, border: '1px solid #f0f0f0' },
    spacer: { flex: 1 },
    iconBtn: (active: boolean, danger: boolean = false) => ({ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: danger ? '#ff4444' : (active ? '#2196F3' : '#555'), backgroundColor: active ? '#E3F2FD' : 'transparent', border: 'none', transition: 'all 0.2s' }),
    bottomControls: { display: 'flex', flexDirection: 'column' as const, gap: '12px', paddingTop: '20px', paddingBottom: '80px', borderTop: '1px solid #f0f0f0', width: '100%', alignItems: 'center' },
    panelHeader: { padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '14px', fontWeight: 600, color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' },
    panelBody: { flex: 1, padding: '16px', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', fontFamily: 'inherit' },
    readOnlyText: { width: '100%', padding: '8px', borderRadius: 6, backgroundColor: '#f5f5f5', border: '1px solid #eee', fontSize: '11px', color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' as const, userSelect: 'all' as const },
    textarea: { width: '100%', minHeight: 80, padding: '8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '13px', lineHeight: 1.5, resize: 'vertical' as const, outline: 'none', fontFamily: 'inherit' },
    row: { display: 'flex', gap: 10, alignItems: 'center' },
    divider: { height: 1, backgroundColor: '#eee', margin: '8px 0' },
    listItem: { padding: '10px', border: '1px solid #eee', borderRadius: 6, backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' as const, gap: 4 },
    createBtn: { padding: '4px 8px', backgroundColor: '#E3F2FD', color: '#1976D2', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }
};