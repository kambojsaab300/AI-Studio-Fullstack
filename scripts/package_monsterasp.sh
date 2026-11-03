#!/usr/bin/env bash
# ============================================================
# Package AI Studio .NET 8 Web API for MonsterASP.net
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$ROOT_DIR/AIStudio.Api"
PUBLISH_DIR="$ROOT_DIR/publish_temp"
ZIP_FILE="$ROOT_DIR/AIStudio-Api-Deploy.zip"

echo "============================================================"
echo "📦 Packaging AI Studio .NET 8 API for MonsterASP.net..."
echo "============================================================"

# Clean previous outputs
rm -rf "$PUBLISH_DIR" "$ZIP_FILE"

# Run dotnet publish in Release mode
echo "⚙️ Building & Publishing in Release mode..."
dotnet publish "$API_DIR/AIStudio.Api.csproj" -c Release -o "$PUBLISH_DIR"

# Check if web.config exists
if [ ! -f "$PUBLISH_DIR/web.config" ]; then
    echo "⚠️ web.config not found, generating standard ASP.NET Core web.config..."
    cat << 'EOF' > "$PUBLISH_DIR/web.config"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\AIStudio.Api.dll" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
EOF
fi

# Create Zip package
echo "🗜️ Creating deployment zip: $ZIP_FILE..."
(cd "$PUBLISH_DIR" && zip -r -q "$ZIP_FILE" .)

# Cleanup temp publish dir
rm -rf "$PUBLISH_DIR"

echo "============================================================"
echo "✅ Deployment package successfully created!"
echo "📁 Location: $ZIP_FILE"
echo "📏 Size: $(du -sh "$ZIP_FILE" | cut -f1)"
echo ""
echo "🚀 Deployment Steps for MonsterASP.net:"
echo "1. Login to MonsterASP.net Control Panel (https://monsterasp.net)."
echo "2. Go to 'Websites' -> Click on your website -> 'File Manager'."
echo "3. Open 'wwwroot' directory."
echo "4. Click 'Upload' and select 'AIStudio-Api-Deploy.zip'."
echo "5. Right click on 'AIStudio-Api-Deploy.zip' -> Click 'Extract'."
echo "6. Test your live API at: https://yourdomain.com/swagger"
echo "============================================================"
