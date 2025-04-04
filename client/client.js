const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ws = new WebSocket("ws://localhost:8080");

const chunksPath = path.join(__dirname, "chunks");
const passwordPath = path.join(__dirname, "password.txt");

let password = fs.readFileSync(passwordPath, "utf8");
if (password === "") {
    password = crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(passwordPath, password, "utf8");
}

ws.onopen = () => {
    ws.send(JSON.stringify({password, currentChunks: fs.readdirSync(chunksPath)}));
};

ws.onmessage = (message) => {
    const {event, filename, fileData} = JSON.parse(message.data);
    if (event === "upload") {
        const filePath = path.join(chunksPath, filename);
        fs.writeFileSync(filePath, fileData);
    }
};