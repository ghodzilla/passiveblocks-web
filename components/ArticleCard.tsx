import Link from "next/link";

interface ArticleCardProps {
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  href?: string;
}

export default function ArticleCard({ tag, title, excerpt, date, readTime, href }: ArticleCardProps) {
  const inner = (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-6 flex flex-col gap-3 hover:border-blue-400/20 transition-colors h-full">
      <div className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
        {tag}
      </div>
      <h3 className="font-semibold text-sm leading-snug">{title}</h3>
      <p className="text-xs text-white/40 leading-relaxed flex-1">{excerpt}</p>
      <div className="flex items-center gap-2 text-xs text-white/30 pt-2 border-t border-white/[0.05]">
        <span>{date}</span>
        <span>·</span>
        <span>{readTime} read</span>
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}
