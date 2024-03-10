import express from "express";
import expressWs from "express-ws";

import { DEV_WEBSOCKET_PORT } from "../const";

const port = Number(DEV_WEBSOCKET_PORT || 3000);

const { app } = expressWs(express());

app.ws("/test", function (ws, req) {
  ws.on("message", function (msg) {
    const received = msg.toString();
    console.log("received message", received);
    ws.send(received);
  });
});

app.listen(port).on("listening", () => console.log(`listening on port ${port}`));
