import { Container, Text, TextStyle } from "pixi.js";
import { Player } from "../../../server/src/rooms/SecretHitlerRoom.js";

export class PlayerObject extends Container {
  constructor(player: Player) {
    super();

    // Text style for the username
    const textStyle = new TextStyle({
      fontSize: 18,
      fill: 0xffffff,
      stroke: 0x000000,
    });

    // Display the player's username
    const usernameText = new Text(player.username, textStyle);
    usernameText.anchor.set(0.5);

    // Optional: Display player's status
    const statusTextStyle = new TextStyle({
      fontSize: 14,
      fill: player.ready ? 0x00ff00 : 0xff0000,
    });

    const statusText = new Text(
      player.ready ? "Ready" : "Not Ready",
      statusTextStyle
    );
    statusText.anchor.set(0.5);
    statusText.position.y = 25;

    // Create a container for the player's display
    const playerContainer = new Container();
    playerContainer.addChild(usernameText);
    playerContainer.addChild(statusText);

    // Position the player container
    const x = 100; // Replace with desired x-coordinate
    const y = 200; // Replace with desired y-coordinate
    playerContainer.position.set(x, y);

    this.addChild(playerContainer);
  }
}
