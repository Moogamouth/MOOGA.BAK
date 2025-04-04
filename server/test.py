import internetarchive
import os
from requests.exceptions import HTTPError
import urllib
from itertools import islice

def get_folder_size(path):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

cwd = os.getcwd()
downloads = os.path.join(cwd, "downloads")
compressed = os.path.join(cwd, "archive.zpaq")
archive = os.path.join(cwd, "archive")

search = internetarchive.search_items("*", sorts=["addeddate asc"])
search = islice(search, 1000, None)
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