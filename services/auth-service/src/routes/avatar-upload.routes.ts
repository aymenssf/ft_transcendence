import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function AvatarUploadRoutes(fastify: FastifyInstance) {
  
  fastify.post('/upload-avatar', async (request: any, reply: FastifyReply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({ 
          error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
        });
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ 
          error: 'File too large. Maximum size is 5MB.' 
        });
      }

      const ext = path.extname(data.filename);
      const hash = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const filename = `user_avatar_${timestamp}_${hash}${ext}`;

      const uploadDir = path.resolve(process.cwd(), 'avatar', 'uploads');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);

      const avatarPath = `/avatar/uploads/${filename}`;

      fastify.log.info(`Avatar uploaded: ${avatarPath}`);

      return reply.send({
        success: true,
        avatar: avatarPath,
        message: 'Avatar uploaded successfully'
      });

    } catch (error) {
      fastify.log.error({ error }, 'Avatar upload error');
      return reply.status(500).send({
        error: 'Failed to upload avatar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
