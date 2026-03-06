const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const BASE_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI = process.env.MONGO_URI || "";

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  const html = fs.readFileSync(path.join(__dirname, "index.ejs"), "utf8");
  res.status(200).type("html").send(html);
});

app.get("/index.ejs", (_req, res) => {
  res.redirect(302, "/");
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "angry-birds-vm",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

async function start() {
  await startServer(BASE_PORT);

  if (!MONGO_URI) {
    console.warn("MongoDB ikke koblet: MONGO_URI mangler i .env");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("MongoDB tilkoblet");
  } catch (error) {
    console.error("MongoDB tilkobling feilet:", error.message);
  }
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);

    server.once("listening", () => {
      console.log(`Server kjører på http://${HOST}:${port}`);
      resolve(server);
    });

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        const nextPort = port + 1;
        console.warn(`Port ${port} er i bruk. Prøver port ${nextPort}...`);
        resolve(startServer(nextPort));
        return;
      }

      reject(error);
    });

    server.listen(port, HOST);
  });
}

start();
