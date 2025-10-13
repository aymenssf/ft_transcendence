import type { FastifyReply, FastifyRequest } from "fastify";
import type { PublicUser } from "./loadSharedDb.js";
import {validateUsername, validateEmail, validatePassword, hashPassword, ValidationError } from "./loadSharedDb.js";
import { prisma } from '@ft/shared-database';

export interface UpdateUserBody {
	username?: string;
	email?: string;
	password?: string;
	avatar?: string | null;
}

function optionalValidateUsername(u?: string) 
{ 
	if (u !== undefined) 
		validateUsername(u); 
}
function optionalValidateEmail(e?: string) 
{
	if (e !== undefined) 
		validateEmail(e); 
}
function optionalValidatePassword(p?: string) 
{
	if (p !== undefined) 
		validatePassword(p); 
}

export async function updateUserHandler(
	request: FastifyRequest<{ Body: UpdateUserBody }>,
	reply: FastifyReply,
) {
	const authUser: any = (request as any).user;
	if (!authUser) 
		return reply.status(401).send({ error: "Unauthorized" });

		const targetUserId = parseInt(String(authUser.userId), 10);
		if (Number.isNaN(targetUserId)) 
			return reply.status(400).send({ error: "Invalid authenticated user id" });

	const { username, email, password, avatar } = request.body || {};

	try {
		optionalValidateUsername(username);
		optionalValidateEmail(email);
		optionalValidatePassword(password);

		const data: Record<string, any> = {};
		if (username !== undefined) 
			data.username = username;
		if (email !== undefined) 
			data.email = email;
		if (avatar !== undefined) 
			data.avatar = avatar; // can be null
		if (password !== undefined) 
			data.password = await hashPassword(password);

		if (Object.keys(data).length === 0)
			return reply.status(400).send({ error: "No fields provided to update" });

		if (data.username) {
			const existing = await prisma.user.findUnique({ where: { username: data.username } });
			if (existing && existing.id !== targetUserId)
				return reply.status(400).send({ error: "Username already exists" });
		}
		if (data.email) {
			const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
			if (existingEmail && existingEmail.id !== targetUserId)
				return reply.status(400).send({ error: "Email already exists" });
		}

		let updated: PublicUser | null = null;
		try {
			updated = await prisma.user.update({
				where: { id: targetUserId },
				data,
				select: { id: true, username: true, email: true, avatar: true, created_at: true }
			});
		} catch (err: any) {
			if (err.code === 'P2002') 
			{
				const field = err.meta?.target?.[0];
				if (field === 'username') 
					return reply.status(409).send({ error: "Username already exists" });
				if (field === 'email') 
					return reply.status(409).send({ error: "Email already exists" });
			}
			if (err.code === 'P2025') 
				return reply.status(404).send({ error: "User not found" });
			throw err;
		}

		if (!updated) 
			return reply.status(404).send({ error: "User not found after update" });
		return reply.send({ message: "User updated successfully", user: updated });
	} catch (err: any) {
		request.log?.error({ err }, "User update failed");
		if (err instanceof ValidationError)
			return reply.status(400).send({ error: err.message });
		return reply.status(400).send({ error: err?.message || "Update failed" });
	}
}

export default { updateUserHandler };

