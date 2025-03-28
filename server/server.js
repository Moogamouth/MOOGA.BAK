const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const archivePath = path.join(__dirname, "archive");

const db = new sqlite3.Database("data.db", () => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            lastSeen INTEGER,
            allChunks TEXT,
            currentChunks TEXT
        )
    `);
});

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        const {username, password, currentChunks = []} = data;
        ws.username = username;

        db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
            if (!user) {
                db.run(
                    `INSERT INTO users (username, password, lastSeen, allChunks, currentChunks) VALUES (?, ?, ?, ?, ?)`,
                    [username, password, Date.now(), JSON.stringify([]), JSON.stringify([])]
                );
            } else {
                if (password !== user.password) {
                    ws.close();
                    return;
                }

                const allChunks = JSON.parse(user.allChunks);
                const updatedChunks = currentChunks.filter(hash => allChunks.includes(hash));
                
                if (user.currentChunks === "[]") {
                    updatedChunks.forEach(hash => {
                        db.run(
                            `UPDATE chunks SET count = count + 1 WHERE hash = ?`,
                            [hash]
                        );
                    });
                }

                db.run(
                    `UPDATE users SET currentChunks = ?, lastSeen = ? WHERE username = ?`,
                    [JSON.stringify(updatedChunks), Date.now(), username]
                );
            }
        });

        setInterval(() => {
            db.all("SELECT * FROM chunks", [], (err, chunks) => {
                const hash = chunks.reduce((lowest, chunk) => {
                    return chunk.count < lowest.count ? chunk : lowest;
                }, { hash: null, count: Infinity }).hash;

                const filename = hash + ".bin";
                const filePath = path.join(archivePath, filename);
                const fileData = fs.readFileSync(filePath, "utf8");

                ws.send(JSON.stringify({event: "upload", filename: filename, fileData: fileData}));

                db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
                    const allChunks = JSON.parse(user.allChunks);
                    const currentChunks = JSON.parse(user.currentChunks);

                    if (!allChunks.includes(hash)) {
                        allChunks.push(hash);
                    }
                    currentChunks.push(hash);

                    db.run(
                        `UPDATE users SET allChunks = ?, currentChunks = ? WHERE username = ?`,
                        [JSON.stringify(allChunks), JSON.stringify(currentChunks), username]
                    );
                });

                db.run(
                    `UPDATE chunks SET count = count + 1 WHERE hash = ?`,
                    [hash]
                );
            });
        } , 10000);
    });

    ws.on("close", () => {
        db.run(
            `UPDATE users SET lastSeen = ? WHERE username = ?`,
            [Date.now(), ws.username]
        );
    });
});

server.listen(8080);

setInterval(() => {
    db.all("SELECT * FROM users", [], (err, users) => {
        users.forEach((user) => {
            if (Date.now() - user.lastSeen > 2592000000 && !Array.from(wss.clients).some((client) => client.username === user.username)) {
                const currentChunks = JSON.parse(user.currentChunks);
                currentChunks.forEach((hash) => {
                    db.run(
                        `UPDATE chunks SET count = count - 1 WHERE hash = ?`,
                        [hash]
                    );
                });

                db.run(
                    `UPDATE users SET currentChunks = ? WHERE username = ?`,
                    [JSON.stringify([]), user.username]
                );
            }
        });
    });
}, 604800000);