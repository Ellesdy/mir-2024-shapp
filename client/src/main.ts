import * as PIXI from "pixi.js";
import { Client, Room } from "colyseus.js";
import { authenticate } from "./utils/Auth.js";

// Create a PixiJS application
const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x000000,
});
document.body.appendChild(app.view);

// Global variables
let room: Room;
let playerRole: string;
let players: any = {};
let sessionId: string;

// Game initialization
(async () => {
  // Authenticate with Discord
  await authenticate();

  // Connect to Colyseus server
  const colyseusClient = new Client("ws://localhost:2567");
  room = await colyseusClient.joinOrCreate("secret_hitler_room", {
    username: "YourUsername",
  });

  sessionId = room.sessionId;

  // Handle initial game state
  room.onStateChange.once((state) => {
    // Initialize game based on state
    players = state.players;
    updatePlayerList();
  });

  // Listen to state changes
  room.onStateChange((state) => {
    // Update player list when state changes
    players = state.players;
    updatePlayerList();
  });

  // Message Handlers
  room.onMessage("roleAssigned", (data) => {
    playerRole = data.role;
    displayRole(playerRole);
  });

  room.onMessage("startNomination", () => {
    if (isPresident()) {
      showNominationInterface();
    } else {
      showWaitingMessage(
        "Waiting for the President to nominate a Chancellor..."
      );
    }
  });

  room.onMessage("startVoting", (data) => {
    showVotingInterface(data.chancellorId);
  });

  room.onMessage("votingResults", (data) => {
    displayVotingResults(data.votes);
  });

  room.onMessage("startLegislativeSession", (data) => {
    if (isPresident()) {
      choosePolicyToDiscard(data.policies);
    } else if (isChancellor()) {
      showWaitingMessage("Waiting for the President to discard a policy...");
    }
  });

  room.onMessage("presidentDiscarded", (data) => {
    if (isChancellor()) {
      choosePolicyToEnact(data.policies);
    }
  });

  room.onMessage("policyEnacted", (data) => {
    displayPolicyEnacted(data.policy);
  });

  // Send readiness to server
  room.send("ready");
})();

// UI Functions

function updatePlayerList() {
  // Clear existing player list UI
  // ...
  // Create and display updated player list
  // For each player in 'players', display their username and status
}

function displayRole(role: string) {
  // Display the player's secret role
  const roleModal = new PIXI.Container();
  const roleText = new PIXI.Text(`Your role is: ${role}`, {
    fill: "#ffffff",
    fontSize: 24,
  });

  roleModal.addChild(roleText);
  app.stage.addChild(roleModal);

  // Remove after some time or on user action
  setTimeout(() => {
    app.stage.removeChild(roleModal);
  }, 5000);
}

function showNominationInterface() {
  // Display UI for the President to nominate a Chancellor
  const nominationContainer = new PIXI.Container();

  const instructionText = new PIXI.Text(
    "Select a player to nominate for Chancellor:",
    {
      fill: "#ffffff",
      fontSize: 18,
    }
  );
  nominationContainer.addChild(instructionText);

  let posY = 50;
  for (const playerId in players) {
    if (playerId !== sessionId && !players[playerId].isDead) {
      const playerButton = new PIXI.Text(players[playerId].username, {
        fill: "#00ff00",
        fontSize: 16,
      });
      playerButton.y = posY;
      playerButton.interactive = true;
      (playerButton as PIXI.Text & { buttonMode: boolean }).buttonMode = true;

      playerButton.on("pointerdown", () => {
        nominateChancellor(playerId);
        app.stage.removeChild(nominationContainer);
      });

      nominationContainer.addChild(playerButton);
      posY += 30;
    }
  }

  app.stage.addChild(nominationContainer);
}

function nominateChancellor(chancellorId: string) {
  room.send("nominateChancellor", { chancellorId });
}

function showVotingInterface(chancellorId: string) {
  // Display voting options (Ja! or Nein!)
  const votingContainer = new PIXI.Container();

  const instructionText = new PIXI.Text(
    `Do you approve ${players[chancellorId].username} as Chancellor?`,
    { fill: "#ffffff", fontSize: 18 }
  );
  votingContainer.addChild(instructionText);

  const jaButton = new PIXI.Text("Ja!", { fill: "#00ff00", fontSize: 24 });
  jaButton.y = 50;
  jaButton.interactive = true;
  (jaButton as PIXI.Text & { buttonMode: boolean }).buttonMode = true;
  jaButton.on("pointerdown", () => {
    castVote(true);
    app.stage.removeChild(votingContainer);
  });
  votingContainer.addChild(jaButton);

  const neinButton = new PIXI.Text("Nein!", { fill: "#ff0000", fontSize: 24 });
  neinButton.y = 100;
  neinButton.interactive = true;
  (neinButton as PIXI.Text & { buttonMode: boolean }).buttonMode = true;
  neinButton.on("pointerdown", () => {
    castVote(false);
    app.stage.removeChild(votingContainer);
  });
  votingContainer.addChild(neinButton);

  app.stage.addChild(votingContainer);
}

function castVote(vote: boolean) {
  room.send("castVote", { vote });
}

function displayVotingResults(votes: any) {
  // Show the results of the vote
  const resultContainer = new PIXI.Container();
  let resultText = "Vote Results:\n";

  for (const playerId in votes) {
    const voteString = votes[playerId] ? "Ja!" : "Nein!";
    resultText += `${players[playerId].username}: ${voteString}\n`;
  }

  const resultDisplay = new PIXI.Text(resultText, {
    fill: "#ffffff",
    fontSize: 18,
  });
  resultContainer.addChild(resultDisplay);
  app.stage.addChild(resultContainer);

  // Remove after some time
  setTimeout(() => {
    app.stage.removeChild(resultContainer);
  }, 5000);
}

function choosePolicyToDiscard(policies: string[]) {
  // President chooses one policy to discard
  const policyContainer = new PIXI.Container();

  const instructionText = new PIXI.Text("Select one policy to discard:", {
    fill: "#ffffff",
    fontSize: 18,
  });
  policyContainer.addChild(instructionText);

  let posX = 50;
  policies.forEach((policy, index) => {
    const policyCard = new PIXI.Text(policy.toUpperCase(), {
      fill: policy === "liberal" ? "#0000ff" : "#ff0000",
      fontSize: 24,
    });
    policyCard.x = posX;
    policyCard.y = 50;
    policyCard.interactive = true;
    (policyCard as PIXI.Text & { buttonMode: boolean }).buttonMode = true;

    policyCard.on("pointerdown", () => {
      room.send("discardPolicy", { policyIndex: index });
      app.stage.removeChild(policyContainer);
    });

    policyContainer.addChild(policyCard);
    posX += 150;
  });

  app.stage.addChild(policyContainer);
}

function choosePolicyToEnact(policies: string[]) {
  // Chancellor chooses one policy to enact
  const policyContainer = new PIXI.Container();

  const instructionText = new PIXI.Text("Select one policy to enact:", {
    fill: "#ffffff",
    fontSize: 18,
  });
  policyContainer.addChild(instructionText);

  let posX = 50;
  policies.forEach((policy, index) => {
    const policyCard = new PIXI.Text(policy.toUpperCase(), {
      fill: policy === "liberal" ? "#0000ff" : "#ff0000",
      fontSize: 24,
    });
    policyCard.x = posX;
    policyCard.y = 50;
    policyCard.interactive = true;
    (policyCard as PIXI.Text & { buttonMode: boolean }).buttonMode = true;

    policyCard.on("pointerdown", () => {
      room.send("enactPolicy", { policyIndex: index });
      app.stage.removeChild(policyContainer);
    });

    policyContainer.addChild(policyCard);
    posX += 150;
  });

  app.stage.addChild(policyContainer);
}

function displayPolicyEnacted(policy: string) {
  // Display the enacted policy
  const policyContainer = new PIXI.Container();

  const policyText = new PIXI.Text(
    `A ${policy.toUpperCase()} policy has been enacted!`,
    { fill: policy === "liberal" ? "#0000ff" : "#ff0000", fontSize: 24 }
  );

  policyContainer.addChild(policyText);
  app.stage.addChild(policyContainer);

  // Update policy track UI
  // ...

  // Remove after some time
  setTimeout(() => {
    app.stage.removeChild(policyContainer);
  }, 5000);
}

function showWaitingMessage(message: string) {
  // Display a message to the player indicating they should wait
  const waitingContainer = new PIXI.Container();
  const waitingText = new PIXI.Text(message, { fill: "#ffffff", fontSize: 18 });
  waitingContainer.addChild(waitingText);
  app.stage.addChild(waitingContainer);

  // Store reference if you need to remove later
}

function isPresident(): boolean {
  return room.state.presidentId === sessionId;
}

function isChancellor(): boolean {
  return room.state.chancellorId === sessionId;
}