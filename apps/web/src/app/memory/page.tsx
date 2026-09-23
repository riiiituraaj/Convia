"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MemoryItem } from "@/lib/types";
import { Brain, Trash2, Plus, Shield, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { FilterTabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

const CATEGORIES = [
  { value: "ALL", label: "All" },
  { value: "EXPLICIT", label: "Explicit" },
  { value: "MISSION", label: "Mission" },
  { value: "DERIVED_PREFERENCE", label: "Preferences" },
  { value: "EXTERNAL_KNOWLEDGE", label: "External" },
  { value: "TEMPORARY", label: "Temporary" },
];

const CATEGORY_TONE: Record<string, "brand" | "success" | "info" | "warning" | "neutral"> = {
  EXPLICIT: "brand",
  MISSION: "info",
  DERIVED_PREFERENCE: "success",
  EXTERNAL_KNOWLEDGE: "warning",
  TEMPORARY: "neutral",
};

export default function MemoryCenterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryItem["category"]>("EXPLICIT");

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memory"],
    queryFn: () => api.getMemories(),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.createMemory({
        content: newContent,
        category: newCategory,
        source: "user_input",
        confidence: 1.0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      setShowAddModal(false);
      setNewContent("");
      toast({ title: "Memory stored", description: "CONVIA will keep this visible and deletable." });
    },
    onError: () => toast({ title: "Could not save memory", tone: "danger" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast({ title: "Memory deleted" });
    },
    onError: () => toast({ title: "Could not delete memory", tone: "danger" }),
  });

  const filteredMemories =
    activeCategory === "ALL"
      ? memories
      : memories.filter((m) => m.category === activeCategory);

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Structured life knowledge"
        title="Memory Center"
        description="Inspect, control, and audit what CONVIA remembers. Everything stored is visible and deletable."
        icon={<Brain className="h-5 w-5" strokeWidth={1.75} />}
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.9} />
            Add memory
          </Button>
        }
        meta={
          <>
            <Badge tone="brand" dot>
              {memories.length} stored
            </Badge>
            <Badge tone="neutral">
              <Shield className="h-3 w-3" /> User-visible only
            </Badge>
          </>
        }
      />

      <FilterTabs
        options={CATEGORIES}
        value={activeCategory}
        onChange={setActiveCategory}
        ariaLabel="Filter memories"
      />

      {isLoading ? (
        <LoadingState label="Loading memories" rows={3} />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No memories yet"
          description="Add an explicit instruction, or capture an intent so CONVIA can derive preferences."
          action={
            <Button variant="secondary" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add memory
            </Button>
          }
        />
      ) : filteredMemories.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No memories in this category"
          description="Try another filter, or add a new memory in this category."
          action={
            <Button variant="secondary" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add memory
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredMemories.map((mem) => (
            <Card key={mem.id} interactive className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <Badge tone={CATEGORY_TONE[mem.category] || "neutral"} dot>
                  {mem.category.replaceAll("_", " ")}
                </Badge>
                <span className="text-[11px] text-ink-muted">{formatDate(mem.created_at)}</span>
              </div>

              <p className="mt-3 text-[13.5px] leading-relaxed text-ink">{mem.content}</p>

              <div className="mt-4 flex items-center justify-between border-t border-line-subtle pt-3">
                <span className="text-[11.5px] text-ink-muted">
                  Source: {mem.source} · {Math.round(mem.confidence * 100)}% confidence
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(mem.id)}
                  loading={deleteMutation.isPending && deleteMutation.variables === mem.id}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add explicit memory"
        subtitle="A permanent instruction CONVIA should always respect"
        eyebrow="Structured knowledge"
        icon={<Brain className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newContent.trim()}
              loading={addMutation.isPending}
            >
              {addMutation.isPending ? "Saving…" : "Save memory"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Category" htmlFor="memory-category">
            <Select
              id="memory-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryItem["category"])}
            >
              <option value="EXPLICIT">EXPLICIT — permanent instruction</option>
              <option value="MISSION">MISSION — tied to an active mission</option>
              <option value="DERIVED_PREFERENCE">DERIVED_PREFERENCE — habit or preference</option>
              <option value="EXTERNAL_KNOWLEDGE">EXTERNAL_KNOWLEDGE — fact from research</option>
              <option value="TEMPORARY">TEMPORARY — short-lived context</option>
            </Select>
          </Field>
          <Field label="Memory content" htmlFor="memory-content">
            <Textarea
              id="memory-content"
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Always reserve an aisle seat on flights longer than 2 hours."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
