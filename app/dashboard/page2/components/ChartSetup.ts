"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const CHART_COLORS = [
  "#e9434a",
  "#ff7a85",
  "#f59e0b",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#06b6d4",
  "#ec4899",
];

export const CHART_FONT = {
  family: "'Inter', 'Geist', sans-serif",
  size: 11,
};
