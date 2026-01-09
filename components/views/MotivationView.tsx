import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Plus, Image as ImageIcon, Trash2, GripVertical } from "lucide-react";

interface Motivation {
  id: string;
  userId: string;
  imagePath: string;
  order: number;
  createdAt: string;
  imageData?: string;
}

export default function MotivationView() {
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const loadMotivations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await window.electronAPI.motivation.getAll();
      // Load images for each motivation
      const withImages = await Promise.all(data.map(async (m: Motivation) => {
        if (m.imagePath) {
          const imgData = await window.electronAPI.motivation.getImage(m.imagePath);
          return { ...m, imageData: imgData };
        }
        return m;
      }));
      setMotivations(withImages);
    } catch (err) {
      console.error("[MotivationView] Error loading:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMotivations();
  }, [loadMotivations]);

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          if (ev.target?.result) {
            const u8 = new Uint8Array(ev.target.result as ArrayBuffer);
            await window.electronAPI.motivation.add({ name: file.name, data: u8 });
          }
          resolve();
        };
        reader.readAsArrayBuffer(file);
      });
    }
    
    loadMotivations();
    e.target.value = ""; // Reset input
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this motivation image?")) {
      await window.electronAPI.motivation.delete(id);
      loadMotivations();
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const draggedIndex = motivations.findIndex(m => m.id === draggedItem);
    const targetIndex = motivations.findIndex(m => m.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally
    const newOrder = [...motivations];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    
    setMotivations(newOrder);
    setDraggedItem(null);

    // Save new order
    const orderedIds = newOrder.map(m => m.id);
    await window.electronAPI.motivation.reorder(orderedIds);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Motivation</h2>
          <div className="text-sm text-white/60">
            {motivations.length} images • Drag to reorder
          </div>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddImages}
          />
          <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 pointer-events-none">
            <Plus className="w-4 h-4" />
            Add Images
          </div>
        </label>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/60">
          Loading...
        </div>
      ) : motivations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/60 gap-4">
          <ImageIcon className="w-16 h-16 opacity-50" />
          <p>No motivation images yet</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddImages}
            />
            <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 pointer-events-none">
              <Plus className="w-4 h-4" />
              Add Your First Images
            </div>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {motivations.map((motivation) => (
            <div
              key={motivation.id}
              draggable
              onDragStart={(e) => handleDragStart(e, motivation.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, motivation.id)}
              onDragEnd={handleDragEnd}
              className={`group relative aspect-square bg-gray-800 rounded-xl overflow-hidden cursor-move transition-all border-2 ${
                draggedItem === motivation.id 
                  ? "opacity-50 border-blue-500" 
                  : "border-transparent hover:border-white/30"
              }`}
            >
              {motivation.imageData ? (
                <img
                  src={motivation.imageData}
                  alt="Motivation"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}

              {/* Drag handle indicator */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/60 rounded p-1">
                  <GripVertical className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Delete button */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(motivation.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
