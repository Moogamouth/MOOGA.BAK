from requests.exceptions import HTTPError
from itertools import islice
import os
import internetarchive
import subprocess
import hashlib
import shutil
import sqlite3

def get_folder_size(path):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

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

if os.path.exists("start.txt"):
    with open("start.txt", "r") as f:
        start = int(f.read())
else:
    start = 0

search = internetarchive.search_items("*", sorts=["addeddate asc"])
search = islice(search, start, None)
for i, result in enumerate(search):
    if get_folder_size("downloads") > 100:
        break
    id = result["identifier"]
    try:
        item = internetarchive.get_item(id)
        files = item.files
        original_files = [file for file in files if file["source"] == "original" or file["name"] == id + "_meta.xml"]
        for file in original_files:
            item.download(file["name"], destdir="downloads")
    except HTTPError as e:
        if e.response.status_code == 403:
            pass
    start += 1

command = ["zpaq", "add", "archive.zpaq", "downloads", "-m5"]
subprocess.run(command)

shutil.rmtree("downloads")

with open("archive.zpaq", "rb") as rf:
    while True:
        buf = rf.read(10)
        if not buf:
            break
        chunk = hash.encode("utf-8") + buf
        hash = hashlib.sha256(chunk).hexdigest()

        path = os.path.join("archive", hash + ".bin")
        with open(path, "wb") as wf:
            wf.write(chunk)

        cursor.execute("INSERT OR IGNORE INTO chunks (hash) VALUES (?)", (hash,))
        conn.commit()
    
with open("start.txt", "w") as f:
    f.write(str(start))

os.remove("archive.zpaq")

conn.close()