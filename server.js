const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
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
  app.listen(PORT, HOST, () => {
    console.log(`Server kjører på http://${HOST}:${PORT}`);
  });

  if (!MONGO_URI) {
    console.error("MongoDB ikke koblet: MONGO_URI mangler i .env");
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

start();
