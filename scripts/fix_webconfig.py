import ftplib
import io

config = """<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\\AIStudio.Api.dll" stdoutLogEnabled="true" stdoutLogFile=".\\logs\\stdout" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>""".encode("utf-8")

ftp = ftplib.FTP()
ftp.connect("site104409.siteasp.net", 21, timeout=10)
ftp.login("site104409", "o@2BFw=87?Sj")
ftp.set_pasv(True)
ftp.cwd("/wwwroot")
ftp.storbinary("STOR web.config", io.BytesIO(config))
print("web.config uploaded without BOM!")
ftp.quit()
