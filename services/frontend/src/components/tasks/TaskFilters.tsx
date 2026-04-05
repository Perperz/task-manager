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
