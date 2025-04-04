const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ws = new WebSocket("ws://localhost:8080");

let {password, lastExec} = JSON.parse(fs.readFileSync("config.json", "utf8"));
if (!password) {
    password = crypto.randomBytes(16).toString("hex");
}

let currentChunks;
if (Date.now() - lastExec > 1000 * 60 * 60 * 24) {
    currentChunks = fs.readdirSync("chunks");
}

ws.onopen = () => {
    ws.send(JSON.stringify({password, currentChunks: currentChunks}));
};

ws.onmessage = (message) => {
    const {event, filename, fileData} = JSON.parse(message.data);
    if (event === "upload") {
        const filePath = path.join("chunks", filename);
        fs.writeFileSync(filePath, fileData);
    }
};

process.on("SIGINT", () => {
    const config = {password, lastExec: Date.now()};
    fs.writeFileSync("config.json", JSON.stringify(config), "utf8");
    process.exit(0);
});