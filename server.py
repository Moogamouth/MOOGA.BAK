from internetarchive import search_items, download
from requests.exceptions import HTTPError
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import subprocess
import hashlib
import shutil
import requests
import random
import socket

cwd = os.getcwd()
downloads = os.path.join(cwd, "downloads")
compressed = os.path.join(cwd, "archive.zpaq")
archive = os.path.join(cwd, "archive")

search = search_items("*")
for result in search:
    id = result["identifier"]
    try:
        download(id, destdir=downloads)
    except HTTPError as e:
        if e.response.status_code == 403:
            pass

command = ["zpaq", "add", compressed, downloads, "-m5"]
subprocess.run(command, check=True)

shutil.rmtree(downloads)

count = 0
hash = ""
megabyte = 1024 * 1024
with open(compressed, "rb") as rfile:
    while True:
        count += 1
        buf = rfile.read(megabyte)
        if not buf:
            break
        chunk = hash.encode("utf-8") + b"\n" + buf
        hash = hashlib.sha256(chunk).hexdigest()
        path = os.path.join(archive, hash + ".bin")
        with open(path, "wb") as wfile:
            wfile.write(chunk)

os.remove(compressed)

clients = set()
all_owners = [set() for _ in range(count)]
height = 1
#when client connects, add IP to clients

while True:
    for i, chunk_owners in enumerate(all_owners):
        for ip in chunk_owners:
            if ip not in clients:
                all_owners[i].remove(ip)
            #"ping":
            #remove from clients and all_owners[i] if no response

            #send chunk if requested
        
        while len(all_owners[i]) < height:
            ip = random.choice(tuple(clients))
            if ip not in all_owners[i]:
                all_owners[i].add(ip)
                #"ping"
    height += 1