import os

files = [
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Worker.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Worker.jsx"
]

clean_connect_fn = """    const connect = async (overrideUrl) => {
        try {
            const targetUrl = typeof overrideUrl === 'string' ? overrideUrl : (customApiUrl || API_URL);
            const lib = await loadApiClient();
            const client = lib.createClient(targetUrl, apiKey);
            log(`Connecting to ${client.apiUrl}...`);

            // Unique worker id from the DB (worker_1, worker_2 ...). The same tab keeps its id.
            const wanted = sessionStorage.getItem('ai_studio_worker_id');
            const { data, error } = await client.rpc(API.REGISTER_WORKER, { p_wanted: wanted });
            if (error) throw error;
            sessionStorage.setItem('ai_studio_worker_id', data);
            workerIdRef.current = data;
            setWorkerId(data);
            await loadSettings(client);
            setSb(client);
            log(`Connected as ${data}`);
        } catch (err) {
            log('Connect error: ' + err.message);
        }
    };"""

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Find start of libRef_connect or connect
    start_idx = content.find("const libRef_connect = async")
    if start_idx == -1:
        start_idx = content.find("const connect = async () => {")

    if start_idx != -1:
        # End is before useEffect
        end_needle = "// Everything that happens while connected"
        end_idx = content.find(end_needle, start_idx)
        if end_idx != -1:
            content = content[:start_idx] + clean_connect_fn + "\n\n    " + content[end_idx:]

    # Replace any calls to libRef_connect(u) with connect(u)
    content = content.replace("libRef_connect(u)", "connect(u)")

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Cleaned connect() in:", fpath)

print("Done.")
