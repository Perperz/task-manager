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
