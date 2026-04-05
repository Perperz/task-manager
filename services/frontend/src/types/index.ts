// src/types/index.ts

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name: string;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  total?: number;
}
