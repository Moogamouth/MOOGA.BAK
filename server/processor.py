from internetarchive import search_items, download
from requests.exceptions import HTTPError
import os
import subprocess
import hashlib
import shutil
import json

with open("start.txt", "r") as f:
    start = int(f.read())

cwd = os.getcwd()
downloads = os.path.join(cwd, "downloads")
compressed = os.path.join(cwd, "archive.zpaq")
archive = os.path.join(cwd, "archive")

search = search_items("*")
end = start + 1
for i, result in enumerate(search, start=start):
    if i >= end:
        break
    id = result["identifier"]
    try:
        download(id, destdir=downloads)
    except HTTPError as e:
        if e.response.status_code == 403:
            pass

command = ["zpaq", "add", compressed, downloads, "-m5"]
subprocess.run(command, check=True)
shutil.rmtree(downloads)

with open("chunks.json", "r") as f:
    data = json.load(f)
hashes = list(data.keys())
if hashes:
    hash = hashes[-1]
else:
    hash = ""

with open(compressed, "rb") as rf:
    while True:
        buf = rf.read(1024 * 1024)
        if not buf:
            break
        chunk = hash.encode("utf-8") + buf
        hash = hashlib.sha256(chunk).hexdigest()
        path = os.path.join(archive, hash + ".bin")
        with open(path, "wb") as wf:
            wf.write(chunk)

        with open("chunks.json", "r") as f:
            data = json.load(f)
        data[hash] = 0
        with open("chunks.json", "w") as f:
            json.dump(data, f)
        
os.remove(compressed)

with open("start.txt", "w") as f:
    f.write(str(end))