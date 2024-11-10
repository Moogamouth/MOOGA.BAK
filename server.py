from internetarchive import search_items, download
from tempfile import gettempdir
from requests.exceptions import HTTPError
import subprocess
import os

search = search_items("*")
for result in search:
    id = result["identifier"]
    temp = gettempdir()
    dir_path = os.path.join(temp, "archive")
    zpaq = dir_path + ".zpaq"
    try:
        download(id, destdir=dir_path)
        command = "./zpaq.exe a " + zpaq + " " + dir_path
        subprocess.run(command, shell=True)
    except HTTPError as e:
        if e.response.status_code == 403:
            pass