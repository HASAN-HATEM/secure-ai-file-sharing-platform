import { prisma } from '@/lib/prisma';

export async function listFriends(ownerId: number) {
  const rows = await prisma.friend.findMany({
    where: { ownerId },
    include: { friend: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return rows.map((row) => row.friend);
}

export async function isFriend(ownerId: number, friendUserId: number) {
  const row = await prisma.friend.findUnique({
    where: { ownerId_friendUserId: { ownerId, friendUserId } }
  });
  return !!row;
}

export async function addFriend(ownerId: number, friendUserId: number) {
  if (ownerId === friendUserId) {
    throw new Error('Cannot add yourself as a friend');
  }
  return prisma.friend.upsert({
    where: { ownerId_friendUserId: { ownerId, friendUserId } },
    create: { ownerId, friendUserId },
    update: {}
  });
}
