import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account/", "/drafts/", "/os/"],
    },
    sitemap: "https://www.passiveblocks.io/sitemap.xml",
  };
}
