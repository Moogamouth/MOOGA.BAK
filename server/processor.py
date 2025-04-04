from requests.exceptions import HTTPError
from itertools import islice
import os
import internetarchive
import subprocess
import hashlib
import shutil
import sqlite3
import urllib

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

with open("start.txt", "r") as f:
    start = int(f.read())

cwd = os.getcwd()
downloads = os.path.join(cwd, "downloads")
compressed = os.path.join(cwd, "archive.zpaq")
archive = os.path.join(cwd, "archive")

search = internetarchive.search_items("*", sorts=["addeddate asc"])
search = islice(search, start, None)
for i, result in enumerate(search):
    if get_folder_size(downloads) > 100 * 1024 * 1024:
        break
    id = result["identifier"]
    try:
        files = internetarchive.get_item(id).files
        original_files = [file for file in files if file["source"] == "original" or file["name"] == id + "_meta.xml"]
        item_path = os.path.join(downloads, id)
        os.makedirs(item_path, exist_ok=True)
        root_url = "https://archive.org/download/" + id + "/"
        for file in original_files:
            url = root_url + urllib.parse.quote(file["name"])
            dir_path = os.path.join(item_path, os.path.dirname(file["name"]))
            os.makedirs(dir_path, exist_ok=True)
            path = os.path.join(dir_path, os.path.basename(file["name"]))
            urllib.request.urlretrieve(url, path)
    except HTTPError as e:
        if e.response.status_code == 403:
            pass
    except urllib.error.HTTPError as e:
        if e.code == 403:
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