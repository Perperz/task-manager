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
