// src/lib/api.ts

import axios from "axios";
import Cookies from "js-cookie";
import {
  LoginCredentials,
  RegisterData,
  Task,
  User,
} from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- Request interceptor: attach JWT token from cookie ----
api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: handle 401 (redirect to login) ----
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----

export async function login(
  credentials: LoginCredentials
): Promise<{ access_token: string; token_type: string }> {
  // Backend expects OAuth2 form data, not JSON
  const formData = new URLSearchParams();
  formData.append("username", credentials.email);
  formData.append("password", credentials.password);
  const response = await api.post("/api/auth/login", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

export async function register(
  data: RegisterData
): Promise<{ access_token: string; token_type: string }> {
  const response = await api.post("/api/auth/register", data);
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get("/api/auth/me");
  return response.data;
}

// ---- Tasks ----

interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
}

export async function getTasks(
  filters?: TaskFilters
): Promise<{ tasks: Task[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    params.append("priority", filters.priority);
  }
  if (filters?.search) {
    params.append("search", filters.search);
  }
  const response = await api.get(`/api/tasks?${params.toString()}`);
  return response.data;
}

export async function getTask(id: string): Promise<Task> {
  const response = await api.get(`/api/tasks/${id}`);
  return response.data;
}

export async function createTask(
  data: Partial<Task>
): Promise<Task> {
  const response = await api.post("/api/tasks", data);
  return response.data;
}

export async function updateTask(
  id: string,
  data: Partial<Task>
): Promise<Task> {
  const response = await api.put(`/api/tasks/${id}`, data);
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/api/tasks/${id}`);
}

// ---- Users ----

export async function getUsers(): Promise<User[]> {
  const response = await api.get("/api/users");
  return response.data;
}

export default api;
