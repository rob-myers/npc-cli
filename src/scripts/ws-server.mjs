import express from "express";
import expressWs from "express-ws";

const port = Number(process.env.PORT || 3000);

const { app } = expressWs(express());

app.ws("/test", function (ws, req) {
  ws.on("message", function (msg) {
    const received = msg.toString();
    console.log("received message", received);
    ws.send(received);
  });
});

app.listen(port).on("listening", () => console.log(`listening on port ${port}`));
