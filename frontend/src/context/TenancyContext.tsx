import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Branding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface TenancyContextType {
  branding: Branding | null;
  isCustomBranded: boolean;
  isLoading: boolean;
}

const TenancyContext = createContext<TenancyContextType | undefined>(undefined);

export const TenancyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const resp = await api.get("/pub/branding");
        if (resp.data.success) {
          const data = resp.data.data;
          setBranding(data);

          // Apply CSS Variables
          if (data.primaryColor) {
            document.documentElement.style.setProperty(
              "--primary",
              data.primaryColor,
            );
            // Also need to handle HSL for Tailwind if primary is defined in HSL
            // For now, assume it's a hex and apply directly to a custom var that components can use
            document.documentElement.style.setProperty(
              "--agency-primary",
              data.primaryColor,
            );
          }

          if (data.name) {
            document.title = `${data.name} | Creati`;
          }

          if (data.logoUrl) {
            let link = document.querySelector(
              "link[rel~='icon']",
            ) as HTMLLinkElement;
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.getElementsByTagName("head")[0].appendChild(link);
            }
            link.href = data.logoUrl;
          }
        }
      } catch (err) {
        console.error("No custom branding resolved or failed to fetch", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranding();
  }, []);

  return (
    <TenancyContext.Provider
      value={{
        branding,
        isCustomBranded: !!branding,
        isLoading,
      }}
    >
      {children}
    </TenancyContext.Provider>
  );
};

export const useTenancy = () => {
  const context = useContext(TenancyContext);
  if (context === undefined) {
    throw new Error("useTenancy must be used within a TenancyProvider");
  }
  return context;
};
