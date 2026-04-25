/**
 * 全局应用配置
 */

// API 基础路径，优先从环境变量读取
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
