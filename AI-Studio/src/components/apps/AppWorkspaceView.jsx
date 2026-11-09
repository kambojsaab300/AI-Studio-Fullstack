import React, { useState, useMemo, useEffect } from 'react';
import { Terminal, Sliders } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { GenerationSettings } from '../studio/GenerationSettings';
import { PhotoSlotGrid } from '../studio/PhotoSlotGrid';
import { BatchUploader } from '../studio/BatchUploader';
import { PromptSection } from '../studio/PromptSection';
import { ActionPanel } from '../studio/ActionPanel';
import { TaskHistory } from '../history/TaskHistory';
import { ToolCatalogBar } from '../studio/ToolCatalogBar';
import { JsonConsole } from '../studio/JsonConsole';
import { EMPTY_FORM, typeOf } from '../../constants/formDefaults';
import { MODEL_CAPS, capsOf } from '../../constants/models';
import { getToolCategory } from '../../constants/categories';
import { rowFromForm, requestPreview, problemsFor } from '../../utils/taskHelpers';
import { cleanToolLabel } from '../../utils/formatters';
import { createAppService } from '../../api/appService';
import { AppApiModal } from './AppApiModal';
import { useT } from '../../i18n/lang';

export function AppWorkspaceView({ app }) {
    const { sb, catalog, appTasks, models, prompts, syncLiveTasks, setLiveTasks, setMsg } = useAdmin();
    const t = useT();

    const appId = app.app_id;
    const appService = useMemo(() => createAppService(sb), [sb]);
    const [apiModalOpen, setApiModalOpen] = useState(false);

    // Filter ONLY the tools assigned to this App
    const assignedTypes = useMemo(() => {
        return new Set(appTasks.filter(l => l.app_id === appId).map(l => l.task_type));
    }, [appTasks, appId]);

    const assignedTools = useMemo(() => {
        return catalog.filter(t => assignedTypes.has(t.task_type));
    }, [catalog, assignedTypes]);

    const [selectedTaskType, setSelectedTaskType] = useState(() => {
        return assignedTools[0]?.task_type || 'image_to_image_prompt';
    });

    const [form, setForm] = useState(() => ({
        ...EMPTY_FORM,
        task_type: assignedTools[0]?.task_type || 'image_to_image_prompt'
    }));

    const [mobileTab, setMobileTab] = useState('studio'); // 'studio' | 'json'
    const [isGenerating, setIsGenerating] = useState(false);
    const [btnFeedback, setBtnFeedback] = useState(null);

    const type = typeOf(form.task_type);
    const modelOptions = useMemo(() => {
        return Object.keys(MODEL_CAPS).filter(id => capsOf(id).kind === type.kind);
    }, [type.kind, models]);

    const caps = capsOf(form.model) || capsOf(modelOptions[0]);
    const row = useMemo(() => {
        const base = rowFromForm(form);
        return {
            ...base,
            app_id: appId // STAMPED WITH THIS APP'S ID
        };
    }, [form, appId]);

    const problems = useMemo(() => problemsFor(form, row, prompts), [form, row, prompts]);
    const preview = useMemo(() => requestPreview(row, prompts), [row, prompts]);

    const handleSelectTool = (taskType) => {
        setSelectedTaskType(taskType);
        const t = typeOf(taskType);
        const validModels = Object.keys(MODEL_CAPS).filter(id => capsOf(id).kind === t.kind);
        const model = validModels[0] || 'gemini-3.1-flash-image-preview';
        const c = capsOf(model);
        const autoSize = c.sizes?.includes('720') ? '720' : (c.sizes?.[0] || '720');

        setForm(prev => ({
            ...prev,
            task_type: taskType,
            model,
            aspect_ratio: c.kind === 'image' ? (c.aspects?.includes(prev.aspect_ratio) ? prev.aspect_ratio : c.aspects?.[0] || '4:5') : prev.aspect_ratio,
            image_size: c.kind === 'image' ? autoSize : ''
        }));
    };

    // Tools load after the first render, and the first form uses a default model.
    // Keep the form on an assigned tool, with a model that can run it (else: "Is task type ke liye ye model nahi chalega").
    useEffect(() => {
        if (!assignedTools.length) return;
        if (!assignedTypes.has(form.task_type)) {
            handleSelectTool(assignedTools[0].task_type);
        } else if (modelOptions.length && !modelOptions.includes(form.model)) {
            handleSelectTool(form.task_type);
        }
    }, [assignedTools, assignedTypes, form.task_type, form.model, modelOptions]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSendTask = async () => {
        if (problems && problems.length > 0) {
            const errText = problems.join(', ');
            setBtnFeedback({ type: 'error', message: t('❌ Zaroori parameters missing: ', '❌ Required parameters missing: ') + errText });
            setMsg(t('❌ Zaroori parameters missing: ', '❌ Required parameters missing: ') + errText);
            return;
        }

        setIsGenerating(true);
        setBtnFeedback(null);
        try {
            const { success, taskId, error } = await appService.createTask(appId, row);
            if (!success || error) {
                const errMsg = error?.message || error?.error || (typeof error === 'string' ? error : JSON.stringify(error));
                const errText = t('❌ Task create nahi ho saka: ', '❌ Could not create task: ') + errMsg;
                setBtnFeedback({ type: 'error', message: errText });
                setMsg(errText);
                return;
            }

            const successMsg = t(`⚡ Task #${taskId} dispatch ho gaya for App "${app.label}"!`, `⚡ Task #${taskId} dispatched for App "${app.label}"!`);
            setBtnFeedback({ type: 'success', message: successMsg });
            setMsg(successMsg);

            // Optimistic injection into live tasks
            const newTaskObj = {
                id: taskId,
                app_id: appId,
                task_type: row.task_type,
                model: row.model,
                prompt: row.prompt,
                aspect_ratio: row.aspect_ratio,
                image_size: row.image_size,
                status: 'pending',
                created_at: new Date().toISOString(),
                extra_image_urls: row.extra_image_urls,
                face_image_url: row.face_image_url,
                style_image_url: row.style_image_url,
                input_image_url: row.input_image_url
            };
            setLiveTasks(list => [newTaskObj, ...list.filter(x => x.id !== taskId)].slice(0, 50));
            setForm(f => ({ ...f, prompt: '' }));

            setTimeout(syncLiveTasks, 500);
            setTimeout(syncLiveTasks, 2000);
            setTimeout(() => setBtnFeedback(null), 8000);
        } catch (err) {
            const errText = 'Send error: ' + err.message;
            setBtnFeedback({ type: 'error', message: errText });
            setMsg(errText);
        } finally {
            setIsGenerating(false);
        }
    };

    const category = getToolCategory(form.task_type);
    const activeTool = catalog.find(c => c.task_type === form.task_type);
    const steps = [
        { n: 1, title: t('Tool chuno', 'Pick a tool'), text: t('Neeche grid se kaam chuno (category se filter kar sakte ho).', 'Choose a job from the grid below (filter by category).') },
        { n: 2, title: t('Photo / prompt do', 'Add photos / prompt'), text: t('Zaroori photo slots bharo aur prompt likho. Kya baaki hai, wo Generate button ke upar dikhega.', 'Fill the required photo slots and the prompt. Anything missing shows above the Generate button.') },
        { n: 3, title: t('Generate karo', 'Generate'), text: t(`Task "${app.label}" ke naam se worker ko jayega. Result neeche "Is app ke tasks" me aayega.`, `The task goes to a worker under "${app.label}". The result appears below in "This app's tasks".`) },
        { n: 4, title: t('Apne app se chalao', 'Run from your app'), text: t('Right side ka JSON / cURL wahi request hai jo aapka app API se bhejega.', 'The JSON / cURL on the right is the exact request your app sends through the API.') }
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Workspace header */}
            <div className="bg-[#161616] border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl">🚀</span>
                        <h2 className="text-base sm:text-lg font-black text-white">{app.label} Workspace</h2>
                        <span className="text-[11px] font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 px-2 py-0.5 rounded-full">
                            app_id: {app.app_id}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">
                        {t(
                            <>Yahan sirf <span className="text-amber-300 font-bold">{app.label}</span> ko assign kiye tools hain. Har task isi app ke account me save hota hai.</>,
                            <>Only tools assigned to <span className="text-amber-300 font-bold">{app.label}</span> are here. Every task is saved under this app's account.</>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setApiModalOpen(true)}
                        className="h-9 px-3.5 bg-[#0f0f0f] hover:bg-slate-800 text-amber-300 border border-amber-400/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="View API Endpoints and Code Integration"
                    >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>API & SDK</span>
                    </button>
                    <div className="bg-[#0f0f0f] border border-slate-800 rounded-xl px-3 py-1.5 text-center">
                        <span className="text-[10px] text-slate-400 font-mono block">{t('Tools', 'Tools')}</span>
                        <span className="text-sm font-extrabold text-amber-300 font-mono">{assignedTools.length}</span>
                    </div>
                </div>
            </div>

            {/* How to use */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {steps.map(s => (
                    <div key={s.n} className="bg-[#0f0f0f] border border-slate-800/80 rounded-2xl p-3.5 flex gap-3">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center">{s.n}</span>
                        <div className="min-w-0">
                            <p className="text-xs font-extrabold text-white">{s.title}</p>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{s.text}</p>
                        </div>
                    </div>
                ))}
            </section>

            {assignedTools.length === 0 ? (
                <div className="bg-[#161616] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                    <p className="text-sm text-amber-300 font-bold">{t('Is App ko abhi koi tool assign nahi kiya gaya hai.', 'No tool is assigned to this app yet.')}</p>
                    <p className="text-xs text-slate-400">{t(`Upar "Manage Assigned Tools" tab mein ja kar tools assign karein.`, `Go to the "Manage Assigned Tools" tab above to assign tools.`)}</p>
                </div>
            ) : (
                <>
                    {/* 1. Tool picker (same as the admin Studio) */}
                    <ToolCatalogBar
                        catalog={assignedTools}
                        selectedTaskType={form.task_type}
                        onSelectTaskType={handleSelectTool}
                        defaultOpen
                        title={t(`${app.label} ke tools`, `${app.label} tools`)}
                        subtitle={t('Tool par click karo, form neeche khulega', 'Click a tool; its form opens below')}
                    />

                    {/* Mobile switch: form / JSON */}
                    <div className="flex lg:hidden bg-[#161616] p-1 rounded-xl border border-slate-800 text-xs font-bold">
                        {[['studio', t('Tool form', 'Tool form'), Sliders], ['json', t('API request', 'API request'), Terminal]].map(([key, label, Icon]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setMobileTab(key)}
                                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mobileTab === key ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' : 'text-slate-400'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* 2. Form (left) + live API request (right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className={`lg:col-span-7 bg-[#161616] border border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-xl ${mobileTab === 'studio' ? 'block' : 'hidden lg:block'}`}>
                            <div className="border-b border-slate-800/80 pb-3.5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xl">✨</span>
                                        <h3 className="text-sm sm:text-base font-extrabold text-white">
                                            {cleanToolLabel(activeTool?.label || type.label || form.task_type)}
                                        </h3>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 capitalize font-bold">
                                            {category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {activeTool?.hint || t('Photos aur prompt do, phir Generate dabao.', 'Add photos and a prompt, then press Generate.')}
                                    </p>
                                </div>
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                                    {type.output === 'image' ? 'Image Out' : 'Text Out'}
                                </span>
                            </div>

                            <GenerationSettings form={form} setForm={setForm} type={type} caps={caps} modelOptions={modelOptions} />
                            <PhotoSlotGrid type={type} form={form} setForm={setForm} onSetMsg={setMsg} />
                            <BatchUploader type={type} form={form} setForm={setForm} onSetMsg={setMsg} />
                            <PromptSection type={type} form={form} setForm={setForm} />
                            <ActionPanel
                                problems={problems}
                                isGenerating={isGenerating}
                                btnFeedback={btnFeedback}
                                onClearFeedback={() => setBtnFeedback(null)}
                                onSendTask={handleSendTask}
                            />
                        </div>

                        <div className={`lg:col-span-5 lg:sticky lg:top-20 ${mobileTab === 'json' ? 'block' : 'hidden lg:block'}`}>
                            <JsonConsole row={row} preview={preview} onSendTask={handleSendTask} />
                        </div>
                    </div>

                    {/* 3. Results of this app only */}
                    <TaskHistory
                        appId={appId}
                        title={t(`${app.label} ke tasks`, `${app.label} tasks`)}
                        subtitle={t('Sirf is app ke tasks aur results. Row par click karke result dekho.', 'Only this app\'s tasks and results. Click a row to see the result.')}
                    />
                </>
            )}

            {/* API Integration Modal */}
            <AppApiModal
                isOpen={apiModalOpen}
                onClose={() => setApiModalOpen(false)}
                appId={appId}
                appLabel={app.label}
                selectedTool={type}
                samplePayload={row}
            />
        </div>
    );
}

export default AppWorkspaceView;
