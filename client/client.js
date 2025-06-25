const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ws = new WebSocket("ws://localhost:8080");

let uuid = null;
let lastExec = null;

if (fs.existsSync("config.json")) {
    const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
    uuid = config.uuid;
    lastExec = config.lastExec;
}

if (!uuid) {
    uuid = crypto.randomBytes(16).toString("hex");
}

let currentChunks;
if (Date.now() - lastExec > 1000 * 60 * 60 * 24 && fs.existsSync("chunks")) {
    currentChunks = fs.readdirSync("chunks");
}

ws.onopen = () => {
    ws.send(JSON.stringify({uuid, currentChunks: currentChunks}));
};

ws.onmessage = (message) => {
    const {event, filename, fileData} = JSON.parse(message.data);
    if (event === "upload") {
        const filePath = path.join("chunks", filename);
        const writeStream = fs.createWriteStream(filePath);
        writeStream.write(fileData);
        writeStream.end();
    }
};

process.on("SIGINT", () => {
    const config = {uuid, lastExec: Date.now()};
    fs.writeFileSync("config.json", JSON.stringify(config), "utf8");
    process.exit(0);
});