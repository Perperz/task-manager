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
