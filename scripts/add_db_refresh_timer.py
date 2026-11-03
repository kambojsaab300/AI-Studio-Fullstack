import os

files = [
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Worker.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Worker.jsx"
]

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add states for DB refresh countdown
    old_state = "    const [running, setRunning] = useState(0);"
    new_state = """    const [running, setRunning] = useState(0);
    const [refreshIntervalSec, setRefreshIntervalSec] = useState(() => Math.round(RUNTIME.fallback_ms / 1000) || 2);
    const [nextDbSec, setNextDbSec] = useState(() => Math.round(RUNTIME.fallback_ms / 1000) || 2);
    const [lastDbFetch, setLastDbFetch] = useState('');"""
    if old_state in content and "nextDbSec" not in content:
        content = content.replace(old_state, new_state)

    # 2. Add countdown effect
    old_effect_needle = "    // The screen log is cleared every 10 minutes."
    new_effect = """    // Live countdown timer for DB refresh interval
    useEffect(() => {
        if (!sb) return;
        const timer = setInterval(() => {
            setNextDbSec(prev => (prev > 1 ? prev - 1 : refreshIntervalSec));
        }, 1000);
        return () => clearInterval(timer);
    }, [sb, refreshIntervalSec]);

    // The screen log is cleared every 10 minutes."""
    if old_effect_needle in content and "Live countdown timer for DB refresh interval" not in content:
        content = content.replace(old_effect_needle, new_effect)

    # 3. Update loadSettings to sync refreshIntervalSec from DB settings
    old_apply_runtime = "        applyRuntime(data);\n        setSettings(data);"
    new_apply_runtime = """        applyRuntime(data);
        setSettings(data);
        const fbSec = data?.fallback_sec || Math.round(RUNTIME.fallback_ms / 1000) || 2;
        setRefreshIntervalSec(fbSec);
        setNextDbSec(fbSec);"""
    if old_apply_runtime in content:
        content = content.replace(old_apply_runtime, new_apply_runtime)

    # 4. In kick(), record last DB fetch timestamp and reset next countdown
    old_kick_start = """        if (settingsRef.current.budget_left === 0) return;
        if (inFlight.current.size >= (settingsRef.current.task_concurrency || 1)) return;   // no free slot: do not ask the DB
        try {"""
    new_kick_start = """        if (settingsRef.current.budget_left === 0) return;
        if (inFlight.current.size >= (settingsRef.current.task_concurrency || 1)) return;   // no free slot: do not ask the DB
        setLastDbFetch(new Date().toLocaleTimeString());
        setNextDbSec(refreshIntervalSec);
        try {"""
    if old_kick_start in content:
        content = content.replace(old_kick_start, new_kick_start)

    # 5. Enhance the Console / Log section with DB Refresh timing badge
    old_log_section = """            {/* Log */}
            <section className="bg-stone-900 border border-white/10 rounded-2xl p-4 space-y-2">
                <h2 className="text-xs font-extrabold flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Log</h2>
                <div className="max-h-56 overflow-auto space-y-1 font-mono text-[11px] text-stone-300">"""

    new_log_section = """            {/* Console & Activity Log */}
            <section className="bg-stone-900 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <h2 className="text-xs font-extrabold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Console & Activity Log
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            DB Refresh: Har {refreshIntervalSec}s me
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-stone-800 border border-white/10 text-stone-300 font-semibold">
                            Agla DB fetch: <span className="text-yellow-300 font-bold font-mono">{nextDbSec}s</span>
                        </span>
                        {lastDbFetch && (
                            <span className="text-stone-400 text-[10px]">
                                (Aakhri fetch: {lastDbFetch})
                            </span>
                        )}
                    </div>
                </div>
                <div className="max-h-56 overflow-auto space-y-1 font-mono text-[11px] text-stone-300">"""

    if old_log_section in content:
        content = content.replace(old_log_section, new_log_section)

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Updated DB refresh timer in:", fpath)

print("Done.")
