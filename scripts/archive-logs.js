/**
 * 日志归档脚本
 * 压缩并归档指定天数前的日志文件
 * 使用方法: node scripts/archive-logs.js [days] [logDir]
 * 默认: 归档7天前的日志，日志目录为 ./logs
 */

const fs = require('fs');
const path = require('path');
const { gzip } = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(gzip);

const DEFAULT_DAYS = 7;
const DEFAULT_LOG_DIR = path.join(__dirname, '..', 'logs');

async function archiveLogs(days = DEFAULT_DAYS, logDir = DEFAULT_LOG_DIR) {
  if (!fs.existsSync(logDir)) {
    console.log(`日志目录不存在: ${logDir}`);
    return;
  }

  const archiveDir = path.join(logDir, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTime = cutoffDate.getTime();

  console.log(`开始归档 ${days} 天前的日志文件...`);
  console.log(`日志目录: ${logDir}`);
  console.log(`归档目录: ${archiveDir}`);
  console.log(`截止日期: ${cutoffDate.toISOString().split('T')[0]}`);

  const files = fs.readdirSync(logDir);
  let archivedCount = 0;
  let totalSize = 0;
  let compressedSize = 0;

  for (const file of files) {
    // 跳过非日志文件和已归档文件
    if (!file.endsWith('.log') || file.includes('archive')) continue;

    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
      try {
        const fileSize = stats.size;
        const content = fs.readFileSync(filePath);
        const compressed = await gzipAsync(content);
        const archivePath = path.join(archiveDir, `${file}.gz`);
        
        fs.writeFileSync(archivePath, compressed);
        fs.unlinkSync(filePath);
        
        archivedCount++;
        totalSize += fileSize;
        compressedSize += compressed.length;
        
        const compressionRatio = ((1 - compressed.length / fileSize) * 100).toFixed(1);
        console.log(`已归档: ${file} (${formatFileSize(fileSize)} -> ${formatFileSize(compressed.length)}, 压缩率: ${compressionRatio}%)`);
      } catch (error) {
        console.error(`归档失败: ${file}`, error.message);
      }
    }
  }

  console.log(`\n归档完成:`);
  console.log(`- 归档文件数: ${archivedCount}`);
  console.log(`- 原始大小: ${formatFileSize(totalSize)}`);
  console.log(`- 压缩后大小: ${formatFileSize(compressedSize)}`);
  console.log(`- 节省空间: ${formatFileSize(totalSize - compressedSize)} (${((1 - compressedSize / totalSize) * 100).toFixed(1)}%)`);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 解析命令行参数
const days = parseInt(process.argv[2]) || DEFAULT_DAYS;
const logDir = process.argv[3] || DEFAULT_LOG_DIR;

archiveLogs(days, logDir).catch(console.error);

