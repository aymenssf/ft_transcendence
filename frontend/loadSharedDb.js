import { prisma } from '@ft/shared-database';
export async function getAllUsers() {
    return await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            avatar: true,
            created_at: true
        }
    });
}
