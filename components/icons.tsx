import {
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  book: BookOpen,
  bot: Bot,
  calendar: CalendarDays,
  file: FileText,
  pen: PenLine,
  sparkles: Sparkles,
};

export function ServiceIcon({
  name,
  size = 24,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name] || Sparkles;
  return <Icon size={size} aria-hidden="true" strokeWidth={1.7} />;
}
