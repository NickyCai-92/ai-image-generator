/**
 * Cloudflare D1 HTTP API client
 *
 * 通过 D1 REST API 操作 SQLite 数据库。
 * 不需要 Workers 中间层，Vercel 上的 Node 直接 HTTPS 调 D1 接口。
 *
 * 端点：POST /accounts/{account_id}/d1/database/{database_id}/query
 * 鉴权：Authorization: Bearer {api_token}
 */
class D1Client {
  constructor({ accountId, databaseId, apiToken }) {
    if (!accountId || !databaseId || !apiToken) {
      throw new Error('D1 缺少配置：请提供 CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID / D1_API_TOKEN');
    }
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
  }

  /**
   * 执行 SQL 查询
   * @param {string} sql - SQL 语句（支持 ? 占位符）
   * @param {Array} params - 参数数组
   * @returns {Promise<Array>} D1 返回的 result 数组
   */
  async query(sql, params = []) {
    const url = `${this.baseUrl}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`D1 HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(`D1 错误: ${(json.errors || [])[0]?.message || '未知错误'}`);
    }
    return json.result;
  }

  /**
   * 创建表（幂等，多次调用不会报错）
   */
  async initSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS showcase_images (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        image_data TEXT    NOT NULL DEFAULT '',
        image_url  TEXT    DEFAULT '',
        prompt     TEXT    NOT NULL DEFAULT '',
        model      TEXT    NOT NULL DEFAULT '',
        provider   TEXT    NOT NULL DEFAULT '',
        scene      TEXT    DEFAULT '',
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // 旧表没有 image_url 列，补上（幂等）
    await this.query(`ALTER TABLE showcase_images ADD COLUMN image_url TEXT DEFAULT ''`).catch(() => {});
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_showcase_created
      ON showcase_images(created_at DESC)
    `);
  }

  /**
   * 保存一张生成记录
   * @param {string} imageData - data:image/jpeg;base64,...
   */
  async saveImage({ imageData, imageUrl, prompt, model, provider, scene }) {
    return this.query(
      `INSERT INTO showcase_images (image_data, image_url, prompt, model, provider, scene)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [imageData || '', imageUrl || '', prompt || '', model || '', provider || '', scene || '']
    );
  }

  /**
   * 获取最新的 N 张
   * @param {number} limit - 条数（默认 10，最大 30）
   * @returns {Promise<Array>} [{ id, prompt, model, provider, scene, created_at }]
   */
  async getLatestImages(limit = 10) {
    const cap = Math.min(limit, 30);
    const result = await this.query(
      `SELECT id, image_url, prompt, model, provider, scene, created_at
       FROM showcase_images
       ORDER BY id DESC
       LIMIT ?`,
      [cap]
    );
    // D1 返回格式：[{ results: [...], success: true }]
    if (result && result[0] && result[0].results) {
      return result[0].results;
    }
    return [];
  }

  /**
   * 获取单张图片的完整 data URL（用于详情展示）
   */
  async getImage(id) {
    const result = await this.query(
      'SELECT id, image_data, image_url, prompt, model, provider, scene, created_at FROM showcase_images WHERE id = ?',
      [id]
    );
    if (result && result[0] && result[0].results && result[0].results.length) {
      return result[0].results[0];
    }
    return null;
  }
}

module.exports = { D1Client };
