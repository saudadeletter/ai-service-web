export const serviceOptions = [
  "专属 AI 助手定制",
  "ChatGPT 订阅协助",
  "两项都想了解",
] as const;
export const sceneOptions = [
  "期末复习",
  "简历与求职",
  "学习计划",
  "内容创作",
  "订阅咨询",
  "其他 / 还没想好",
] as const;
export const timelineOptions = [
  "先了解，不着急",
  "一周内",
  "两周内",
  "时间另行沟通",
] as const;
export const budgetOptions = [
  "希望先了解报价",
  "100 元以内",
  "100–300 元",
  "300 元以上",
] as const;
export const statusLabels = {
  NEW: "待沟通",
  CONTACTED: "已沟通",
  IN_PROGRESS: "处理中",
  COMPLETED: "已完成",
  CLOSED: "已关闭",
} as const;
export type Status = keyof typeof statusLabels;

export type PublicRequest = {
  number: string;
  service: string;
  scene: string;
  status: Status;
  publicNote: string;
  createdAt: string;
  updatedAt: string;
};
