import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";

import { DEV_EXPRESS_WEBSOCKET_PORT } from "./const";
import { info } from "../npc-cli/service/generic";

const port = Number(DEV_EXPRESS_WEBSOCKET_PORT || 3000);

const { app } = expressWs(express());

app.use(bodyParser.json());

app.ws("/echo", function (ws, req) {
  ws.on("message", function (msg) {
    const received = msg.toString();
    console.info("/echo received:", received);
    ws.send(received);
  });
});

/** @type {Set<import('ws').WebSocket>} */
const devEventsWs = new Set();

app.ws("/dev-events", function (ws, req) {
  devEventsWs.add(ws);
  ws.on("message", function (msg) {
    if (msg.toString() === "bye") {
      devEventsWs.delete(ws);
      ws.close();
    }
  });
});

app.post("/send-dev-event", function (req, res, next) {
  devEventsWs.forEach((client) => {
    if (client.readyState === client.CLOSED) {
      devEventsWs.delete(client); // remove stale
    } else {
      info("received", client.readyState, req.body);
      client.send(JSON.stringify(req.body));
    }
  });
  res.json();
});

app.listen(port).on("listening", () => info(`express websocket server listening on port ${port}`));
