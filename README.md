# AI Studio - Fullstack Suite

An enterprise-ready AI Studio management platform featuring:
- **Frontend App**: Interactive Admin, Customer, and Worker dashboards built with React and Vite.
- **Backend API**: High-performance ASP.NET Core 8 Web API with MSSQL database integration.
- **Tunnel Automation**: Cloudflare & Localtunnel automation for instant public access and live testing.

---

## 📁 Project Architecture & Structure

```
AI Studio/
├── AI-Studio/                 # React Frontend Application
│   ├── app/                   # Dashboards & Components
│   │   ├── AI Studio Admin.jsx
│   │   ├── AI Studio Customer.jsx
│   │   ├── AI Studio Worker.jsx
│   │   └── apiClient.js       # Centralized REST API client
│   ├── db/                    # SQL Database Schemas & Migrations
│   │   ├── ai_studio_mssql_migration.sql
│   │   └── ...
│   ├── docs/                  # API, architecture & migration docs
│   └── preview/               # HTML preview sandbox
├── AIStudio.Api/              # ASP.NET Core 8 Web API
│   ├── Controllers/           # REST Endpoints (Admin, Customer, Worker, Auth, Tasks)
│   ├── Models/                # Data Models & Entities
│   ├── Services/              # Business Logic & Database Services
│   ├── Program.cs             # ASP.NET Core configuration & Middleware
│   └── appsettings.json       # App configuration & DB connection
├── scripts/                   # Utility & tunnel scripts
│   └── start_tunnels.sh       # Cloudflare & Localtunnel live launcher
├── package.json               # Root Vite runtime scripts & dependencies
└── vite.local.mjs             # Vite development server configuration
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ & npm
- **.NET SDK**: .NET 8.0 SDK
- **SQL Server**: Access to MSSQL (configured in `appsettings.json`)
- *(Optional)* `cloudflared` and `localtunnel` for public tunneling

---

### 2. Running the .NET 8 Backend API
Navigate to the API folder and start the server:
```bash
cd AIStudio.Api
dotnet restore
dotnet run --urls http://0.0.0.0:5005
```
The API Swagger documentation will be accessible at:
- `http://localhost:5005/swagger` (in development mode)

---

### 3. Running the React Frontend
In the root directory, install dependencies and start the Vite development server:
```bash
npm install
npm run dev
```
Open your browser at:
- `http://localhost:5174`

---

### 4. Running Public Live Tunnels
To expose both the Frontend portal and .NET Backend API to the public internet using Cloudflare and Localtunnel:
```bash
./scripts/start_tunnels.sh
```

---

## ☁️ Deploying .NET API via Git (Render.com - 100% Free & Automated)

The repository is pre-configured with a production [`Dockerfile`](file:///Users/mohitkamboj/Desktop/AI%20Studio/Dockerfile) and [`render.yaml`](file:///Users/mohitkamboj/Desktop/AI%20Studio/render.yaml) Blueprint:

1. Sign up / Log in to **[Render.com](https://render.com)** (sign in with your GitHub account).
2. Click **New +** ➔ **Blueprint** (or **Web Service**).
3. Select your repository: `kambojsaab300/AI-Studio-Fullstack`.
4. Click **Apply / Deploy**.
5. Render will automatically build the Docker container and provide you with a permanent public HTTPS URL (e.g. `https://aistudio-api.onrender.com`).
   - Swagger will be live at: `https://aistudio-api.onrender.com/swagger`
   - Every `git push` to `main` will automatically re-deploy the API!

---

## 🌐 Deploying .NET API to MonsterASP.net

### Option A: 1-Click Zip Upload (Fastest)
1. Run the local packaging script:
   ```bash
   ./scripts/package_monsterasp.sh
   ```
2. Log into your [MonsterASP.net Control Panel](https://monsterasp.net).
3. Navigate to **Websites** -> Select your website -> **File Manager**.
4. Open the `wwwroot` folder and click **Upload**.
5. Select `AIStudio-Api-Deploy.zip`.
6. Right-click on the uploaded zip and click **Extract**.
7. Test the live API by navigating to:
   - `https://your-site.monsterasp.net/` (Health check)
   - `https://your-site.monsterasp.net/swagger` (Interactive API Documentation)

### Option B: Automatic GitHub Actions CI/CD (Push to Deploy)
Every push to `main` triggers `.github/workflows/deploy-monsterasp.yml`:
1. It automatically builds and tests the .NET 8 API in Release mode.
2. It publishes the `AIStudio-Api-Deploy-Package` artifact to GitHub Actions.
3. To enable 100% automated push-to-deploy, go to your GitHub repo -> **Settings** -> **Secrets and variables** -> **Actions** and add:
   - `MONSTERASP_FTP_SERVER` (e.g. `ftp.yourdomain.com` or IP)
   - `MONSTERASP_FTP_USERNAME`
   - `MONSTERASP_FTP_PASSWORD`
Now whenever you run `git push origin main`, GitHub will build and deploy the API automatically to MonsterASP.net!

---

## 🔒 Security & Configuration
- Database connection strings and JWT signing credentials are configured in `AIStudio.Api/appsettings.json`.
- Restrict sensitive credentials prior to deploying to open environments.

---

## 📄 License
ISC
