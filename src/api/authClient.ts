import { API_BASE_URL } from './config';
import { Role } from '../hooks/useAuth';

export const registerUser = async (name: string, password: string, role: Role) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, password, role }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to register');
  }
  return data;
};

export const loginUser = async (name: string, password: string, role: Role) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, password, role }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to login');
  }
  return data;
};

export const logoutUser = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to logout');
  }
  return data;
};

export const fetchEmployees = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/users/employees`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch employees');
  }
  return data;
};

export const deleteEmployee = async (token: string, id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete employee');
  }
  return data;
};
