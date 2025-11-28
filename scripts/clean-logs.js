/**
 * 日志清理脚本
 * 清理超过指定天数的日志文件
 * 使用方法: node scripts/clean-logs.js [days] [logDir]
 * 默认: 清理30天前的日志，日志目录为 ./logs
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_DAYS = 30;
const DEFAULT_LOG_DIR = path.join(__dirname, '..', 'logs');

function cleanLogs(days = DEFAULT_DAYS, logDir = DEFAULT_LOG_DIR) {
  if (!fs.existsSync(logDir)) {
    console.log(`日志目录不存在: ${logDir}`);
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTime = cutoffDate.getTime();

  console.log(`开始清理 ${days} 天前的日志文件...`);
  console.log(`日志目录: ${logDir}`);
  console.log(`截止日期: ${cutoffDate.toISOString().split('T')[0]}`);

  const files = fs.readdirSync(logDir);
  let deletedCount = 0;
  let totalSize = 0;

  files.forEach((file) => {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
      const fileSize = stats.size;
      fs.unlinkSync(filePath);
      deletedCount++;
      totalSize += fileSize;
      console.log(`已删除: ${file} (${formatFileSize(fileSize)})`);
    }
  });

  console.log(`\n清理完成:`);
  console.log(`- 删除文件数: ${deletedCount}`);
  console.log(`- 释放空间: ${formatFileSize(totalSize)}`);
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

cleanLogs(days, logDir);

