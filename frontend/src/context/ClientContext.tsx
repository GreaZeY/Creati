import React, { createContext, useContext, useEffect, useState } from "react";
import { agencyAPI } from "@/lib/api";

// Define types locally for now, ideally in a types file
export interface AgencyClient {
  id: number;
  name: string;
  color: string;
  logoUrl?: string;
  orgName?: string;
  createdAt: string;
}

interface ClientContextType {
  clients: AgencyClient[];
  selectedClient: AgencyClient | null;
  isLoading: boolean;
  selectClient: (client: AgencyClient | null) => void;
  refreshClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<AgencyClient | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Fetch clients on mount
  const refreshClients = async () => {
    try {
      setIsLoading(true);
      const response = await agencyAPI.listClients();

      if (response.data.success) {
        setClients(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshClients();
  }, []);

  // Restore selection from local storage
  useEffect(() => {
    if (!isLoading && clients.length > 0) {
      const savedClientId = localStorage.getItem("creati_selected_client_id");
      if (savedClientId) {
        const found = clients.find((c) => c.id === parseInt(savedClientId));
        if (found) {
          setSelectedClient(found);
          return;
        }
      }
      // Default to "Personal Workspace" (null) if no memory or not found
    }
  }, [isLoading, clients]);

  const selectClient = (client: AgencyClient | null) => {
    setSelectedClient(client);
    if (client) {
      localStorage.setItem("creati_selected_client_id", client.id.toString());
    } else {
      localStorage.removeItem("creati_selected_client_id"); // Personal workspace
    }
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        isLoading,
        selectClient,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error("useClient must be used within a ClientProvider");
  }
  return context;
};
