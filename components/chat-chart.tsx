"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactDescription,
  ArtifactContent,
} from "@/components/ai-elements/artifact";
import {
  BarChart3Icon,
  LineChartIcon,
  AreaChartIcon,
  PieChartIcon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Beautiful, vibrant colors highly visible in both light and dark themes
const CHART_COLORS = [
  "hsl(217, 91%, 60%)",  // Premium Blue
  "hsl(262, 83%, 58%)",  // Violet
  "hsl(142, 71%, 45%)",  // Emerald
  "hsl(24, 95%, 53%)",   // Orange/Amber
  "hsl(339, 90%, 51%)",  // Pink/Rose
  "hsl(199, 89%, 48%)",  // Sky Blue
];

interface ChartData {
  type: "bar" | "line" | "area" | "pie";
  title: string;
  description?: string;
  xKey?: string;
  keys?: string[];
  data: Record<string, any>[];
}

interface InteractiveChartProps {
  jsonString: string;
  isStreaming: boolean;
}

export function InteractiveChart({ jsonString, isStreaming }: InteractiveChartProps) {
  const [parsedData, setParsedData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Clean the json string (remove possible markdown markers if present)
      let cleaned = jsonString.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Try parsing the JSON
      const parsed = JSON.parse(cleaned);
      
      // Basic validation
      if (parsed && Array.isArray(parsed.data)) {
        setParsedData(parsed);
        setError(null);
      } else {
        setError("Invalid chart data structure");
      }
    } catch (err) {
      // Silent error during streaming, wait until complete or show minimal loader
      if (!isStreaming) {
        setError("Failed to parse chart data");
      }
    }
  }, [jsonString, isStreaming]);

  // Loading state while streaming or compiling
  if (!parsedData && !error) {
    return (
      <Artifact className="my-4 border-orange-500/20 bg-muted/20 backdrop-blur-xs">
        <ArtifactHeader className="border-b/50">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin text-orange-500" />
            <ArtifactTitle className="animate-pulse">Loading Chart Visualization…</ArtifactTitle>
          </div>
        </ArtifactHeader>
        <ArtifactContent className="flex h-[280px] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="text-xs font-mono tracking-wider animate-pulse">GENERATING INTERACTIVE GRAPH...</span>
          </div>
        </ArtifactContent>
      </Artifact>
    );
  }

  // Error fallback
  if (error) {
    return (
      <Artifact className="my-4 border-destructive/20 bg-destructive/5">
        <ArtifactHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircleIcon className="size-4" />
            <ArtifactTitle className="text-destructive font-medium">Visualization Error</ArtifactTitle>
          </div>
        </ArtifactHeader>
        <ArtifactContent className="p-4 text-xs font-mono bg-background/50 rounded-b-lg border-t border-destructive/10 overflow-auto">
          <p className="text-muted-foreground mb-2">Failed to render interactive graph. Invalid schema output from model:</p>
          <pre className="text-foreground/80 whitespace-pre-wrap max-h-40 overflow-y-auto">{jsonString}</pre>
        </ArtifactContent>
      </Artifact>
    );
  }

  if (!parsedData) return null;

  const { type, title, description, xKey, keys = ["value"], data } = parsedData;

  // Icon based on type
  const getIcon = () => {
    switch (type) {
      case "line":
        return <LineChartIcon className="size-4.5 text-primary" />;
      case "area":
        return <AreaChartIcon className="size-4.5 text-primary" />;
      case "pie":
        return <PieChartIcon className="size-4.5 text-primary" />;
      case "bar":
      default:
        return <BarChart3Icon className="size-4.5 text-primary" />;
    }
  };

  // Render different chart types
  const renderChart = () => {
    const gridColor = "var(--border)";
    const axisColor = "var(--muted-foreground)";

    const commonProps = {
      data,
      margin: { top: 15, right: 10, left: -20, bottom: 0 },
    };

    switch (type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "15px", fontSize: "12px" }} />
            {keys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 1 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {keys.map((key, index) => {
                const color = CHART_COLORS[index % CHART_COLORS.length];
                return (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "15px", fontSize: "12px" }} />
            {keys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                fill={`url(#grad-${key})`}
              />
            ))}
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey={keys[0] || "value"}
              nameKey={xKey || "name"}
              label={({ name, percent }) => `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  className="stroke-background hover:opacity-90 transition-opacity"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
          </PieChart>
        );

      case "bar":
      default:
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.15 }}
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "15px", fontSize: "12px" }} />
            {keys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <Artifact className="my-6 overflow-hidden border border-border/40 bg-muted/10 backdrop-blur-xs shadow-md rounded-xl transition-all duration-300">
      <ArtifactHeader className="bg-muted/30 border-b border-border/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            {getIcon()}
          </div>
          <div className="flex flex-col gap-0.5">
            <ArtifactTitle className="font-semibold text-foreground text-sm tracking-tight">{title}</ArtifactTitle>
            {description && (
              <ArtifactDescription className="text-muted-foreground text-xs leading-none">
                {description}
              </ArtifactDescription>
            )}
          </div>
        </div>
      </ArtifactHeader>
      <ArtifactContent className="p-6 bg-background/40">
        <div className="h-[280px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </ArtifactContent>
    </Artifact>
  );
}

function isChartJson(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr.trim());
    return (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.type === "string" &&
      ["bar", "line", "area", "pie"].includes(parsed.type) &&
      Array.isArray(parsed.data) &&
      parsed.data.length > 0
    );
  } catch {
    return false;
  }
}

export function parseContentWithCharts(text: string) {
  // Match ```recharts or ```json code blocks that contain chart-shaped JSON
  const regex = /```(recharts|json)\n([\s\S]*?)(?:```|$)/g;
  const parts: { type: "text" | "chart"; content: string }[] = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const lang = match[1];
    const content = match[2];

    const isChart = lang === "recharts" || (lang === "json" && isChartJson(content));

    if (isChart) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "chart", content });
      lastIndex = regex.lastIndex;
    }
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text" as const, content: text }];
}
