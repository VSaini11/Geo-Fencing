import { API_BASE_URL } from './config';

// Provide the JWT token when calling these functions

export const fetchLocations = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/locations`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch locations');
  return response.json();
};

export const fetchEmployees = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/users/employees`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch employees');
  return response.json();
};

export const createLocation = async (token: string, data: any) => {
    console.log("location sending....")
  const response = await fetch(`${API_BASE_URL}/api/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create location');
  return response.json();
};

export const updateLocation = async (token: string, id: string, data: any) => {
  const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update location');
  return response.json();
};

export const deleteLocation = async (token: string, id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to delete location');
  return response.json();
};

export const fetchCheckIns = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/checkins`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch check-ins');
  return response.json();
};

export const createCheckIn = async (token: string, data: { locationId: string, latitude: number, longitude: number }) => {
  console.log("Checkin API successfully triggered");
  const response = await fetch(`${API_BASE_URL}/api/checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to check in');
  return response.json();
};

export const pingCheckIn = async (token: string, id: string, data: { latitude: number, longitude: number }) => {
  console.log("Location ping API successfully triggered");
  const response = await fetch(`${API_BASE_URL}/api/checkins/${id}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to ping check-in');
  return response.json();
};

export const checkOutCheckIn = async (token: string, id: string, data: { latitude: number, longitude: number, timestamp?: number }) => {
  console.log("Checkout API successfully triggered");
  const response = await fetch(`${API_BASE_URL}/api/checkins/${id}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to check out');
  return response.json();
};

export const fetchDailyLogs = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/dailylogs`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch daily logs');
  return response.json();
};

export const updateLiveLocation = async (token: string, data: { latitude: number, longitude: number }) => {
  console.log("Location API successfully triggered");
  const response = await fetch(`${API_BASE_URL}/api/users/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update live location');
  return response.json();
};
