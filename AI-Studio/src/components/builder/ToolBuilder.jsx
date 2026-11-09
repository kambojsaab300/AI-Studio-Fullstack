import React, { useState, useMemo } from 'react';
import { Wrench, Plus, Pencil, Save, CheckCircle2, AlertCircle, Loader2, Search, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { SchemaPreview } from './SchemaPreview';
import { TOOL_CATEGORIES, OTHER_CATEGORY, getToolCategory, getToolInfo } from '../../constants/categories';
import { adminApi } from '../../api/adminApi';
import { useT } from '../../i18n/lang';

// Toggle switch row: visible switch + tool-style code tag (e.g. `extras = true`) + helper text
function ToggleRow({ checked, onChange, title, code, hint }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer select-none">
            <span className="relative mt-0.5 shrink-0 w-9 h-5">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-slate-700 transition-colors peer-checked:bg-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400/50" />
                <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-white">{title}</span>
                    <code className="text-[10px] font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-px rounded">
                        {code}
                    </code>
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">{hint}</span>
            </span>
        </label>
    );
}

// Shows the selected tool: its icon, category, status and what it does.
function ToolInfoCard({ tool }) {
    const { Icon, desc, category } = getToolInfo(tool.task_type);
    const enabled = tool.enabled !== false;
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0f0f0f] border border-slate-800">
            <span className="shrink-0 w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 flex items-center justify-center">
                <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-white truncate">{tool.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {category.icon} {category.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${enabled ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' : 'bg-rose-400/10 text-rose-300 border-rose-400/30'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <p className="text-xs text-slate-300">{tool.hint || desc || 'Is tool ka description abhi nahi hai.'}</p>
                <p className="text-[10px] font-mono text-slate-500 truncate">{tool.task_type}</p>
            </div>
        </div>
    );
}

export function ToolBuilder() {
    const { sb, catalog, prompts, loadCatalog, loadConfig, setMsg } = useAdmin();
    const t = useT();

    const [builderForm, setBuilderForm] = useState({
        mode: 'new', // 'new' | 'edit'
        selectedExisting: '',
        task_type: '',
        label: '',
        customer_label: '',
        hint: '',
        output: 'image', // 'image' | 'text'
        category: 'fashion',
        hasFace: true,
        faceLabel: 'Face reference photo',
        faceCheck: true,
        hasStyle: false,
        styleLabel: 'Style reference photo',
        hasInput: false,
        inputLabel: 'Input photo',
        hasExtras: false,
        perPhoto: false,
        promptRequired: false,
        system_text: 'You are an expert commercial photographer and studio artist.',
        role_text: 'Generate a professional commercial studio shot preserving face and attire details.',
        negative_text: 'blurry, low quality, distorted, extra limbs, bad lighting, watermark',
        enabled: true
    });

    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');
    const [toolQuery, setToolQuery] = useState('');

    const catLabel = (id) => TOOL_CATEGORIES.find(c => c.id === id)?.label || id;

    // Searchable tool list for edit mode: matches label, slug, hint and category, all words must match
    const filteredTools = useMemo(() => {
        const terms = toolQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return [...catalog]
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
            .filter(c => {
                if (!terms.length) return true;
                const hay = [
                    c.label, c.customer_label, c.task_type, c.hint,
                    catLabel(getToolCategory(c.task_type))
                ].filter(Boolean).join(' ').toLowerCase();
                return terms.every(term => hay.includes(term));
            });
    }, [catalog, toolQuery]);

    // Edit list grouped by category, in TOOL_CATEGORIES order (unknown slugs go to "Other")
    const groupedTools = useMemo(() => {
        const groups = TOOL_CATEGORIES.filter(c => c.id !== 'all').map(cat => ({ cat, items: [] }));
        const other = { cat: OTHER_CATEGORY, items: [] };
        filteredTools.forEach(t => {
            const group = groups.find(g => g.cat.id === getToolCategory(t.task_type)) || other;
            group.items.push(t);
        });
        return [...groups, other].filter(g => g.items.length > 0);
    }, [filteredTools]);

    const selectedTool = useMemo(
        () => catalog.find(c => c.task_type === builderForm.selectedExisting) || null,
        [catalog, builderForm.selectedExisting]
    );

    const handleSelectExisting = (taskType) => {
        const item = catalog.find(c => c.task_type === taskType);
        if (!item) return;

        const pr = prompts[taskType] || {};
        setBuilderForm({
            mode: 'edit',
            selectedExisting: taskType,
            task_type: item.task_type,
            label: item.label || '',
            customer_label: item.customer_label || item.label || '',
            hint: item.hint || '',
            output: item.output || 'image',
            category: getToolCategory(item.task_type),
            hasFace: (item.inputs || []).includes('face'),
            faceLabel: item.labels?.face || 'Face reference photo',
            faceCheck: !!item.face_check,
            hasStyle: (item.inputs || []).includes('style'),
            styleLabel: item.labels?.style || 'Style reference photo',
            hasInput: (item.inputs || []).includes('input'),
            inputLabel: item.labels?.input || 'Input photo',
            hasExtras: !!item.extras,
            perPhoto: !!item.per_photo,
            promptRequired: !!item.prompt_required,
            system_text: pr.system_text || 'You are an expert commercial photographer and studio artist.',
            role_text: pr.role_text || 'Generate a professional commercial studio shot.',
            negative_text: pr.negative_text || 'blurry, low quality, distorted, extra limbs, bad lighting, watermark',
            enabled: item.enabled !== false
        });
    };

    const inputs = useMemo(() => {
        const list = [];
        if (builderForm.hasFace) list.push('face');
        if (builderForm.hasStyle) list.push('style');
        if (builderForm.hasInput) list.push('input');
        return list;
    }, [builderForm.hasFace, builderForm.hasStyle, builderForm.hasInput]);

    const labels = useMemo(() => {
        const map = {};
        if (builderForm.hasFace) map.face = builderForm.faceLabel;
        if (builderForm.hasStyle) map.style = builderForm.styleLabel;
        if (builderForm.hasInput) map.input = builderForm.inputLabel;
        return map;
    }, [builderForm.hasFace, builderForm.faceLabel, builderForm.hasStyle, builderForm.styleLabel, builderForm.hasInput, builderForm.inputLabel]);

    const optional = [];

    const handleSaveTool = async () => {
        if (!builderForm.task_type.trim()) return setMsg(t('Tool Slug (task_type) zaroori hai', 'Tool Slug (task_type) is required'));
        if (!builderForm.label.trim()) return setMsg(t('Display Label zaroori hai', 'Display Label is required'));
        if (!builderForm.system_text.trim()) return setMsg(t('System Prompt zaroori hai', 'System Prompt is required'));
        if (!builderForm.role_text.trim()) return setMsg(t('Role Prompt zaroori hai', 'Role Prompt is required'));

        setSaving(true);
        setSavedMsg('');
        const taskType = builderForm.task_type.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        try {
            const isExisting = catalog.some(c => c.task_type === taskType);

            // 1. Save Catalog row
            const catalogRow = {
                task_type: taskType,
                label: builderForm.label.trim(),
                customer_label: builderForm.customer_label.trim() || builderForm.label.trim(),
                hint: builderForm.hint.trim() || null,
                output: builderForm.output,
                inputs,
                labels,
                optional,
                extras: !!builderForm.hasExtras,
                prompt_required: !!builderForm.promptRequired,
                face_check: !!builderForm.faceCheck,
                family: false,
                per_photo: !!builderForm.perPhoto,
                customer_visible: true,
                enabled: !!builderForm.enabled,
                updated_at: new Date().toISOString()
            };

            if (isExisting) {
                const { error } = await adminApi.updateCatalogItem(taskType, catalogRow);
                if (error) throw new Error(error.message);
            } else {
                const maxSort = catalog.reduce((max, c) => Math.max(max, c.sort || 0), 0);
                catalogRow.sort = maxSort + 1;
                const { error } = await adminApi.createCatalogItem(catalogRow);
                if (error) throw new Error(error.message);
            }

            // 2. Save Prompt row
            const promptRow = {
                task_type: taskType,
                system_text: builderForm.system_text.trim(),
                role_text: builderForm.role_text.trim(),
                negative_text: builderForm.negative_text.trim(),
                enabled: !!builderForm.enabled,
                updated_at: new Date().toISOString()
            };

            const hasPrompt = !!prompts[taskType];
            const { error: promptErr } = hasPrompt
                ? await adminApi.updatePrompt(taskType, promptRow)
                : await adminApi.createPrompt(promptRow);
            if (promptErr) throw new Error(promptErr.message);

            // 3. Save Tool Types mapping
            const toolRow = {
                task_type: taskType,
                tool: builderForm.output === 'image' ? 'image' : 'chat'
            };
            await adminApi.setToolType(taskType, toolRow.tool);

            // 4. Link with default WearGen app
            if (!isExisting) {
                await adminApi.linkAppTasks('weargen', taskType);
            }

            await loadCatalog();
            await loadConfig();
            setSavedMsg(`✨ Tool "${builderForm.label}" successfully saved to Database!`);
            setTimeout(() => setSavedMsg(''), 5000);
        } catch (err) {
            setMsg('Tool save error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#161616] border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-amber-400" />
                        <span>Interactive Tool Builder & Schema Manager</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Design new AI workflows or modify existing tools. Saves directly to SQL Server & syncs with worker fleet.
                    </p>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center gap-1.5 bg-[#0f0f0f] p-1 rounded-xl border border-slate-800">
                    <button
                        type="button"
                        onClick={() => setBuilderForm(prev => ({ ...prev, mode: 'new', selectedExisting: '', task_type: '', label: '', hint: '' }))}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                            builderForm.mode === 'new' ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Tool</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setBuilderForm(prev => ({ ...prev, mode: 'edit' }))}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                            builderForm.mode === 'edit' ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Existing Tool ({catalog.length})</span>
                    </button>
                </div>
            </div>

            {/* Main Builder Grid: Left Editor (7 Cols) + Right Schema Preview (5 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Tool Configuration Form */}
                <div className="lg:col-span-7 bg-[#161616] border border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-xl">
                    {/* Existing Tool Selector if in Edit Mode */}
                    {builderForm.mode === 'edit' && (
                        <div className="space-y-2.5 bg-amber-400/5 border border-amber-400/20 p-3 rounded-xl">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-bold text-amber-300">Choose existing tool to modify</label>
                                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                    {filteredTools.length} / {catalog.length}
                                </span>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                <input
                                    type="search"
                                    value={toolQuery}
                                    onChange={e => setToolQuery(e.target.value)}
                                    placeholder="Search by name, slug, category or hint..."
                                    className="w-full h-9 bg-[#0f0f0f] border border-amber-400/30 rounded-xl pl-9 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 [&::-webkit-search-cancel-button]:hidden"
                                />
                                {toolQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setToolQuery('')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
                                {filteredTools.length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-6">
                                        No tool matches "{toolQuery}"
                                    </p>
                                ) : groupedTools.map(({ cat, items }) => (
                                    <div key={cat.id} className="space-y-1">
                                        <div className="sticky top-0 z-10 flex items-center gap-2 px-1 py-1.5 bg-[#161616]">
                                            <cat.Icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-300 truncate">{cat.label}</span>
                                            <span className="text-[10px] font-mono text-slate-500">{items.length}</span>
                                            <span className="hidden md:inline text-[10px] text-slate-500 truncate">{cat.desc}</span>
                                        </div>
                                        {items.map(c => {
                                            const active = builderForm.selectedExisting === c.task_type;
                                            const enabled = c.enabled !== false;
                                            const { Icon, desc } = getToolInfo(c.task_type);
                                            return (
                                                <button
                                                    key={c.task_type}
                                                    type="button"
                                                    onClick={() => handleSelectExisting(c.task_type)}
                                                    className={`w-full text-left px-2.5 py-2 rounded-lg border flex items-center gap-3 transition-colors ${
                                                        active
                                                            ? 'bg-amber-400/15 border-amber-400/50'
                                                            : 'bg-[#0f0f0f] border-slate-800 hover:border-slate-600 hover:bg-slate-900'
                                                    }`}
                                                >
                                                    <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${
                                                        active ? 'bg-amber-400/20 border-amber-400/50 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-300'
                                                    }`}>
                                                        <Icon className="w-4 h-4" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={`block text-xs font-bold truncate ${active ? 'text-amber-300' : 'text-white'}`}>
                                                            {c.label}
                                                        </span>
                                                        <span className="block text-[10px] text-slate-400 truncate">
                                                            {c.hint || desc || c.task_type}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className={`shrink-0 w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                                        title={enabled ? 'Enabled' : 'Disabled'}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {builderForm.mode === 'edit' && selectedTool && <ToolInfoCard tool={selectedTool} />}

                    {/* Section 1: Basic Identifiers */}
                    <div className="space-y-3.5">
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-1.5">
                            1. Identifiers & Classification
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    Tool Slug / Task Type Key *
                                </label>
                                <input
                                    type="text"
                                    value={builderForm.task_type}
                                    onChange={e => setBuilderForm({ ...builderForm, task_type: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                                    placeholder="e.g. bridal_saree_studio"
                                    disabled={builderForm.mode === 'edit'}
                                    className="w-full h-9 bg-[#0f0f0f] border border-slate-700 rounded-xl px-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-400 disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    Display Label *
                                </label>
                                <input
                                    type="text"
                                    value={builderForm.label}
                                    onChange={e => setBuilderForm({ ...builderForm, label: e.target.value })}
                                    placeholder="e.g. Bridal Saree Studio"
                                    className="w-full h-9 bg-[#0f0f0f] border border-slate-700 rounded-xl px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                Tool Hint / Description
                            </label>
                            <textarea
                                value={builderForm.hint}
                                onChange={e => setBuilderForm({ ...builderForm, hint: e.target.value })}
                                rows={2}
                                placeholder="Short explanation of what this tool does..."
                                className="w-full bg-[#0f0f0f] border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Output Modality</label>
                                <select
                                    value={builderForm.output}
                                    onChange={e => setBuilderForm({ ...builderForm, output: e.target.value })}
                                    className="w-full h-9 bg-[#0f0f0f] border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                    <option value="image">Image (Generates Visual Photo)</option>
                                    <option value="text">Text (Vision/Chat/Tagging)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Studio Category</label>
                                <select
                                    value={builderForm.category}
                                    onChange={e => setBuilderForm({ ...builderForm, category: e.target.value })}
                                    className="w-full h-9 bg-[#0f0f0f] border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                    {TOOL_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Photo Slots */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-1.5">
                            2. Photo Reference Slots Configuration
                        </h3>

                        <div className="space-y-2">
                            {/* Face slot */}
                            <div className="p-3 bg-[#0f0f0f] border border-slate-800 rounded-xl space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-200 font-bold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={builderForm.hasFace}
                                        onChange={e => setBuilderForm({ ...builderForm, hasFace: e.target.checked })}
                                        className="rounded border-slate-700 text-amber-400 focus:ring-amber-400"
                                    />
                                    <span>Face Reference Photo Slot (`face_image_url`)</span>
                                </label>
                                {builderForm.hasFace && (
                                    <input
                                        type="text"
                                        value={builderForm.faceLabel}
                                        onChange={e => setBuilderForm({ ...builderForm, faceLabel: e.target.value })}
                                        placeholder="Label for face slot"
                                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-300"
                                    />
                                )}
                            </div>

                            {/* Style slot */}
                            <div className="p-3 bg-[#0f0f0f] border border-slate-800 rounded-xl space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-200 font-bold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={builderForm.hasStyle}
                                        onChange={e => setBuilderForm({ ...builderForm, hasStyle: e.target.checked })}
                                        className="rounded border-slate-700 text-amber-400 focus:ring-amber-400"
                                    />
                                    <span>Style / Outfit Reference Photo Slot (`style_image_url`)</span>
                                </label>
                                {builderForm.hasStyle && (
                                    <input
                                        type="text"
                                        value={builderForm.styleLabel}
                                        onChange={e => setBuilderForm({ ...builderForm, styleLabel: e.target.value })}
                                        placeholder="Label for style slot"
                                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-300"
                                    />
                                )}
                            </div>

                            {/* Input photo slot */}
                            <div className="p-3 bg-[#0f0f0f] border border-slate-800 rounded-xl space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-200 font-bold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={builderForm.hasInput}
                                        onChange={e => setBuilderForm({ ...builderForm, hasInput: e.target.checked })}
                                        className="rounded border-slate-700 text-amber-400 focus:ring-amber-400"
                                    />
                                    <span>Input Subject Photo Slot (`input_image_url`)</span>
                                </label>
                                {builderForm.hasInput && (
                                    <input
                                        type="text"
                                        value={builderForm.inputLabel}
                                        onChange={e => setBuilderForm({ ...builderForm, inputLabel: e.target.value })}
                                        placeholder="Label for input slot"
                                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-300"
                                    />
                                )}
                            </div>

                            {/* Multi-upload options (1-50 photos batch) */}
                            <div className="p-3.5 bg-[#0f0f0f] border border-amber-400/25 rounded-xl space-y-3.5">
                                <ToggleRow
                                    checked={builderForm.hasExtras}
                                    onChange={v => setBuilderForm({ ...builderForm, hasExtras: v, perPhoto: v ? builderForm.perPhoto : false })}
                                    title="Allow 1 to 50 Photos Multi-Upload"
                                    code="extras = true"
                                    hint="Customer can upload 1 to 50 photos in one go."
                                />

                                {builderForm.hasExtras && (
                                    <div className="ml-4 pl-4 border-l-2 border-amber-400/30">
                                        <ToggleRow
                                            checked={builderForm.perPhoto}
                                            onChange={v => setBuilderForm({ ...builderForm, perPhoto: v })}
                                            title="One result per uploaded photo"
                                            code="per_photo = true"
                                            hint="Each uploaded photo gets its own generated result."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: AI Prompts */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-1.5">
                            3. AI System Prompts & Negative Constraints
                        </h3>

                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">System Instructions Prompt *</label>
                                <textarea
                                    value={builderForm.system_text}
                                    onChange={e => setBuilderForm({ ...builderForm, system_text: e.target.value })}
                                    rows={2}
                                    className="w-full bg-[#0f0f0f] border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Role / Extraction Prompt *</label>
                                <textarea
                                    value={builderForm.role_text}
                                    onChange={e => setBuilderForm({ ...builderForm, role_text: e.target.value })}
                                    rows={3}
                                    className="w-full bg-[#0f0f0f] border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Negative Constraints Prompt</label>
                                <textarea
                                    value={builderForm.negative_text}
                                    onChange={e => setBuilderForm({ ...builderForm, negative_text: e.target.value })}
                                    rows={2}
                                    className="w-full bg-[#0f0f0f] border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Success Confirmation Toast */}
                    {savedMsg && (
                        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{savedMsg}</span>
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        type="button"
                        onClick={handleSaveTool}
                        disabled={saving}
                        className="w-full h-11 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 active:scale-98 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                                <span>Saving Tool to Database...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 text-slate-950" />
                                <span>Save & Deploy Tool to Fleet</span>
                            </>
                        )}
                    </button>
                </div>

                {/* RIGHT COLUMN: Live Database Schema Preview */}
                <div className="lg:col-span-5 lg:sticky lg:top-20">
                    <SchemaPreview
                        builderForm={builderForm}
                        inputs={inputs}
                        labels={labels}
                        optional={optional}
                    />
                </div>
            </div>
        </div>
    );
}

export default ToolBuilder;
