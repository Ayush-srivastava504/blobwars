import { Schema, MapSchema, type } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") mass: number = 20;
  @type("number") health: number = 100;
  @type("number") maxHealth: number = 100;
  @type("number") color: number = 0x3498db;
  @type("string") state: "alive" | "dead" | "respawning" = "alive";
  @type("number") level: number = 1;
  @type("number") xp: number = 0;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("number") score: number = 0;
  @type("number") lastProcessedInputSeq: number = 0;
  @type("number") spawnProtectedUntil: number = 0;

  // server-only (not synced): pending input queue handled outside schema
}

export class FoodSchema extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") mass: number = 4;
  @type("number") color: number = 0x2ecc71;
}

export class ObstacleSchema extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") radius: number = 100;
}

export class ArenaState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: FoodSchema }) food = new MapSchema<FoodSchema>();
  @type({ map: ObstacleSchema }) obstacles = new MapSchema<ObstacleSchema>();
  @type("number") serverTime: number = 0;
}
