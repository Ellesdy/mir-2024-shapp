// File: server/test/SecretHitlerRoom_test.ts

import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

// Import your "app.config.ts" file here.
import appConfig from "../src/app.config";
import { SecretHitlerRoom, GameState } from "../src/rooms/SecretHitlerRoom";

describe("Testing SecretHitlerRoom", () => {
  let colyseus: ColyseusTestServer;

  before(async () => (colyseus = await boot(appConfig)));
  after(async () => colyseus.shutdown());

  beforeEach(async () => await colyseus.cleanup());

  it("connecting into a room", async () => {
    // `room` is the server-side Room instance reference.
    const room = await colyseus.createRoom<GameState>("secret_hitler_room", {});

    // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
    const client1 = await colyseus.connectTo(room);

    // Make your assertions
    assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

    // Wait for state sync
    await room.waitForNextPatch();

    // Adjust the expected state based on your GameState implementation
    // For example, if your GameState has a property called `players`
    assert.deepStrictEqual({ players: {} }, client1.state.toJSON());
  });
});
