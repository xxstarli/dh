"use client";
import { useState } from "react";
import { Globe2, Compass } from "lucide-react";
export function SiteIcon({
  url,
  name,
  large = false,
}: {
  url: string | null;
  name: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={large ? "site-icon large" : "site-icon"}>
      {url && failed !== url ? (
        <img
          src={url}
          alt={name + "图标"}
          onError={() => setFailed(url)}
          width={large ? 104 : 44}
          height={large ? 104 : 44}
        />
      ) : (
        <Globe2 aria-label="默认网站图标" size={large ? 54 : 30} />
      )}
    </span>
  );
}
export function BrandIcon({ url }: { url: string | null }) {
  return url ? (
    <SiteIcon url={url} name="站点" />
  ) : (
    <span className="brand-icon">
      <Compass size={27} strokeWidth={1.6} />
    </span>
  );
}
