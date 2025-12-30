// src/components/inspector/CommonUI.tsx
import { type LucideIcon } from 'lucide-react';
// 引用刚才创建的 constants.ts
import { STYLES } from './constants';

// --- IconButton ---
interface IconButtonProps {
    icon: LucideIcon;
    active?: boolean;
    danger?: boolean;
    onClick: () => void;
    title: string;
}

export const IconButton = ({ icon: Icon, active = false, danger = false, onClick, title }: IconButtonProps) => (
    <button style={STYLES.iconBtn(active, danger)} onClick={onClick} title={title}>
        <Icon size={20} strokeWidth={2} />
    </button>
);

// --- ReadOnlyField ---
interface ReadOnlyFieldProps {
    label: string;
    value: string | number;
}

export const ReadOnlyField = ({ label, value }: ReadOnlyFieldProps) => (
    <div style={STYLES.formGroup}>
        <div style={STYLES.label}>{label}</div>
        <div style={STYLES.readOnlyText}>{value}</div>
    </div>
);

// --- ControlInput ---
interface ControlInputProps {
    label: string;
    value?: string | number;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    rows?: boolean;
}

export const ControlInput = ({ label, value, onChange, type = "text", placeholder = "", rows = false }: ControlInputProps) => (
    <div style={STYLES.formGroup}>
        <div style={STYLES.label}>{label}</div>
        {rows ? (
            <textarea
                style={STYLES.textarea}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        ) : (
            <input
                type={type}
                style={STYLES.input}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        )}
    </div>
);

// --- ColorPicker ---
interface ColorPickerProps {
    label: string;
    value?: string;
    onChange: (value: string) => void;
}

export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => (
    <div style={STYLES.formGroup}>
        <div style={STYLES.label}>{label}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
                type="color"
                value={value || '#ffffff'}
                onChange={(e) => onChange(e.target.value)}
                style={{ width: 30, height: 30, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{ ...STYLES.input, flex: 1 }}
                placeholder="#RRGGBB"
            />
        </div>
    </div>
);