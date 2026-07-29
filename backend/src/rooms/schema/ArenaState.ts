// Colyseus schema definitions for the arena's synced state.
// Players, food, and obstacles are all replicated to every client;
// ArenaState is the root schema attached to the ArenaRoom.
// Decorated fields here are the network-serialized wire format.
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

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
  @type("number") coins: number = 0;
  @type("number") lastProcessedInputSeq: number = 0;
  @type("number") spawnProtectedUntil: number = 0;
  // Coin-shop gun loadout: every player starts owning the free pistol,
  // can buy more with coins earned from zombie kills, and equips whichever
  // one they want to fire with.
  @type("string") equippedWeapon: string = "pistol";
  @type(["string"]) ownedWeapons = new ArraySchema<string>("pistol");
}

export class ZombieSchema extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") health: number = 30;
  @type("number") maxHealth: number = 30;
  @type("string") state: "alive" | "dead" = "alive";
  @type("string") targetId: string = "";
  @type("number") wave: number = 1;
}

export class BulletSchema extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") dirX: number = 0;
  @type("number") dirY: number = 0;
  @type("number") damage: number = 8;
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
  @type({ map: ZombieSchema }) zombies = new MapSchema<ZombieSchema>();
  @type({ map: BulletSchema }) bullets = new MapSchema<BulletSchema>();
  @type("number") serverTime: number = 0;
  @type("number") wave: number = 0;
  @type("string") waveState: "intermission" | "active" = "intermission";
  @type("number") waveEndsOrStartsAt: number = 0;
}
