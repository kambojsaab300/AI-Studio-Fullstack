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

    # 1. Update slice(0, 80) to slice(0, 30) with MAX_LOGS
    old_log = """    const log = useCallback((text) => {
        setLogs(prev => [{ t: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 80));
    }, []);"""

    new_log = """    const MAX_LOGS = 30; // 30 records ke baad purana log automatic clear/trim ho jayega
    const log = useCallback((text) => {
        setLogs(prev => [{ t: new Date().toLocaleTimeString(), text }, ...prev].slice(0, MAX_LOGS));
    }, []);"""

    if old_log in content:
        content = content.replace(old_log, new_log)

    # 2. Add log counter and clear button in Console header
    old_header = """                    <h2 className="text-xs font-extrabold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Console & Activity Log
                    </h2>"""

    new_header = """                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-extrabold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Console & Activity Log
                        </h2>
                        <span className="text-[10px] text-stone-400 font-mono">({logs.length}/30 max)</span>
                        {logs.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setLogs([])}
                                className="text-[10px] text-stone-400 hover:text-yellow-300 underline font-mono ml-1"
                                title="Abhi log saaf karein"
                            >
                                Clear
                            </button>
                        )}
                    </div>"""

    if old_header in content:
        content = content.replace(old_header, new_header)

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Updated 30-record auto clear in:", fpath)

print("Done.")
