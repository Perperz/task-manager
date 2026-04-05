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
        .then((res) => setTasks(res.tasks))
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
