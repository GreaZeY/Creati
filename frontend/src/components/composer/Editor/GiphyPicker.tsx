import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/events";

interface GiphyPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ""; // Add to .env

export function GiphyPicker({ isOpen, onClose, onSelect }: GiphyPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-search trending on open
  useEffect(() => {
    if (isOpen && !hasSearched) {
      searchTrending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        searchGifs(searchQuery);
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const searchTrending = async () => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`,
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      toast.error("Failed to load trending GIFs");
    } finally {
      setIsLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      searchTrending();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`,
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      toast.error("Failed to search GIFs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (gif: GiphyGif) => {
    onSelect(gif.images.original.url);
    onClose();
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setSearchQuery("");
      setGifs([]);
      setHasSearched(false);
    }, 200);
  };

  if (!GIPHY_API_KEY) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Giphy">
        <div className="p-6">
          <p className="text-sm text-muted-foreground text-center">
            Giphy API key not configured. Please add VITE_GIPHY_API_KEY to your
            .env file.
          </p>
          <Button onClick={handleClose} className="w-full mt-4">
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add GIF">
      <div className="p-6 w-full max-w-3xl mx-auto">
        {/* Search Bar */}
        <div className="mb-4 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GIPHY..."
            className="w-full h-10 pl-10 pr-10 rounded-lg border border-border/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* GIF Grid */}
        <div className="h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2
                size={32}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : gifs.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  className="aspect-square rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 hover:scale-105 transition-all"
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                {hasSearched ? "No GIFs found" : "Search for GIFs"}
              </p>
            </div>
          )}
        </div>

        {/* Powered by Giphy */}
        <div className="mt-4 text-center">
          <a
            href="https://giphy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
          >
            Powered by GIPHY
          </a>
        </div>
      </div>
    </Modal>
  );
}
