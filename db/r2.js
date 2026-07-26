/**
 * Cloudflare R2 Image Uploader
 *
 * 使用 S3 兼容 API 上传图片到 R2 公开 bucket。
 * 依赖 @aws-sdk/client-s3（已在 package.json 中）。
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

class R2Client {
  constructor({ accountId, accessKeyId, secretAccessKey, bucket, publicUrl }) {
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
      throw new Error('R2 缺少配置：请提供全部 R2_* 环境变量');
    }
    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, ''); // 去掉尾部斜杠
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * 上传图片并返回公开 URL
   * @param {string} base64Data - data:image/jpeg;base64,...
   * @param {string} [fileName] - 可选文件名，自动生成随机名
   * @returns {Promise<string>} 公开 URL
   */
  async uploadImage(base64Data, fileName) {
    // 解析 base64 数据：data:image/{fmt};base64,{data}
    const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) throw new Error('R2 上传：不支持的图片格式（需要 data URL）');
    const mime = match[1];
    const ext = mime.split('/')[1] || 'png';
    const buf = Buffer.from(match[2], 'base64');

    const key = fileName || `showcase/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buf,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000',
    }));

    return `${this.publicUrl}/${key}`;
  }
}

module.exports = { R2Client };
