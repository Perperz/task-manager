# 06 — Frontend Service (Next.js + React + Tailwind)

Next.js is a React framework that adds server-side rendering, file-based routing, and production optimizations on top of React. In this chapter we build the entire frontend for our Task Manager: authentication screens, a dashboard, and full CRUD for tasks. Tailwind CSS is a utility-first CSS framework where you style elements using predefined classes directly in your HTML/JSX — no separate CSS files needed for most work.

---

## 6.1 Scaffold the Project

```bash
cd services
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd frontend
npm install axios js-cookie
npm install -D @types/js-cookie
```

**What each flag does:**

| Flag | Purpose |
|------|---------|
| `--typescript` | Generates the project with TypeScript configuration and `.tsx`/`.ts` files instead of plain JavaScript. |
| `--tailwind` | Pre-configures Tailwind CSS so utility classes work out of the box. |
| `--eslint` | Adds ESLint with Next.js-specific linting rules for catching common mistakes. |
| `--app` | Uses the **App Router**, Next.js's recommended routing approach where each folder inside `src/app/` becomes a URL route. For example, `src/app/dashboard/page.tsx` automatically maps to `/dashboard`. |
| `--src-dir` | Places application code inside a `src/` directory, keeping the project root clean. |
| `--no-import-alias` | Skips the `@/` import alias prompt, using relative imports instead. |

The two `npm install` commands add **axios** (HTTP client for API calls), **js-cookie** (read/write browser cookies for JWT storage), and the TypeScript type definitions for js-cookie.

---

## 6.2 Project Configuration

### next.config.js

The `output: "standalone"` setting tells Next.js to produce a self-contained build that bundles only the files needed to run in production. This is essential for Docker — it means the container doesn't need the full `node_modules` directory.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

### tailwind.config.ts

We extend the default Tailwind palette with custom colors for task statuses and priorities so we can write classes like `bg-status-todo` or `text-priority-high` throughout the app.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          todo: "#6b7280",       // gray
          in_progress: "#3b82f6", // blue
          done: "#22c55e",       // green
        },
        priority: {
          low: "#22c55e",    // green
          medium: "#eab308", // yellow
          high: "#ef4444",   // red
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 6.3 TypeScript Types (`src/types/index.ts`)

**TypeScript interfaces** define the shape of data objects. They catch type errors at compile time rather than runtime — if the backend returns a field you didn't expect (or omits one you depend on), TypeScript flags it before the code ever runs.

```ts
// src/types/index.ts

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  tags: string[];
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
  total?: number; // optional — present on paginated list responses
}
```

---

## 6.4 API Client (`src/lib/api.ts`)

This module creates a centralized axios instance that every page and component uses to talk to the backend. The request interceptor automatically attaches the JWT token, and the response interceptor handles expired sessions globally so individual components don't need to.

```ts
// src/lib/api.ts

import axios from "axios";
import Cookies from "js-cookie";
import {
  ApiResponse,
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
): Promise<{ access_token: string; user: User }> {
  const response = await api.post("/auth/login", credentials);
  return response.data;
}

export async function register(
  data: RegisterData
): Promise<{ access_token: string; user: User }> {
  const response = await api.post("/auth/register", data);
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get("/auth/me");
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
): Promise<ApiResponse<Task[]>> {
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
  const response = await api.get(`/tasks?${params.toString()}`);
  return response.data;
}

export async function getTask(id: string): Promise<Task> {
  const response = await api.get(`/tasks/${id}`);
  return response.data;
}

export async function createTask(
  data: Partial<Task>
): Promise<Task> {
  const response = await api.post("/tasks", data);
  return response.data;
}

export async function updateTask(
  id: string,
  data: Partial<Task>
): Promise<Task> {
  const response = await api.put(`/tasks/${id}`, data);
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

// ---- Users ----

export async function getUsers(): Promise<User[]> {
  const response = await api.get("/users");
  return response.data;
}

export default api;
```

---

## 6.5 Auth Context (`src/context/AuthContext.tsx`)

**React Context** provides a way to share data (like the current user) across all components without passing it through every level of props. It is like a global variable that any component can read.

**`useState`** is a React Hook that lets a component remember values between renders. When you call the setter function, React re-renders the component with the new value.

**`useEffect`** is a React Hook that runs code after the component renders. It is used for side effects like fetching data or setting up subscriptions. The dependency array (the second argument) controls when it re-runs — an empty array `[]` means "run once on mount."

```tsx
// src/context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import Cookies from "js-cookie";
import { User, LoginCredentials, RegisterData } from "@/types";
import * as api from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to load the user from the existing token
  useEffect(() => {
    const loadUser = async () => {
      const token = Cookies.get("token");
      if (token) {
        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
        } catch {
          Cookies.remove("token");
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await api.login(credentials);
    Cookies.set("token", response.access_token, { expires: 7 });
    setUser(response.user);
  };

  const register = async (data: RegisterData) => {
    const response = await api.register(data);
    Cookies.set("token", response.access_token, { expires: 7 });
    setUser(response.user);
  };

  const logout = () => {
    Cookies.remove("token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — saves every consumer from writing useContext(AuthContext)
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

---

## 6.6 Layout (`src/app/layout.tsx` and `src/app/globals.css`)

### `src/app/globals.css`

The three `@tailwind` directives inject Tailwind's generated styles. `base` resets browser defaults, `components` is for reusable class patterns, and `utilities` is the bulk of Tailwind's utility classes.

```css
/* src/app/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  background-color: #f9fafb;
  color: #111827;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

### `src/app/layout.tsx`

The root layout wraps the entire application. Every page receives the `AuthProvider` context, the global CSS, and the base HTML structure.

```tsx
// src/app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "A full-stack task management application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

---

## 6.7 UI Components (`src/components/ui/`)

These are small, reusable building blocks used throughout the application. Each component accepts **props** — inputs passed to a component, like function arguments. Props are read-only; a component cannot modify its own props.

### `Button.tsx`

```tsx
// src/components/ui/Button.tsx
"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantClasses = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
        focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
```

### `Input.tsx`

```tsx
// src/components/ui/Input.tsx
"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-md border border-gray-300 px-3 py-2
          text-gray-900 placeholder-gray-400 focus:border-blue-500
          focus:outline-none focus:ring-1 focus:ring-blue-500
          ${error ? "border-red-500" : ""} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

### `Card.tsx`

```tsx
// src/components/ui/Card.tsx

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${className}`}
    >
      {children}
    </div>
  );
}
```

### `Badge.tsx`

```tsx
// src/components/ui/Badge.tsx

interface BadgeProps {
  variant:
    | "todo"
    | "in_progress"
    | "done"
    | "low"
    | "medium"
    | "high";
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5
        text-xs font-medium ${variantClasses[variant] || ""}`}
    >
      {children}
    </span>
  );
}
```

### `Loading.tsx`

```tsx
// src/components/ui/Loading.tsx

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg
        className="animate-spin h-8 w-8 text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}
```

### `Modal.tsx`

**The `children` prop** is a special React prop that contains whatever JSX is placed between a component's opening and closing tags: `<Modal>this is children</Modal>`. It lets you create wrapper components that don't need to know their inner content ahead of time.

```tsx
// src/components/ui/Modal.tsx
"use client";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

---

## 6.8 Layout Components (`src/components/layout/`)

### `Header.tsx`

**Conditional rendering:** In React, you can conditionally show elements using `{condition && <Element />}` or the ternary form `{condition ? <A /> : <B />}`. A component returns `null` to render nothing.

```tsx
// src/components/layout/Header.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-xl font-bold text-blue-600">
            Task Manager
          </h1>

          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Hello, {user.full_name || user.username}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

### `Sidebar.tsx`

**Next.js `<Link>`** enables client-side navigation — clicking it does not reload the whole page, it just swaps the content area. This is much faster than regular `<a>` tags because only the changed parts of the page are re-rendered.

```tsx
// src/components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium
                transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## 6.9 Task Components (`src/components/tasks/`)

### `TaskCard.tsx`

**Component composition:** React components are like building blocks. `TaskList` renders multiple `TaskCard` components, and each `TaskCard` uses `Badge`, `Card`, and `Button`. This makes code reusable and easy to maintain — change `Badge` once and every task card picks up the update.

```tsx
// src/components/tasks/TaskCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { Task } from "@/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No due date";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div onClick={() => router.push(`/tasks/${task.id}`)}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {task.title}
          </h3>
          <Badge variant={task.priority}>{task.priority}</Badge>
        </div>

        {task.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm">
          <Badge variant={task.status}>
            {task.status.replace("_", " ")}
          </Badge>
          <span className="text-gray-500">
            Due: {formatDate(task.due_date)}
          </span>
        </div>

        {task.assigned_to && (
          <p className="text-xs text-gray-400 mt-2">
            Assigned to: {task.assigned_to}
          </p>
        )}
      </div>
    </Card>
  );
}
```

### `TaskList.tsx`

**Lists and Keys:** When rendering arrays with `.map()`, each element needs a unique `key` prop. React uses keys to efficiently update only the items that changed rather than re-rendering the entire list.

```tsx
// src/components/tasks/TaskList.tsx

import { Task } from "@/types";
import TaskCard from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
}

export default function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No tasks found.</p>
        <p className="text-gray-400 text-sm mt-1">
          Create a new task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### `TaskForm.tsx`

**Controlled components:** In React, form inputs whose values are controlled by state are called "controlled components." The state is the single source of truth — when the user types, an `onChange` handler updates state, which in turn updates the input's displayed value.

**Event handling:** React events (`onClick`, `onChange`, `onSubmit`) work like HTML events but use camelCase naming. The handler function receives an event object. Use `e.preventDefault()` on form submission to stop the browser from reloading the page.

```tsx
// src/components/tasks/TaskForm.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { Task, User } from "@/types";
import { getUsers } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface TaskFormProps {
  initialData?: Partial<Task>;
  onSubmit: (data: Partial<Task>) => Promise<void>;
  isEdit?: boolean;
}

export default function TaskForm({
  initialData,
  onSubmit,
  isEdit = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [status, setStatus] = useState(
    initialData?.status || "todo"
  );
  const [priority, setPriority] = useState(
    initialData?.priority || "medium"
  );
  const [assignedTo, setAssignedTo] = useState(
    initialData?.assigned_to || ""
  );
  const [dueDate, setDueDate] = useState(
    initialData?.due_date || ""
  );
  const [tags, setTags] = useState(
    initialData?.tags?.join(", ") || ""
  );
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await onSubmit({
        title,
        description,
        status: status as Task["status"],
        priority: priority as Task["priority"],
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Enter task title"
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2
            text-gray-900 placeholder-gray-400 focus:border-blue-500
            focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Describe the task..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2
              text-gray-900 focus:border-blue-500 focus:outline-none
              focus:ring-1 focus:ring-blue-500"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2
              text-gray-900 focus:border-blue-500 focus:outline-none
              focus:ring-1 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assign To
        </label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2
            text-gray-900 focus:border-blue-500 focus:outline-none
            focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.username}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Due Date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />

      <Input
        label="Tags (comma-separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="e.g. frontend, bug, urgent"
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {isEdit ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
```

### `TaskFilters.tsx`

```tsx
// src/components/tasks/TaskFilters.tsx
"use client";

import { useState } from "react";

interface Filters {
  status: string;
  priority: string;
  search: string;
}

interface TaskFiltersProps {
  onFilterChange: (filters: Filters) => void;
}

export default function TaskFilters({
  onFilterChange,
}: TaskFiltersProps) {
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    priority: "all",
    search: "",
  });

  const handleChange = (key: keyof Filters, value: string) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Status
        </label>
        <select
          value={filters.status}
          onChange={(e) => handleChange("status", e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm
            focus:border-blue-500 focus:outline-none focus:ring-1
            focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Priority
        </label>
        <select
          value={filters.priority}
          onChange={(e) => handleChange("priority", e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm
            focus:border-blue-500 focus:outline-none focus:ring-1
            focus:ring-blue-500"
        >
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Search
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          placeholder="Search tasks..."
          className="w-full rounded-md border border-gray-300 px-3 py-2
            text-sm focus:border-blue-500 focus:outline-none
            focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
```

---

## 6.10 Pages

### Login Page (`src/app/login/page.tsx`)

```tsx
// src/app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Invalid email or password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sign In
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />
          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full"
          >
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-blue-600 hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### Register Page (`src/app/register/page.tsx`)

```tsx
// src/app/register/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await register({
        username,
        email,
        password,
        full_name: fullName,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Registration failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Create Account
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jane Doe"
          />
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="janedoe"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Choose a strong password"
          />
          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full"
          >
            Register
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### Dashboard Page (`src/app/dashboard/page.tsx`)

```tsx
// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getTasks } from "@/lib/api";
import { Task } from "@/types";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import Card from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import TaskList from "@/components/tasks/TaskList";

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      getTasks()
        .then((res) => setTasks(res.data))
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return <Loading />;
  }

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress"
  ).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <h2 className="text-2xl font-bold mb-6">
            Welcome back, {user?.full_name || user?.username}!
          </h2>

          {isLoading ? (
            <Loading />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <p className="text-sm text-gray-500">Total Tasks</p>
                  <p className="text-3xl font-bold">{tasks.length}</p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">To Do</p>
                  <p className="text-3xl font-bold text-gray-600">
                    {todoCount}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {inProgressCount}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Done</p>
                  <p className="text-3xl font-bold text-green-600">
                    {doneCount}
                  </p>
                </Card>
              </div>

              <h3 className="text-lg font-semibold mb-4">
                Recent Tasks
              </h3>
              <TaskList tasks={recentTasks} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
```

### Tasks List Page (`src/app/tasks/page.tsx`)

```tsx
// src/app/tasks/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getTasks } from "@/lib/api";
import { Task } from "@/types";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import TaskList from "@/components/tasks/TaskList";
import TaskFilters from "@/components/tasks/TaskFilters";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";

export default function TasksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchTasks = (filters?: {
    status: string;
    priority: string;
    search: string;
  }) => {
    setIsLoading(true);
    getTasks(filters)
      .then((res) => setTasks(res.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Tasks</h2>
            <Link href="/tasks/new">
              <Button>New Task</Button>
            </Link>
          </div>

          <TaskFilters onFilterChange={fetchTasks} />

          {isLoading ? <Loading /> : <TaskList tasks={tasks} />}
        </main>
      </div>
    </div>
  );
}
```

### New Task Page (`src/app/tasks/new/page.tsx`)

```tsx
// src/app/tasks/new/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createTask } from "@/lib/api";
import { Task } from "@/types";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import TaskForm from "@/components/tasks/TaskForm";
import Loading from "@/components/ui/Loading";

export default function NewTaskPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return <Loading />;
  }

  const handleSubmit = async (data: Partial<Task>) => {
    await createTask(data);
    router.push("/tasks");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <h2 className="text-2xl font-bold mb-6">Create New Task</h2>
          <TaskForm onSubmit={handleSubmit} />
        </main>
      </div>
    </div>
  );
}
```

### Task Detail Page (`src/app/tasks/[id]/page.tsx`)

**Dynamic routes:** The `[id]` folder name means this route matches any URL like `/tasks/abc123`. Next.js passes the `id` value via the `params` prop so you can fetch the specific task.

```tsx
// src/app/tasks/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getTask, updateTask, deleteTask } from "@/lib/api";
import { Task } from "@/types";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import TaskForm from "@/components/tasks/TaskForm";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";

export default function TaskDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && taskId) {
      getTask(taskId)
        .then(setTask)
        .catch(() => router.push("/tasks"))
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated, taskId, router]);

  if (authLoading || !isAuthenticated || isLoading) {
    return <Loading />;
  }

  if (!task) {
    return null;
  }

  const handleUpdate = async (data: Partial<Task>) => {
    await updateTask(taskId, data);
    router.push("/tasks");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTask(taskId);
      router.push("/tasks");
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Edit Task</h2>
            <Button
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Task
            </Button>
          </div>

          <TaskForm
            initialData={task}
            onSubmit={handleUpdate}
            isEdit
          />

          <Modal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            title="Delete Task"
          >
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;{task.title}
              &quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isDeleting}
              >
                Delete
              </Button>
            </div>
          </Modal>
        </main>
      </div>
    </div>
  );
}
```

---

## 6.11 Run and Test

Start the development server:

```bash
cd services/frontend
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The backend API must be running on port 8000 for API calls to work (see the previous chapter).

**Test flow:**

1. Visit `/register` and create a new account.
2. You are redirected to `/dashboard` — task stats should show all zeros.
3. Click **Tasks** in the sidebar, then click **New Task**.
4. Fill in the form and submit — the new task appears in the list.
5. Click the task card to open the detail/edit page. Make a change and save.
6. Click **Delete Task**, confirm in the modal, and verify the task is removed from the list.

If everything works, you have a fully functional frontend communicating with the FastAPI backend through JWT-authenticated API calls.

---

**Next:** [07-dockerization.md](07-dockerization.md) — Containerize both services with Docker.
