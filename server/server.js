const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const server = http.createServer();
const wss = new WebSocket.Server({server});

const archivePath = path.join(__dirname, "archive")

let users = {}
let chunks = {}

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        const {username, password, currentChunks} = data;
        ws.username = username;
        users = JSON.parse(fs.readFileSync("users.json", "utf8"));
        if (!users[ws.username]) {
            users[ws.username] = {password: password, lastSeen: Date.now(), allChunks: [], currentChunks: []};
        }
        users[ws.username].currentChunks = currentChunks || [];
        users[ws.username].currentChunks = users[ws.username].currentChunks.filter(hash => allChunks.includes(hash));
        fs.writeFileSync("users.json", JSON.stringify(users), "utf8");

        if (password === users[ws.username].password) {
            setInterval(() => {
                chunks = JSON.parse(fs.readFileSync("chunks.json", "utf8"));
                const hash = Object.entries(chunks).reduce((lowest, [key, value]) => {
                    return value < lowest[1] ? [key, value] : lowest;
                }, [null, Infinity])[0];
                fs.writeFileSync("chunks.json", JSON.stringify(chunks), "utf8");
                const filename = hash + ".bin";
                const filePath = path.join(archivePath, hash + ".bin");

                const fileData = fs.readFileSync(filePath, "utf8");
                ws.send(JSON.stringify({event: "upload", filename: filename, fileData: fileData}));
                users = JSON.parse(fs.readFileSync("users.json", "utf8"));
                if (!users[ws.username].allChunks.includes(hash)) {
                    users[ws.username].allChunks.push(hash);
                }
                users[ws.username].currentChunks.push(hash);
                fs.writeFileSync("users.json", JSON.stringify(users), "utf8");
                chunks = JSON.parse(fs.readFileSync("chunks.json", "utf8"));
                chunks[hash]++;
                fs.writeFileSync("chunks.json", JSON.stringify(chunks), "utf8");
            }, 10000);
        } else {
            ws.close();
        }
    });

    ws.on("close", () => {
        users = JSON.parse(fs.readFileSync("users.json", "utf8"));
        if (users[ws.username]) {
            users[ws.username].lastSeen = Date.now();
        }
        fs.writeFileSync("users.json", JSON.stringify(users), "utf8");
    });
});

server.listen(8080);

setInterval(() => {
    users = JSON.parse(fs.readFileSync("users.json", "utf8"));
    chunks = JSON.parse(fs.readFileSync("chunks.json", "utf8"));
    Object.entries(users).forEach(([username, user]) => {
        if (Date.now() - user.lastSeen > 2592000000 && Array.from(wss.clients).some((client) => client.username === username)) {
            users[username].currentChunks.forEach((hash) => {
                chunks[hash]--;
            });
            users[username].currentChunks = [];
        }
    });
    fs.writeFileSync("users.json", JSON.stringify(users), "utf8");
    fs.writeFileSync("chunks.json", JSON.stringify(chunks), "utf8");
}, 604800000);