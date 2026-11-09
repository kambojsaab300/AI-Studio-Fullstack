// ============================================================
// AI Studio: Models & Generation Configurations
// ============================================================

export const IMAGE_SIZES = ['720', '1K', '2K', '4K'];

export const IMAGE_ASPECTS = [
    '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '4:5', '5:4', '21:9'
];

export let MODEL_CAPS = {};

export function safeArray(val, fallback = []) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                // fall through
            }
        }
        if (trimmed) {
            return trimmed.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        }
    }
    return fallback;
}

export const capsOf = (id) => {
    const c = MODEL_CAPS[id];
    if (!c) return { kind: 'text', label: '', aspects: [], sizes: [] };
    const rawSizes = safeArray(c.sizes);
    const sizes = (c.kind === 'image' && rawSizes.length === 0)
        ? ['720', '1K', '2K', '4K']
        : rawSizes;
    return {
        ...c,
        aspects: safeArray(c.aspects),
        sizes
    };
};

export function setModelCaps(rows) {
    MODEL_CAPS = {};
    (rows || []).filter(r => r && r.kind).forEach(r => {
        let parsedSizes = safeArray(r.sizes);
        if (r.kind === 'image') {
            if (parsedSizes.length === 0) {
                parsedSizes = ['720', '1K', '2K', '4K'];
            } else if (!parsedSizes.includes('720')) {
                parsedSizes = ['720', ...parsedSizes];
            }
        }
        MODEL_CAPS[r.model_id] = {
            kind: r.kind,
            label: r.label || r.model_id,
            aspects: safeArray(r.aspects),
            sizes: parsedSizes
        };
    });
}
