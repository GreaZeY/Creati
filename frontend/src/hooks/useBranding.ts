import { useEffect, useState } from "react";
import { publicAPI } from "@/lib/api";

export interface Branding {
  name: string;
  logoUrl: string;
  primaryColor: string;
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const resp = await publicAPI.getBranding();
        if (resp.data.data) {
          const data = resp.data.data;
          setBranding(data);
          
          if (data.primaryColor) {
            // Convert Hex to HSL for Tailwind variables if possible, 
            // or just set a raw hex variable for custom use.
            document.documentElement.style.setProperty('--primary-custom', data.primaryColor);
            // We can also override the main --primary if we want full white-labeling
            // But usually agencies want a separate "brand" color.
          }
        }
      } catch (err) {
        console.error("Failed to load branding", err);
      }
    };

    fetchBranding();
  }, []);

  return branding;
}
