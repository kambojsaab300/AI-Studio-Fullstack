import ftplib
import os
import time

FTP_HOST = "site104409.siteasp.net"
FTP_PORT = 21
FTP_USER = "site104409"
FTP_PASS = "o@2BFw=87?Sj"
LOCAL_DIR = r"E:\Mohit\photo tool\AI-Studio-Fullstack\publish_deploy"
ZIP_PATH = r"E:\Mohit\photo tool\AI-Studio-Fullstack\AIStudio-Api-Deploy.zip"

def get_ftp():
    ftp = ftplib.FTP()
    ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    return ftp

def deploy():
    print("Connecting to FTP...")
    ftp = get_ftp()
    print("Connected.")
    ftp.cwd("/wwwroot")

    # Step 1: Put app_offline.htm to safely release IIS locks
    print("1. Uploading app_offline.htm...")
    offline_content = b"<html><body>App is updating...</body></html>"
    from io import BytesIO
    ftp.storbinary("STOR app_offline.htm", BytesIO(offline_content))
    time.sleep(2)

    # Step 2: Delete old files in wwwroot to prevent conflict with 300+ old self-contained DLLs
    print("2. Cleaning old DLLs and binaries...")
    try:
        entries = []
        ftp.retrlines("NLST", entries.append)
        for item in entries:
            if item in [".", "..", "app_offline.htm", "logs"]:
                continue
            try:
                # try file delete
                ftp.delete(item)
            except Exception:
                try:
                    # try folder delete
                    ftp.rmd(item)
                except Exception:
                    pass
    except Exception as e:
        print("Note on cleanup:", e)

    # Ensure logs folder exists
    try:
        ftp.mkd("logs")
    except Exception:
        pass

    # Step 3: Upload files recursively
    print("3. Uploading publish files...")
    upload_count = 0

    def upload_dir(local_path, remote_path):
        nonlocal upload_count
        for item in os.listdir(local_path):
            l_item = os.path.join(local_path, item)
            r_item = f"{remote_path}/{item}" if remote_path else item
            if os.path.isdir(l_item):
                try:
                    ftp.mkd(r_item)
                except Exception:
                    pass
                upload_dir(l_item, r_item)
            else:
                with open(l_item, "rb") as f:
                    ftp.storbinary(f"STOR {r_item}", f)
                upload_count += 1
                if upload_count % 10 == 0:
                    print(f"Uploaded {upload_count} files...")

    upload_dir(LOCAL_DIR, "")
    print(f"All {upload_count} files uploaded successfully!")

    # Step 4: Upload zip package as well for user convenience
    print("4. Uploading AIStudio-Api-Deploy.zip...")
    with open(ZIP_PATH, "rb") as f:
        ftp.storbinary("STOR AIStudio-Api-Deploy.zip", f)
    print("Zip package uploaded.")

    # Step 5: Remove app_offline.htm to bring site online
    print("5. Removing app_offline.htm to bring app ONLINE...")
    try:
        ftp.delete("app_offline.htm")
    except Exception as e:
        print("Error removing app_offline.htm:", e)

    ftp.quit()
    print("Deployment finished successfully!")

if __name__ == "__main__":
    deploy()
