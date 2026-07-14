import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account/", "/drafts/"],
    },
    sitemap: "https://www.passiveblocks.io/sitemap.xml",
  };
}
