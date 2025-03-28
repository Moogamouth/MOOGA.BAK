from internetarchive import search_items, download
from requests.exceptions import HTTPError
import os
import subprocess
import hashlib
import shutil
import sqlite3

conn = sqlite3.connect("data.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS chunks (
    hash TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
)
""")
conn.commit()

cursor.execute("SELECT hash FROM chunks ORDER BY ROWID DESC LIMIT 1")
row = cursor.fetchone()
hash = row[0] if row else ""

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
subprocess.run(command)

shutil.rmtree(downloads)

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

        cursor.execute("INSERT OR IGNORE INTO chunks (hash) VALUES (?)", (hash,))
        conn.commit()
    
with open("start.txt", "w") as f:
    f.write(str(end))

os.remove(compressed)

conn.close()