import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLocations, fetchCheckIns, createLocation, updateLocation, deleteLocation, createCheckIn, pingCheckIn, checkOutCheckIn, fetchEmployees, fetchDailyLogs, updateLiveLocation } from "@/api/geofenceClient";
import { useAuth } from "./useAuth";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHED_LOCATIONS_KEY, CACHED_CHECKINS_KEY, LAST_BG_SYNC_KEY } from "@/tasks/geofenceTask";

export const getListLocationsQueryKey = () => ["locations"];
export const getListCheckInsQueryKey = () => ["checkins"];
export const getListDailyLogsQueryKey = () => ["dailylogs"];

export function useListLocations() {
  const { token } = useAuth();
  const [cachedData, setCachedData] = useState<{ data: any[] | undefined; ts: number | undefined }>({
    data: undefined,
    ts: undefined,
  });

  useEffect(() => {
    (async () => {
      try {
        const [locsStr, syncStr] = await Promise.all([
          AsyncStorage.getItem(CACHED_LOCATIONS_KEY),
          AsyncStorage.getItem(LAST_BG_SYNC_KEY),
        ]);
        if (locsStr) {
          setCachedData({
            data: JSON.parse(locsStr),
            ts: syncStr ? parseInt(syncStr, 10) : undefined,
          });
        }
      } catch {}
    })();
  }, []);

  return useQuery({
    queryKey: getListLocationsQueryKey(),
    queryFn: () => fetchLocations(token!),
    enabled: !!token,
    refetchInterval: 10000,
    ...(cachedData.data ? { initialData: cachedData.data, initialDataUpdatedAt: cachedData.ts } : {}),
  });
}

export function useListCheckIns() {
  const { token } = useAuth();
  const [cachedData, setCachedData] = useState<{ data: any[] | undefined; ts: number | undefined }>({
    data: undefined,
    ts: undefined,
  });

  useEffect(() => {
    (async () => {
      try {
        const [checkinsStr, syncStr] = await Promise.all([
          AsyncStorage.getItem(CACHED_CHECKINS_KEY),
          AsyncStorage.getItem(LAST_BG_SYNC_KEY),
        ]);
        if (checkinsStr) {
          setCachedData({
            data: JSON.parse(checkinsStr),
            ts: syncStr ? parseInt(syncStr, 10) : undefined,
          });
        }
      } catch {}
    })();
  }, []);

  return useQuery({
    queryKey: getListCheckInsQueryKey(),
    queryFn: () => fetchCheckIns(token!),
    enabled: !!token,
    refetchInterval: 5000,
    // Always treat cached checkins as stale — this ensures dataUpdatedAt is
    // updated on every mount (app open), which is required for the geofence
    // startup guard that prevents wrong check-in timestamps.
    staleTime: 0,
    ...(cachedData.data ? { initialData: cachedData.data, initialDataUpdatedAt: cachedData.ts } : {}),
  });
}

export function useListDailyLogs() {
  const { token } = useAuth();
  return useQuery({
    queryKey: getListDailyLogsQueryKey(),
    queryFn: () => fetchDailyLogs(token!),
    enabled: !!token,
    refetchInterval: 10000,
  });
}

export const getListEmployeesQueryKey = () => ["employees"];

export function useListEmployees() {
  const { token } = useAuth();
  return useQuery({
    queryKey: getListEmployeesQueryKey(),
    queryFn: () => fetchEmployees(token!),
    enabled: !!token,
    refetchInterval: 5000,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: any) => createLocation(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
    }
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => updateLocation(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
    }
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (id: string) => deleteLocation(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
    }
  });
}

export function useCreateCheckIn() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: any) => createCheckIn(token!, data.data),
  });
}

export function usePingCheckIn() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => pingCheckIn(token!, id, data),
  });
}

export function useCheckOutCheckIn() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => checkOutCheckIn(token!, id, data),
  });
}

export function useUpdateLiveLocation() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: { latitude: number, longitude: number }) => updateLiveLocation(token!, data),
  });
}
