from internetarchive import search_items, download
from requests.exceptions import HTTPError
import os
import subprocess

cwd = os.getcwd()
downloads = os.path.join(cwd, "downloads")
compressed = os.path.join(cwd, "archive.zpaq")

search = search_items("*")
for result in search:
    break
    id = result["identifier"]
    try:
        download(id, destdir=downloads)
    except HTTPError as e:
        if e.response.status_code == 403:
            pass

#command = ["zpaq", "add", compressed, downloads, "-m2"]
#subprocess.run(command, check=True)

megabyte = 1024 * 1024
with open(compressed, 'rb') as file:
    while True:
        chunk = file.read(megabyte)
        if not chunk:
            break
        print(f"Processing chunk of size {len(chunk)} bytes")