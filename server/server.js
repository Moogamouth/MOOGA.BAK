const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3");
const fs = require("fs");
const path = require("path");

const server = http.createServer();
const wss = new WebSocket.Server({server});

const db = new sqlite3.Database("data.db", () => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            uuid TEXT PRIMARY KEY,
            lastSeen INTEGER,
            currentChunks TEXT
        )
    `);
});

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        const {uuid, currentChunks = []} = data;
        ws.uuid = uuid;

        db.get("SELECT * FROM users WHERE uuid = ?", [ws.uuid], (err, user) => {
            if (!user) {
                db.run(
                    `INSERT INTO users (uuid, currentChunks) VALUES (?, ?)`,
                    [uuid, JSON.stringify([])]
                );
            } else if (user.currentChunks === "[]") {
                db.run(
                    `UPDATE users SET currentChunks = ? WHERE uuid = ?`,
                    [JSON.stringify(currentChunks), uuid]
                );
                currentChunks.forEach(hash => {
                    db.run(
                        `UPDATE chunks SET count = count + 1 WHERE hash = ?`,
                        [hash]
                    );
                });
            }
        });
    });

    setInterval(() => {
        db.get("SELECT * FROM users WHERE uuid = ?", [ws.uuid], (err, user) => {
            const currentChunks = JSON.parse(user.currentChunks);

            const placeholders = currentChunks.map(() => "?").join(",");
            db.get(`SELECT hash FROM chunks WHERE hash NOT IN (${placeholders}) ORDER BY count ASC LIMIT 1`, currentChunks, (err, row) => {
                if (!row) {
                    return;
                }
                const hash = row.hash;

                const filename = hash + ".bin";
                const filePath = path.join("archive", filename);
                const fileData = fs.readFileSync(filePath, "utf8");

                ws.send(JSON.stringify({event: "upload", filename: filename, fileData: fileData}));

                currentChunks.push(hash);

                db.run(
                    `UPDATE users SET currentChunks = ? WHERE uuid = ?`,
                    [JSON.stringify(currentChunks), ws.uuid]
                );

                db.run(
                    `UPDATE chunks SET count = count + 1 WHERE hash = ?`,
                    [hash]
                );
            });
        });
    }, 10000);

    ws.on("close", () => {
        db.run(
            `UPDATE users SET lastSeen = ? WHERE uuid = ?`,
            [Date.now(), ws.uuid]
        );
    });
});

server.listen(8080);

setInterval(() => {
    db.all("SELECT * FROM users", [], (err, users) => {
        users.forEach((user) => {
            if (Date.now() - user.lastSeen > 1000 * 60 * 60 * 24 * 30 && !Array.from(wss.clients).some((client) => client.uuid === user.uuid)) {
                const currentChunks = JSON.parse(user.currentChunks);
                currentChunks.forEach((hash) => {
                    db.run(
                        `UPDATE chunks SET count = count - 1 WHERE hash = ?`,
                        [hash]
                    );
                });

                db.run(
                    `UPDATE users SET currentChunks = ? WHERE uuid = ?`,
                    [JSON.stringify([]), user.uuid]
                );
            }
        });
    });
}, 1000 * 60 * 60 * 24);