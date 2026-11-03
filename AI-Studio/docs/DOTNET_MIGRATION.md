# AI Studio: .NET Core & SQL Server Migration Guide

## 1. Overview
The AI Studio backend has been migrated from Supabase (PostgreSQL) to a high-performance **ASP.NET Core Web API** running on **.NET 8.0** backed by **Microsoft SQL Server**.

---

## 2. Database Connection
- **Server:** `db77541.public.databaseasp.net`
- **Database:** `db77541`
- **User Id:** `db77541`
- **Connection String:**
  ```text
  Server=db77541.public.databaseasp.net; Database=db77541; User Id=db77541; Password=e_5Y@4Cw7r!K; Encrypt=True; TrustServerCertificate=True; MultipleActiveResultSets=True;
  ```

---

## 3. Database Schema
All 17 tables and views were converted to standard T-SQL and deployed:
1. `ai_studio_users` - Authentication (email, password hash, role)
2. `ai_studio_admins` - Admin user mappings
3. `ai_studio_settings` - Global engine concurrency, limits & timeouts
4. `ai_studio_secrets` - ImgBB & Brevo API keys
5. `ai_studio_models` - Models catalog & supported aspect ratios/sizes
6. `ai_studio_tools` - Tools list (chat, image)
7. `ai_studio_tool_types` - Task type to tool mappings
8. `ai_studio_task_catalog` - 44 task definitions with inputs, labels & flags
9. `ai_studio_family_roles` - Configurable family members/slots
10. `ai_studio_apps` - Multi-app support (WearGen, PPP)
11. `ai_studio_app_tasks` - App to feature mappings
12. `ai_studio_prompts` - 37 prompt templates with system, role & negative text
13. `ai_studio_tasks` - Core tasks queue, results & execution metadata
14. `ai_studio_workers` - Active worker nodes & configuration
15. `ai_studio_usage` - Daily Gemini usage & quota tracking
16. `ai_studio_admin_log` - Audit trail
17. `ai_studio_alert_log` - System alerts & cooldown log
18. `ai_studio_worker_load` (VIEW) - Realtime worker load aggregator

---

## 4. .NET Core Web API (`AIStudio.Api`)
- **Port:** `http://localhost:5005`
- **Swagger Documentation:** `http://localhost:5005/swagger`
- **Architecture:**
  - `Controllers/AuthController.cs`: JWT Authentication (`/api/auth/login`, `/api/auth/signup`, `/api/auth/is-admin`)
  - `Controllers/CustomerController.cs`: Customer task generation & catalog queries
  - `Controllers/AdminController.cs`: Admin tools, settings, worker controls & task monitoring
  - `Controllers/WorkerController.cs`: High throughput worker registration, heartbeat, claim & completion
  - `Controllers/RpcController.cs` & `RestController.cs`: Full backward-compatibility layer for Supabase RPC and table query syntax

---

## 5. Frontend Client Adapter (`apiClient.js`)
Located at `AI-Studio/app/apiClient.js`:
- Direct drop-in replacement for `@supabase/supabase-js`.
- Implements:
  - `createClient(url, key)`
  - `auth.signInWithPassword`, `auth.signUp`, `auth.signOut`, `auth.getSession`
  - `from(table).select().order().limit().eq().insert().update().delete()`
  - `rpc(functionName, params)`
  - `channel(name).on().subscribe()`

---

## 6. How to Run

### Step 1: Start Backend API
```bash
cd "AIStudio.Api"
dotnet run
```
Runs at: `http://localhost:5005`

### Step 2: Start Frontend
```bash
npm run dev
```
Runs at: `http://localhost:5174`

- **Portal Hub:** http://localhost:5174/
- **Customer App:** http://localhost:5174/customer.html
- **Admin App:** http://localhost:5174/admin.html
- **Worker App:** http://localhost:5174/worker.html

---

## 7. Configured User Credentials
- **Admin Account:**
  - Email: `mohit@gmail.com`
  - Password: `12345678`
  - Role: `admin` (`is_admin: true` in `ai_studio_users` and present in `ai_studio_admins`)
- **Customer Accounts:**
  - Email: `raman@gmai.com`
  - Email: `raman@gmail.com`
  - Password: `12345678`
  - Role: `customer` (`is_admin: false`)

---

## 8. Verification & Test Suite
All core flows and integration tests have been run and verified:
1. **Admin & Customer Login**: JWT generation, metadata extraction, role assignment.
2. **Admin Permission Verification**: `is_ai_studio_admin` checks bearer JWT token against `ai_studio_admins` table.
3. **Worker Life-Cycle**:
   - `register_ai_studio_worker`: returns auto-incremented worker ID (`worker_x`).
   - `get_worker_config`: loads concurrency settings, budget, limits, and dynamic `model_caps`.
   - `get_task_prompts`: returns all 37 prompt templates.
   - `get_task_catalog`: returns all 44 feature types.
   - `get_family_roles`: returns family member slots.
4. **Task Processing Pipeline**:
   - `customer_create_task`: inserts new task into queue.
   - `claim_ai_studio_task`: atomic lock returning `[{ id }]` matching worker expectation.
   - `worker_complete_task`: atomic completion saving outputs, process time, and face match scores.
5. **PostgREST Query Compatibility**:
   - Supports filtering (`eq`, `neq`, `in`, `is`), pagination (`offset`, `limit`, `range`), sorting (`order`), and count inspection (`head=true`, `Content-Range`).

---

## 9. Live Public Tunnels (Mobile & Wireless Testing)
Both Backend API (port 5005) and Frontend Vite Portal (port 5174) can be exposed to public URLs for mobile and remote testing using Cloudflare Tunnel and Localtunnel:

- **Launch Command:**
  ```bash
  ./scripts/start_tunnels.sh
  ```
- **Active Cloudflare Tunnels (High speed, zero interstitial):**
  - **Portal Hub:** `https://achieve-expansion-episode-deal.trycloudflare.com`
  - **Customer Portal:** `https://achieve-expansion-episode-deal.trycloudflare.com/customer.html`
  - **Admin Portal:** `https://achieve-expansion-episode-deal.trycloudflare.com/admin.html`
  - **Worker Portal:** `https://achieve-expansion-episode-deal.trycloudflare.com/worker.html`
  - **.NET API Backend:** `https://pilot-zealand-subject-guitars.trycloudflare.com`
