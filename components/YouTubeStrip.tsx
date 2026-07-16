import Image from "next/image";

const VIDEOS = [
  {
    id: "gPYUjgR0nqI",
    title: "A Beginner's Guide to Buying Cryptocurrency (and Making Money)",
    thumb: "/youtube-beginners-thumb.jpg",
  },
  {
    id: "sg_aDUnJsX8",
    title: "DeFAI Explained: How AI Agents Automate Passive Income",
    thumb: "/youtube-defai-thumb.jpg",
  },
];

export function YouTubeStrip() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Video</p>
            <h2 className="text-2xl font-extrabold text-white">Watch on YouTube</h2>
          </div>
          <a
            href="https://youtube.com/@passiveblocks"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm hidden sm:block"
          >
            Subscribe on YouTube
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {VIDEOS.map((video) => (
            <a
              key={video.id}
              href={`https://youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-blue-400/20 transition-colors group"
            >
              <div className="aspect-video bg-white/[0.05] relative">
                <Image
                  src={video.thumb}
                  alt={video.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors line-clamp-2">
                  {video.title}
                </p>
              </div>
            </a>
          ))}
          {/* Coming soon cards for remaining slots */}
          {Array.from({ length: Math.max(0, 3 - VIDEOS.length) }).map((_, i) => (
            <div key={`soon-${i}`} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="aspect-video bg-white/[0.05] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/30 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-white/25 uppercase tracking-widest">Coming soon</p>
              </div>
            </div>
          ))}
        </div>
        <div className="sm:hidden text-center">
          <a
            href="https://youtube.com/@passiveblocks"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm inline-block"
          >
            Subscribe on YouTube
          </a>
        </div>
      </div>
    </section>
  );
}
