import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@febbox_server';

export interface Server {
  group_id: string;
  country: string;
  description: string;
}

const AVAILABLE_SERVERS: Server[] = [
  { group_id: "USA6", country: "US WEST", description: "Western United States" },
  { group_id: "USA7", country: "US EAST", description: "Eastern United States" },
  { group_id: "USA5", country: "US MIDDLE", description: "Middle United States" },
  { group_id: "UK3", country: "UK", description: "London England" },
  { group_id: "CA1", country: "CA", description: "Canada" },
  { group_id: "FR1", country: "FR", description: "France" },
  { group_id: "DE2", country: "DE", description: "Germany" },
  { group_id: "SG1", country: "SG", description: "Singapore" },
  { group_id: "SZ", country: "CN", description: "China MainLand" },
];

export const useFebBoxServer = () => {
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadServer();
  }, []);

  const loadServer = async () => {
    try {
      const storedGroupId = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedGroupId) {
        const server = AVAILABLE_SERVERS.find(s => s.group_id === storedGroupId);
        if (server) {
          setSelectedServer(server);
        }
      } else {
        // Auto-select USA7 if no server is saved
        const defaultServer = AVAILABLE_SERVERS.find(s => s.group_id === 'USA7');
        if (defaultServer) {
          setSelectedServer(defaultServer);
          await AsyncStorage.setItem(STORAGE_KEY, defaultServer.group_id);
        }
      }
    } catch (error) {
      console.error('Error loading server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectServer = async (server: Server) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, server.group_id);
      setSelectedServer(server);
    } catch (error) {
      console.error('Error saving server:', error);
    }
  };

  return {
    selectedServer,
    availableServers: AVAILABLE_SERVERS,
    isLoading,
    selectServer,
  };
};