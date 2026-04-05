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
