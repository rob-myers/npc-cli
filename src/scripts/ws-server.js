import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";

import { DEV_EXPRESS_WEBSOCKET_PORT } from "../const";
import { info, safeStringify, warn } from "../npc-cli/service/generic";

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
  ws.on("message", function (_msg) {});
  ws.on("close", () => devEventsWs.delete(ws));
});

app.post("/send-dev-event", function (req, res, next) {
  devEventsWs.forEach((client) => {
    if (req.body?.key === 'update-browser') {
      info(`/send-dev-event: ${safeStringify(req.body)}`);
      /** @see connectDevEventsWebsocket */
      client.send(JSON.stringify(req.body));
    } else {
      warn(`/send-dev-event: unrecognised event: ${safeStringify(req.body)}`);
    }
  });
  res.json();
});

app.listen(port).on("listening", () => info(`express websocket server listening on port ${port}`));
