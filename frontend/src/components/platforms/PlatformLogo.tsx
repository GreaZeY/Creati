import Yt from "@/icons/Yt";
import Fb from "@/icons/Fb";
import Instagram from "@/icons/Instagram";
import Linkedin from "@/icons/Linkedin";
import XIcon from "@/icons/X";
import Tiktok from "@/icons/Tiktok";
import Discord from "@/icons/Discord";
import Reddit from "@/icons/Reddit";
import Snapchat from "@/icons/Snapchat";

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

export const PlatformLogo = ({
  platform,
  className,
  size = 24,
}: PlatformLogoProps) => {
  const styles = { width: size, height: size };

  if (!platform) return null;

  switch (platform.toLowerCase()) {
    case "youtube":
      return <Yt className={className} style={styles} />;
    case "instagram":
      return <Instagram className={className} style={styles} />;
    case "facebook":
      return <Fb className={className} style={styles} />;
    case "linkedin":
      return <Linkedin className={className} style={styles} />;
    case "x":
    case "twitter":
      return <XIcon className={className} style={styles} />;
    case "tiktok":
      return <Tiktok className={className} style={styles} />;
    case "discord":
      return <Discord className={className} style={styles} />;
    case "reddit":
      return <Reddit className={className} style={styles} />;
    case "snapchat":
      return <Snapchat className={className} style={styles} />;
    default:
      return null;
  }
};
