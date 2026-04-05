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
  const [status, setStatus] = useState<string>(
    initialData?.status || "todo"
  );
  const [priority, setPriority] = useState<string>(
    initialData?.priority || "medium"
  );
  const [assignedTo, setAssignedTo] = useState(
    initialData?.assigned_to || ""
  );
  const [dueDate, setDueDate] = useState(
    initialData?.due_date || ""
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
      });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosError.response?.data?.detail || "Something went wrong."
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

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {isEdit ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
