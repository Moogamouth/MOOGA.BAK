const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const ws = new WebSocket("ws://localhost:8080");

const chunksPath = path.join(__dirname, "chunks");

ws.onopen = () => {
    ws.send(JSON.stringify({username: "user1", password: "password1", currentChunks: fs.readdirSync(chunksPath)}));
}

ws.onmessage = (message) => {
    const { event, data } = JSON.parse(message);
    if (event === "upload") {
        const { filename, fileData } = data;
        const filePath = path.join(chunksPath, filename);
        fs.writeFileSync(filePath, fileData);
    }
};