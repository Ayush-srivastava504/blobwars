import { prisma } from "./prisma";

export async function createMatchForRoom(roomId: string, mapName: string): Promise<string> {
  // Room row is optional in dev (foreign key), so we upsert a lightweight "public" room record.
  const room = await prisma.room.upsert({
    where: { id: roomId },
    update: {},
    create: {
      id: roomId,
      name: "Public Arena",
      isPrivate: false,
      mapName,
    },
  });

  const match = await prisma.match.create({
    data: { roomId: room.id, mapName },
  });

  return match.id;
}

export async function recordMatchPlayerResult(
  matchId: string,
  data: {
    userId: string | null;
    guestName: string;
    kills: number;
    deaths: number;
    finalScore: number;
    finalMass: number;
  }
) {
  await prisma.matchPlayer.create({
    data: {
      matchId,
      userId: data.userId ?? undefined,
      guestName: data.userId ? undefined : data.guestName,
      kills: data.kills,
      deaths: data.deaths,
      finalScore: data.finalScore,
      finalMass: data.finalMass,
      leftAt: new Date(),
    },
  });

  if (data.userId) {
    await prisma.playerStats.upsert({
      where: { userId: data.userId },
      update: {
        totalMatches: { increment: 1 },
        totalKills: { increment: data.kills },
        totalDeaths: { increment: data.deaths },
        totalScore: { increment: data.finalScore },
        highestMass: { set: data.finalMass }, // simplified; app layer should max() against existing
      },
      create: {
        userId: data.userId,
        totalMatches: 1,
        totalKills: data.kills,
        totalDeaths: data.deaths,
        totalScore: data.finalScore,
        highestMass: data.finalMass,
      },
    });
  }
}
