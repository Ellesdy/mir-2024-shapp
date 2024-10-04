import { Room, Client } from "@colyseus/core";
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string;
  @type("string") username: string;
  @type("string") role: string = ""; // 'liberal', 'fascist', or 'hitler'
  @type("boolean") isDead: boolean = false;
  @type("boolean") ready: boolean = false;
  @type("boolean") hasVoted: boolean = false;
  @type("boolean") vote: boolean = false; // true for Ja!, false for Nein
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type(["string"]) drawPile = new ArraySchema<string>();
  @type(["string"]) discardPile = new ArraySchema<string>();
  @type(["string"]) enactedLiberalPolicies = new ArraySchema<string>();
  @type(["string"]) enactedFascistPolicies = new ArraySchema<string>();
  @type("number") electionTracker: number = 0;
  @type("string") phase: string = "waiting"; // 'waiting', 'election', 'legislative', etc.
  @type("string") presidentId: string = "";
  @type("string") chancellorId: string = "";
  @type("string") lastPresidentId: string = "";
  @type("string") lastChancellorId: string = "";
}

export class SecretHitlerRoom extends Room<GameState> {
  maxClients = 10;
  minClients = 5;

  onCreate(options: any) {
    this.setState(new GameState());

    // Message Handlers
    this.onMessage("ready", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    });

    this.onMessage("nominate", (client, chancellorId) => {
      if (
        client.sessionId === this.state.presidentId &&
        this.state.phase === "nomination"
      ) {
        this.state.chancellorId = chancellorId;
        this.state.phase = "voting";
        this.resetVotes();
        this.broadcast("votingStarted", { chancellorId });
      }
    });

    this.onMessage("vote", (client, vote) => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.phase === "voting" && !player.hasVoted) {
        player.hasVoted = true;
        player.vote = vote;
        this.checkVotingComplete();
      }
    });

    // Additional message handlers for legislative session, executive actions, etc.
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    player.id = client.sessionId;
    player.username = options.username || `Player${this.clients.length}`;
    this.state.players.set(client.sessionId, player);

    this.broadcast("playerJoined", {
      id: client.sessionId,
      username: player.username,
    });
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    this.broadcast("playerLeft", { id: client.sessionId });
  }

  checkAllReady() {
    const allReady = Array.from(this.state.players.values()).every(
      (player) => player.ready
    );
    if (allReady && this.clients.length >= this.minClients) {
      this.startGame();
    }
  }

  startGame() {
    this.assignRoles();
    this.preparePolicyDeck();
    this.state.phase = "nomination";
    this.state.presidentId = this.getNextPresidentId();
    this.broadcast("gameStarted", { players: this.serializePlayers() });
  }

  assignRoles() {
    const roles = this.generateRoles();
    const playerIds = Array.from(this.state.players.keys());
    for (let i = 0; i < playerIds.length; i++) {
      const player = this.state.players.get(playerIds[i]);
      player.role = roles[i];
      // Send role to the player privately
      this.clients
        .find((client) => client.sessionId === player.id)
        ?.send("roleAssignment", { role: player.role });
    }
  }

  generateRoles() {
    const numPlayers = this.clients.length;
    const roles: string[] = [];
    roles.push("hitler");

    const numFascists = this.getNumFascists(numPlayers) - 1; // minus Hitler
    for (let i = 0; i < numFascists; i++) {
      roles.push("fascist");
    }

    const numLiberals = numPlayers - roles.length;
    for (let i = 0; i < numLiberals; i++) {
      roles.push("liberal");
    }

    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return roles;
  }

  getNumFascists(numPlayers: number): number {
    if (numPlayers <= 6) return 2;
    if (numPlayers <= 8) return 3;
    return 4;
  }

  preparePolicyDeck() {
    const policies = [
      ...Array(6).fill("liberal"),
      ...Array(11).fill("fascist"),
    ];
    // Shuffle policies
    for (let i = policies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [policies[i], policies[j]] = [policies[j], policies[i]];
    }
    this.state.drawPile = new ArraySchema<string>(...policies);
    this.state.discardPile = new ArraySchema<string>();
  }

  getNextPresidentId(): string {
    // Logic to determine the next president
    const playerIds = Array.from(this.state.players.keys());
    if (!this.state.presidentId) return playerIds[0];
    const currentIndex = playerIds.indexOf(this.state.presidentId);
    return playerIds[(currentIndex + 1) % playerIds.length];
  }

  resetVotes() {
    for (const player of this.state.players.values()) {
      player.hasVoted = false;
      player.vote = false;
    }
  }

  checkVotingComplete() {
    const allVoted = Array.from(this.state.players.values()).every(
      (player) => player.isDead || player.hasVoted
    );
    if (allVoted) {
      const votes = Array.from(this.state.players.values())
        .filter((player) => !player.isDead)
        .map((player) => player.vote);
      const jaVotes = votes.filter((v) => v).length;
      const neinVotes = votes.length - jaVotes;

      if (jaVotes > neinVotes) {
        // Election successful
        this.state.phase = "legislative";
        this.startLegislativeSession();
      } else {
        // Election failed
        this.state.electionTracker += 1;
        this.state.presidentId = this.getNextPresidentId();
        this.state.phase = "nomination";
        this.broadcast("electionFailed", {
          electionTracker: this.state.electionTracker,
        });
        // Handle election tracker reaching 3
      }
    }
  }

  startLegislativeSession() {
    // President draws 3 policies
    const drawnPolicies = this.state.drawPile.splice(0, 3);
    // Send policies to President for discarding one
    const presidentClient = this.clients.find(
      (client) => client.sessionId === this.state.presidentId
    );
    presidentClient?.send("presidentPolicies", { policies: drawnPolicies });
    // Handle further steps in legislative session
  }

  // Additional methods for legislative choices, executive actions, and game end conditions

  serializePlayers() {
    return Array.from(this.state.players.values()).map((player) => ({
      id: player.id,
      username: player.username,
      isDead: player.isDead,
    }));
  }
}
