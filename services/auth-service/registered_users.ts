import crypto from "crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

// Single Prisma client instance for this module
const prisma = new PrismaClient();

export interface LoginSuccess 
{
    token: string;
    user: {
        id: number;
        username: string;
        email: string;
        avatar?: string | null;
    };
}

export class AuthError extends Error
{
    status = 401 as const;
    constructor(message: string)
    {
        super(message);
        this.name = "AuthError";
    }
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean>
{
    if (!storedHash) 
        return false;
    try 
    {
        if (/^\$2[aby]\$/.test(storedHash))
            return await bcrypt.compare(plain, storedHash);
        if (storedHash.startsWith("scrypt$1$"))
        {
            const parts = storedHash.split("$");
            if (parts.length !== 4)
                return false;
            const [, , salt, hexHash] = parts;
            const derived = await new Promise<any>((resolve, reject) =>
            {
                crypto.scrypt(plain, salt, 64, (err, buf) =>
                {
                    if (err) 
                        reject(err);
                    resolve(buf);
                });
            });
            const storedBuf = Buffer.from(hexHash, "hex");
            if (derived.length !== storedBuf.length)
                return false;
            return crypto.timingSafeEqual(storedBuf, derived);
        }
    }
    catch (err)
    {
        return false;
    }
    return false;
}

export async function loginUser(params:{
    username: string;
    password: string;
    sign: (payload: object, options?: object) => string;
    tokenTTL?: string;
}): Promise<LoginSuccess> {
    const { username, password, sign, tokenTTL = "7d" } = params;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) 
        throw new AuthError("Invalid username");

    const isValidPassword = await verifyPassword(user.password, password);
    if (!isValidPassword) 
        throw new AuthError("Invalid password");

    const token = sign({ userId: user.id, username: user.username }, { expiresIn: tokenTTL });
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: (user as any).avatar ?? null,
        },
    };
}

export default
{
    AuthError,
    verifyPassword,
    loginUser,
}
