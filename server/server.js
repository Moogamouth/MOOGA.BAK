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
            password TEXT PRIMARY KEY,
            lastSeen INTEGER,
            currentChunks TEXT
        )
    `);
});

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        const {password, currentChunks = []} = data;
        ws.password = password;

        db.get("SELECT * FROM users WHERE password = ?", [ws.password], (err, user) => {
            if (!user) {
                db.run(
                    `INSERT INTO users (password, currentChunks) VALUES (?, ?)`,
                    [password, JSON.stringify([])]
                );
            } else if (user.currentChunks === "[]") {
                db.run(
                    `UPDATE users SET currentChunks = ? WHERE password = ?`,
                    [JSON.stringify(currentChunks), password]
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
        db.get("SELECT * FROM users WHERE password = ?", [ws.password], (err, user) => {
            const currentChunks = JSON.parse(user.currentChunks);

            const placeholders = currentChunks.map(() => "?").join(",");
            db.get(`SELECT hash FROM chunks WHERE hash NOT IN (${placeholders}) ORDER BY count ASC LIMIT 1`, currentChunks, (err, row) => {
                if (!row) {
                    return;
                }
                const hash = row.hash;

                const filename = hash + ".bin";
                const filePath = path.join(archivePath, filename);
                const fileData = fs.readFileSync(filePath, "utf8");

                ws.send(JSON.stringify({event: "upload", filename: filename, fileData: fileData}));

                currentChunks.push(hash);

                db.run(
                    `UPDATE users SET currentChunks = ? WHERE password = ?`,
                    [JSON.stringify(currentChunks), ws.password]
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
            `UPDATE users SET lastSeen = ? WHERE password = ?`,
            [Date.now(), ws.password]
        );
    });
});

server.listen(8080);

setInterval(() => {
    db.all("SELECT * FROM users", [], (err, users) => {
        users.forEach((user) => {
            if (Date.now() - user.lastSeen > 2592000000 && !Array.from(wss.clients).some((client) => client.password === user.password)) {
                const currentChunks = JSON.parse(user.currentChunks);
                currentChunks.forEach((hash) => {
                    db.run(
                        `UPDATE chunks SET count = count - 1 WHERE hash = ?`,
                        [hash]
                    );
                });

                db.run(
                    `UPDATE users SET currentChunks = ? WHERE password = ?`,
                    [JSON.stringify([]), user.password]
                );
            }
        });
    });
}, 604800000);