import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import crypto from 'crypto';

/**
 * NEW CLOUDFLARE R2 STORAGE SERVICE
 * 
 * This is a completely separate service that handles avatar uploads to R2.
 * It doesn't modify any existing code - you integrate it when ready.
 * 
 * Purpose: Download 42 intra avatars and upload them to YOUR Cloudflare R2 bucket
 */

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

    // Check if R2 is configured
    if (!accountId || !accessKeyId || !secretAccessKey || !this.publicUrl) {
      console.warn('⚠️  R2 credentials not configured - avatar uploads disabled');
      console.warn('   Add R2_* variables to .env to enable cloud storage');
      this.enabled = false;
      return;
    }

    try {
      // R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
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
      console.log('✅ Cloudflare R2 Storage initialized successfully');
      console.log(`   Bucket: ${this.bucketName}`);
      console.log(`   Public URL: ${this.publicUrl}`);
    } catch (error) {
      console.error('❌ Failed to initialize R2 Storage:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if R2 storage is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Download image from URL and upload to Cloudflare R2
   * 
   * @param imageUrl - The URL of the image to download (e.g., from 42 intra CDN)
   * @param userId - User ID to create unique filename
   * @returns Promise<string> - Public URL of uploaded image, or original URL if R2 disabled
   * 
   * @example
   * const r2Url = await r2Service.uploadFromUrl('https://cdn.intra.42.fr/users/123.jpg', 12345);
   * // Returns: 'https://pub-xxx.r2.dev/42-intra/12345_1700000000_abc123.jpg'
   */
  async uploadFromUrl(imageUrl: string, userId: number): Promise<string> {
    // If R2 not enabled, return original URL
    if (!this.enabled) {
      console.log('ℹ️  R2 disabled, using original URL:', imageUrl);
      return imageUrl;
    }

    try {
      // Download image from source
      console.log(`📥 Downloading avatar from: ${imageUrl}`);
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'ft-transcendence/1.0'
        }
      });

      const imageBuffer = Buffer.from(response.data);
      
      // Get file extension from content-type
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const extension = this.getExtension(contentType);
      
      // Generate unique filename: {userId}_{timestamp}_{random}.{ext}
      const timestamp = Date.now();
      const hash = crypto.randomBytes(8).toString('hex');
      const filename = `${userId}_${timestamp}_${hash}.${extension}`;
      const filePath = `42-intra/${filename}`;

      // Upload to R2
      console.log(`📤 Uploading to R2: ${filePath}`);
      
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: imageBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      });

      await this.s3Client.send(uploadCommand);

      // Construct public URL
      const publicUrl = `${this.publicUrl}/${filePath}`;
      console.log(`✅ Avatar uploaded: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error('❌ Failed to upload avatar to R2:', error);
      console.log('   Falling back to original URL');
      return imageUrl; // Fallback to original URL on error
    }
  }

  /**
   * Delete an avatar from R2 Storage
   * 
   * @param avatarUrl - Full public URL of the avatar to delete
   * 
   * @example
   * await r2Service.deleteAvatar('https://pub-xxx.r2.dev/42-intra/12345_...jpg');
   */
  async deleteAvatar(avatarUrl: string): Promise<void> {
    if (!this.enabled) return;

    try {
      // Only delete if it's an R2 URL
      if (!avatarUrl.includes(this.publicUrl) && !avatarUrl.includes('r2.dev')) {
        console.log('ℹ️  Not an R2 URL, skipping deletion:', avatarUrl);
        return;
      }

      // Extract file path from URL
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
      console.log(`🗑️  Deleted from R2: ${filePath}`);
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
    // Delete old avatar if it exists and is an R2 URL
    if (oldAvatarUrl && this.enabled) {
      await this.deleteAvatar(oldAvatarUrl);
    }

    // Upload new avatar
    return await this.uploadFromUrl(newImageUrl, userId);
  }

  /**
   * Get file extension from content-type header
   */
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

  /**
   * Health check - verify R2 is configured and working
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.enabled) {
      return {
        healthy: false,
        message: 'R2 storage not configured'
      };
    }

    try {
      // Just check credentials are set
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

// Export singleton instance
export const r2AvatarService = new R2AvatarService();
