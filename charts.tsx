"use client"

import { Bar, Line, Pie } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend)

export function LineChart() {
  const data = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
    datasets: [
      {
        label: "Positive",
        data: [65, 59, 80, 81, 56, 55, 70, 75],
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.5)",
        tension: 0.3,
      },
      {
        label: "Neutral",
        data: [28, 48, 40, 19, 36, 27, 30, 25],
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        tension: 0.3,
      },
      {
        label: "Negative",
        data: [15, 20, 14, 12, 17, 10, 8, 5],
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.5)",
        tension: 0.3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="h-[300px]">
      <Line data={data} options={options} />
    </div>
  )
}

export function BarChart() {
  const data = {
    labels: ["Customer Service", "Product Quality", "Value", "Shipping", "Website", "Returns"],
    datasets: [
      {
        label: "Positive",
        data: [65, 59, 80, 81, 56, 55],
        backgroundColor: "rgba(34, 197, 94, 0.5)",
      },
      {
        label: "Negative",
        data: [28, 48, 40, 19, 36, 27],
        backgroundColor: "rgba(239, 68, 68, 0.5)",
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="h-[300px]">
      <Bar data={data} options={options} />
    </div>
  )
}

export function PieChart() {
  const data = {
    labels: ["5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"],
    datasets: [
      {
        data: [42, 33, 12, 8, 5],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(34, 197, 94, 0.6)",
          "rgba(250, 204, 21, 0.7)",
          "rgba(239, 68, 68, 0.6)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
  }

  return (
    <div className="h-[300px]">
      <Pie data={data} options={options} />
    </div>
  )
}

export function WordCloud() {
  // This is a placeholder for a word cloud visualization
  // In a real implementation, you would use a library like react-wordcloud
  const words = [
    { text: "Customer Service", value: 64 },
    { text: "Quality", value: 42 },
    { text: "Price", value: 36 },
    { text: "Shipping", value: 28 },
    { text: "Support", value: 25 },
    { text: "Website", value: 22 },
    { text: "Returns", value: 18 },
    { text: "Delivery", value: 16 },
  ]

  return (
    <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-md">
      <div className="grid grid-cols-4 gap-2 p-4 w-full">
        {words.map((word, i) => (
          <div
            key={i}
            className="flex items-center justify-center p-2 rounded-md bg-primary/10"
            style={{
              fontSize: `${Math.max(0.8, Math.min(2, word.value / 20))}rem`,
              opacity: Math.max(0.6, Math.min(1, word.value / 50)),
            }}
          >
            {word.text}
          </div>
        ))}
      </div>
    </div>
  )
}
