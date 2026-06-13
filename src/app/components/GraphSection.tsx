"use client";

import { useRouter } from "next/navigation";
import KnowledgeGraph from "./KnowledgeGraph";
import type { GraphData, GraphNode } from "@/lib/graph";

export default function GraphSection({ data }: { data: GraphData }) {
  const router = useRouter();

  const handleNodeClick = (node: GraphNode) => {
    if (node.type === "writing") {
      if (node.url) window.open(node.url, "_blank", "noopener,noreferrer");
    } else if (node.type === "concept") {
      router.push(`/concepts/${node.slug}`);
    } else {
      router.push(`/ideas/${node.slug}`);
    }
  };

  return (
    <KnowledgeGraph
      data={data as any}
      onNodeClick={handleNodeClick as any}
    />
  );
}
