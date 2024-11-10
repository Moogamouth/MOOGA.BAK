from internetarchive import search_items, download
from tempfile import gettempdir
from requests.exceptions import HTTPError

search = search_items("*")
for result in search:
    id = result["identifier"]
    path = gettempdir() + "\\" + id
    try:
        download(id, destdir=gettempdir())
    except HTTPError as e:
        if e.response.status_code == 403:
            pass