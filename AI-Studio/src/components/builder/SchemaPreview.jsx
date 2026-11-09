import React, { useState } from 'react';
import { Database, Copy, Check, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { copyToClipboard } from '../../utils/formatters';

// Photo slot -> request field the customer API expects
const SLOT_FIELD = { face: 'face_image_url', style: 'style_image_url', input: 'input_image_url' };

// Colour per tab so request vs response vs DB rows are easy to tell apart
const TAB_STYLE = {
    request: { active: 'bg-sky-500 text-white', code: 'border-sky-500/30' },
    response: { active: 'bg-emerald-500 text-white', code: 'border-emerald-500/30' },
    catalog: { active: 'bg-violet-500 text-white', code: 'border-violet-500/30' },
    prompt: { active: 'bg-fuchsia-500 text-white', code: 'border-fuchsia-500/30' }
};

// Tiny JSON highlighter: keys, strings, numbers, true/false/null each get their own colour
function JsonView({ text }) {
    const parts = [];
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
        if (m.index > last) parts.push(<span key={last} className="text-slate-500">{text.slice(last, m.index)}</span>);
        if (m[1] && m[2]) {
            parts.push(<span key={m.index} className="text-sky-300">{m[1]}</span>);
            parts.push(<span key={m.index + 'c'} className="text-slate-500">{m[2]}</span>);
        } else if (m[1]) {
            parts.push(<span key={m.index} className="text-emerald-300">{m[1]}</span>);
        } else if (m[3]) {
            parts.push(<span key={m.index} className="text-fuchsia-300">{m[3]}</span>);
        } else {
            parts.push(<span key={m.index} className="text-orange-300">{m[4]}</span>);
        }
        last = re.lastIndex;
    }
    if (last < text.length) parts.push(<span key={last} className="text-slate-500">{text.slice(last)}</span>);
    return <code>{parts}</code>;
}

export function SchemaPreview({ builderForm, inputs, labels, optional }) {
    const [tab, setTab] = useState('request'); // 'request' | 'response' | 'catalog' | 'prompt'
    const [copied, setCopied] = useState(false);

    const slug = builderForm.task_type || '<tool_slug>';
    const isImage = builderForm.output === 'image';
    const hasExtras = !!builderForm.hasExtras;
    const perPhoto = hasExtras && !!builderForm.perPhoto;
    const faceScore = isImage && builderForm.hasFace && !!builderForm.faceCheck;

    // ── What the client sends (POST /api/customer/tasks, header X-Api-Key) ──
    const requestPayload = {
        task_type: slug,
        model: isImage ? 'gemini-3.1-flash-image-preview' : 'gemini-3-flash-preview',
        prompt: builderForm.promptRequired ? '<required: describe what you want>' : '<optional extra instruction>',
        ...Object.fromEntries(inputs.map(k => [SLOT_FIELD[k], `https://.../${k}.jpg`])),
        ...(hasExtras ? { extra_image_urls: ['https://.../photo1.jpg', 'https://.../photo2.jpg', '... up to 50'] } : {}),
        ...(isImage ? { aspect_ratio: '3:4', image_size: '720' } : {}),
        ...(isImage && !perPhoto ? { batch_count: 1 } : {}),
        user_id: '<your customer id>'
    };

    // ── What the client gets back ──
    const createdResponse = { id: 123, status: 'pending' };
    const doneResponse = isImage
        ? {
            id: 123,
            status: 'done',
            output_image_url: 'https://res.cloudinary.com/.../result1.jpg',
            output_image_urls: perPhoto
                ? ['https://.../result-for-photo1.jpg', 'https://.../result-for-photo2.jpg']
                : ['https://res.cloudinary.com/.../result1.jpg'],
            ...(faceScore ? { face_match_score: 92 } : {}),
            error: null
        }
        : { id: 123, status: 'done', output_text: '<model answer text>', error: null };
    const responseDoc = {
        '1_on_create': createdResponse,
        '2_poll_until_done': `GET /api/customer/tasks?userId=<your customer id>  (status: pending -> processing -> done | failed)`,
        '3_when_done': doneResponse
    };

    const catalogPayload = {
        task_type: slug,
        label: builderForm.label || '<Display Name>',
        customer_label: builderForm.customer_label || builderForm.label || '<Customer App Name>',
        hint: builderForm.hint || '<Short hint description>',
        output: builderForm.output,
        inputs,
        labels,
        optional,
        extras: hasExtras,
        prompt_required: !!builderForm.promptRequired,
        face_check: !!builderForm.faceCheck,
        family: false,
        per_photo: !!builderForm.perPhoto,
        customer_visible: true,
        enabled: !!builderForm.enabled
    };

    const promptPayload = {
        task_type: slug,
        system_text: builderForm.system_text,
        role_text: builderForm.role_text,
        negative_text: builderForm.negative_text,
        enabled: builderForm.enabled
    };

    const contentByTab = {
        request: requestPayload,
        response: responseDoc,
        catalog: catalogPayload,
        prompt: promptPayload
    };
    const activeContent = JSON.stringify(contentByTab[tab], null, 2);

    const handleCopy = () => {
        copyToClipboard(activeContent, () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Plain-language summary: what goes in, what comes out
    const sendItems = [
        ...inputs.map(k => ({ text: labels[k] || k, code: SLOT_FIELD[k] })),
        ...(hasExtras ? [{ text: '1 to 50 photos', code: 'extra_image_urls' }] : []),
        { text: builderForm.promptRequired ? 'Prompt (required)' : 'Prompt (optional)', code: 'prompt' }
    ];
    const getItems = isImage
        ? [
            { text: perPhoto ? 'One photo per uploaded photo' : 'Generated photo(s)', code: 'output_image_urls' },
            ...(faceScore ? [{ text: 'Face match score 0-100', code: 'face_match_score' }] : [])
        ]
        : [{ text: 'Text answer', code: 'output_text' }];

    const tabs = [
        ['request', 'Request'],
        ['response', 'Response'],
        ['catalog', 'Catalog row'],
        ['prompt', 'Prompt row']
    ];

    return (
        <section className="bg-[#161616] border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                        <Database className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-bold text-white">Tool API Preview</h3>
                        <p className="text-[10px] text-slate-400 font-mono">What to send, and what comes back</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="h-7 px-2.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-all"
                >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>

            {/* Summary: send vs get */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-sky-500/[0.06] border border-sky-500/30 border-l-4 border-l-sky-400 rounded-xl p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-300 mb-2">
                        <ArrowUpRight className="w-3.5 h-3.5" /> You send
                    </p>
                    <ul className="space-y-1.5">
                        {sendItems.map(item => (
                            <li key={item.code} className="text-xs text-white">
                                {item.text}
                                <code className="block text-[10px] font-mono text-sky-300/80">{item.code}</code>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-emerald-500/[0.06] border border-emerald-500/30 border-l-4 border-l-emerald-400 rounded-xl p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300 mb-2">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> You get
                    </p>
                    <ul className="space-y-1.5">
                        {getItems.map(item => (
                            <li key={item.code} className="text-xs text-white">
                                {item.text}
                                <code className="block text-[10px] font-mono text-emerald-300/80">{item.code}</code>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#0f0f0f] p-1 rounded-xl border border-slate-800 text-[11px]">
                {tabs.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all truncate ${
                            tab === id ? `${TAB_STYLE[id].active} shadow-sm` : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'request' && (
                <p className="text-[11px] text-slate-400 font-mono">
                    POST /api/customer/tasks · header <span className="text-slate-200">X-Api-Key: &lt;app key&gt;</span>
                </p>
            )}

            {/* Code Block */}
            <pre className={`bg-[#0f0f0f] border ${TAB_STYLE[tab].code} rounded-xl p-3 text-[11px] font-mono overflow-x-auto max-h-[460px] scrollbar-thin leading-relaxed`}>
                <JsonView text={activeContent} />
            </pre>
        </section>
    );
}

export default SchemaPreview;
