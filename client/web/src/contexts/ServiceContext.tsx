'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getServices, getServiceInfo, checkService } from '@/app/actions/jam';

export interface JamService {
  id: string;
  name: string;
  version?: string;
  author?: string;
}

interface ServiceContextType {
  services: JamService[];
  selectedService: JamService | null;
  isLoading: boolean;
  error: string | null;
  selectService: (serviceId: string) => void;
  refreshServices: () => Promise<void>;
  addCustomService: (serviceId: string) => Promise<boolean>;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

const STORAGE_KEY = 'jam-selected-service';
const CUSTOM_SERVICES_KEY = 'jam-custom-services';

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<JamService[]>([]);
  const [selectedService, setSelectedService] = useState<JamService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get services from chain
      const result = await getServices();

      if (result.error) {
        setError(result.error);
        setServices([]);
        return;
      }

      // Get any custom services from localStorage
      const customServicesJson = localStorage.getItem(CUSTOM_SERVICES_KEY);
      const customServiceIds: string[] = customServicesJson ? JSON.parse(customServicesJson) : [];

      // Merge chain services with custom services
      const allServices = [...result.services];
      for (const customId of customServiceIds) {
        if (!allServices.some(s => s.id === customId)) {
          const info = await getServiceInfo(customId);
          if (info) {
            allServices.push({
              id: customId,
              name: info.name,
              version: info.version,
              author: info.author,
            });
          }
        }
      }

      setServices(allServices);

      // Restore previously selected service
      const savedServiceId = localStorage.getItem(STORAGE_KEY);
      if (savedServiceId) {
        const savedService = allServices.find(s => s.id === savedServiceId);
        if (savedService) {
          setSelectedService(savedService);
        } else if (allServices.length > 0) {
          // If saved service no longer exists, select first non-bootstrap service
          const defaultService = allServices.find(s => s.id !== '00000000') || allServices[0];
          if (defaultService) {
            setSelectedService(defaultService);
            localStorage.setItem(STORAGE_KEY, defaultService.id);
          }
        }
      } else if (allServices.length > 0) {
        // No saved service, select first non-bootstrap service
        const defaultService = allServices.find(s => s.id !== '00000000') || allServices[0];
        if (defaultService) {
          setSelectedService(defaultService);
          localStorage.setItem(STORAGE_KEY, defaultService.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectService = useCallback((serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setSelectedService(service);
      localStorage.setItem(STORAGE_KEY, serviceId);
    }
  }, [services]);

  const addCustomService = useCallback(async (serviceId: string): Promise<boolean> => {
    // Validate service ID format (8 hex chars, with or without 0x prefix)
    const cleanId = serviceId.toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{1,8}$/i.test(cleanId)) {
      setError('Invalid service ID format. Must be up to 8 hex characters.');
      return false;
    }

    // Normalize to 8 chars with leading zeros
    const normalizedId = cleanId.padStart(8, '0');

    // Check if already exists
    if (services.some(s => s.id === normalizedId)) {
      selectService(normalizedId);
      return true;
    }

    // Try to fetch service info using checkService for proper normalization
    const info = await checkService(normalizedId);
    if (!info) {
      setError(`Service ${normalizedId} not found on chain`);
      return false;
    }

    // Add to custom services in localStorage
    const customServicesJson = localStorage.getItem(CUSTOM_SERVICES_KEY);
    const customServiceIds: string[] = customServicesJson ? JSON.parse(customServicesJson) : [];
    if (!customServiceIds.includes(info.id)) {
      customServiceIds.push(info.id);
      localStorage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify(customServiceIds));
    }

    // Add to services list
    const newService: JamService = {
      id: info.id,
      name: info.name,
      version: info.version,
      author: info.author,
    };
    setServices(prev => [...prev, newService]);
    setSelectedService(newService);
    localStorage.setItem(STORAGE_KEY, info.id);
    setError(null);

    return true;
  }, [services, selectService]);

  useEffect(() => {
    refreshServices();
  }, [refreshServices]);

  return (
    <ServiceContext.Provider
      value={{
        services,
        selectedService,
        isLoading,
        error,
        selectService,
        refreshServices,
        addCustomService,
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
}

export function useService() {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useService must be used within a ServiceProvider');
  }
  return context;
}
