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
      .then((res) => setTasks(res.tasks))
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
