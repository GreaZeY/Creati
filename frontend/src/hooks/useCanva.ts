import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    Canva: any;
  }
}

interface CanvaDesignOptions {
  apiKey: string;
  designType: 'SocialMedia' | 'InstagramPost' | 'FacebookPost' | 'TwitterPost' | 'LinkedInPost';
  onDesignExport?: (url: string) => void;
}

export function useCanva(apiKey: string) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.Canva) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.canva.com/designbutton/v2/api.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleaning up script might break other things if it's already used
    };
  }, []);

  const createDesign = useCallback((options: Partial<CanvaDesignOptions> = {}) => {
    if (!window.Canva || !isLoaded) {
      console.error('Canva SDK not loaded');
      return;
    }

    const finalApiKey = options.apiKey || apiKey;
    if (!finalApiKey) {
      console.error('Canva API Key is required');
      return;
    }

    window.Canva.DesignButton.initialize({
      apiKey: finalApiKey,
      designType: options.designType || "SocialMedia",
      onDesignExport: (exportData: any) => {
        if (options.onDesignExport) {
          options.onDesignExport(exportData.exportUrl);
        }
      },
    });
  }, [isLoaded, apiKey]);

  return { isLoaded, createDesign };
}
