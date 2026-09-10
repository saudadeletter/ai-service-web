"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { ServiceIcon } from "@/components/icons";

const demos = [
  {
    label: "期末复习",
    icon: "book",
    title: "复习这件事，\n先理出头绪。",
    question: "课件有点多，不知道怎么复习……",
    answer: "先整理知识框架，再把复习拆成每天的小任务。",
    tasks: ["归纳知识点", "制定复习计划", "生成自测练习"],
  },
  {
    label: "简历与求职",
    icon: "file",
    title: "你的经历，\n值得被看见。",
    question: "做过不少事情，简历却不知道怎么写。",
    answer: "对照目标岗位，把经历整理成有依据、有重点的表达。",
    tasks: ["梳理项目经历", "修改简历表达", "准备面试练习"],
  },
  {
    label: "学习计划",
    icon: "calendar",
    title: "大一点的目标，\n小一点的每天。",
    question: "计划写满一页，执行总是跟不上。",
    answer: "从实际可用的时间出发，安排任务，也给调整留出空间。",
    tasks: ["拆解学习目标", "安排每日任务", "定期回顾调整"],
  },
  {
    label: "内容创作",
    icon: "pen",
    title: "从一个想法，\n到第一份初稿。",
    question: "想做点内容，总是卡在开头。",
    answer: "先找一个具体切入点，再搭结构、写初稿，由你把关修改。",
    tasks: ["整理选题方向", "搭建脚本结构", "生成可改初稿"],
  },
] as const;

export function SceneBoard() {
  const [active, setActive] = useState(0);
  const scene = demos[active];
  return (
    <div className="scene-studio">
      <div className="studio-note">
        <Sparkles size={15} /> 一起把「不会」变成「我来试试」
      </div>
      <div className="hero-board">
        <div className="board-heading">
          <span className="tiny-label">今天，给自己减点负</span>
          <span className="board-index">0{active + 1} / 04</span>
        </div>
        <div className="scene-options" role="group" aria-label="选择演示场景">
          {demos.map((item, index) => (
            <button
              type="button"
              key={item.label}
              aria-pressed={active === index}
              aria-controls="scene-preview"
              onClick={() => setActive(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div id="scene-preview" aria-live="polite" aria-atomic="true">
          <div className="scene-preview-content" key={active}>
            <div className="board-title">
              <ServiceIcon name={scene.icon} size={32} />
              <h2 className="preserve-text">{scene.title}</h2>
            </div>
            <div className="message message-user">{scene.question}</div>
            <div className="message message-agent">
              <span className="message-author">
                <Sparkles size={16} /> {scene.label}助手 · 能做什么
              </span>
              <p>{scene.answer}</p>
              <div className="mini-tasks">
                {scene.tasks.map((task) => (
                  <span key={task}>
                    <Check size={15} /> {task}
                  </span>
                ))}
              </div>
            </div>
            <div className="board-bottom">
              <span>使用场景示意</span>
              <Link href={`/custom?scene=${encodeURIComponent(scene.label)}`}>
                定制我的助手 <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
      <span className="studio-caption">点选上方场景，看看 AI 能怎样帮忙</span>
    </div>
  );
}
