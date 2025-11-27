import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import crypto from 'crypto';

export class R2AvatarService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;
  private enabled: boolean;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'ft-transcendence-avatars';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    if (!accountId || !accessKeyId || !secretAccessKey || !this.publicUrl) {
      console.warn('⚠️  R2 credentials not configured - avatar uploads disabled');
      console.warn('   Add R2_* variables to .env to enable cloud storage');
      this.enabled = false;
      return;
    }

    try {
      const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });

      this.enabled = true;
    } catch (error) {
      console.error('❌ Failed to initialize R2 Storage:', error);
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async uploadFromUrl(imageUrl: string, userId: number): Promise<string> {
    if (!this.enabled) {
      return imageUrl;
    }

    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'ft-transcendence/1.0'
        }
      });

      const imageBuffer = Buffer.from(response.data);
      
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const extension = this.getExtension(contentType);
      
      const timestamp = Date.now();
      const hash = crypto.randomBytes(8).toString('hex');
      const filename = `${userId}_${timestamp}_${hash}.${extension}`;
      const filePath = `42-intra/${filename}`;
      
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: imageBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      });

      await this.s3Client.send(uploadCommand);

      const publicUrl = `${this.publicUrl}/${filePath}`;
      
      return publicUrl;
    } catch (error) {
      console.error('❌ Failed to upload avatar to R2:', error);
      return imageUrl;
    }
  }

  async deleteAvatar(avatarUrl: string): Promise<void> {
    if (!this.enabled) return;

    try {
      if (!avatarUrl.includes(this.publicUrl) && !avatarUrl.includes('r2.dev')) {
        return;
      }

      const urlParts = avatarUrl.split(this.publicUrl + '/');
      if (urlParts.length < 2) {
        console.warn('⚠️  Invalid R2 URL format:', avatarUrl);
        return;
      }

      const filePath = urlParts[1];

      if (!this.s3Client) {
        console.warn('⚠️  S3 client not initialized');
        return;
      }

      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error('❌ Error deleting avatar from R2:', error);
      // Don't throw - deletion is non-critical
    }
  }

  /**
   * Update avatar - delete old one and upload new one
   * 
   * @param oldAvatarUrl - Current avatar URL (will be deleted if it's an R2 URL)
   * @param newImageUrl - New image URL to download and upload
   * @param userId - User ID
   * @returns Promise<string> - Public URL of new uploaded image
   * 
   * @example
   * const newUrl = await r2Service.updateAvatar(
   *   'https://pub-xxx.r2.dev/42-intra/old.jpg',
   *   'https://cdn.intra.42.fr/users/new.jpg',
   *   12345
   * );
   */
  async updateAvatar(oldAvatarUrl: string | null, newImageUrl: string, userId: number): Promise<string> {
    if (oldAvatarUrl && this.enabled) {
      await this.deleteAvatar(oldAvatarUrl);
    }

    return await this.uploadFromUrl(newImageUrl, userId);
  }

  private getExtension(contentType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };

    return mimeMap[contentType] || 'jpg';
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.enabled) {
      return {
        healthy: false,
        message: 'R2 storage not configured'
      };
    }

    try {
      const hasCredentials = !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_PUBLIC_URL
      );

      return {
        healthy: hasCredentials,
        message: hasCredentials ? 'R2 storage ready' : 'R2 credentials incomplete'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `R2 health check failed: ${error}`
      };
    }
  }
}

export const r2AvatarService = new R2AvatarService();
