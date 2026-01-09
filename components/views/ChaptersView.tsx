import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Plus, Image as ImageIcon, CheckSquare, Trash2, X, Edit2, GripVertical } from "lucide-react";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { EMOJI_CATEGORIES } from "../../src/constants/emojis";

interface Chapter {
  id: string;
  userId: string;
  title: string;
  coverImage?: string;
  icon?: string;
  clear: boolean;
  createdAt: string;
}

export default function ChaptersView() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("📌");
  const [newCover, setNewCover] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editIcon, setEditIcon] = useState("📌");
  const [editCover, setEditCover] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    loadChapters();
  }, []);

  const loadChapters = async () => {
    const data = await window.electronAPI.chapters.getAll();
    // Resolve images
    const chaptersWithImages = await Promise.all(data.map(async (c) => {
      if (c.coverImage) {
        const imgData = await window.electronAPI.chapters.getImage(c.coverImage);
        return { ...c, coverImageData: imgData };
      }
      return c;
    }));
    setChapters(chaptersWithImages);
  };

  const handleCreate = async () => {
    if (!newTitle) return;

    let coverPath = undefined;
    if (newCover) {
      const savedPath = await window.electronAPI.chapters.uploadImage(newCover);
      if (savedPath) coverPath = savedPath;
    }

    await window.electronAPI.chapters.add({
      title: newTitle,
      icon: newIcon,
      coverImage: coverPath,
      clear: false
    });

    setIsCreating(false);
    setNewTitle("");
    setNewIcon("📌");
    setNewCover(null);
    setNewCoverPreview(null);
    loadChapters();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chapter?")) {
      await window.electronAPI.chapters.delete(id);
      loadChapters();
    }
  };

  const toggleClear = async (chapter: Chapter) => {
    await window.electronAPI.chapters.update(chapter.id, { clear: !chapter.clear });
    loadChapters();
  };

  const handleEdit = async (chapter: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChapter(chapter);
    setEditTitle(chapter.title);
    setEditIcon(chapter.icon || "📌");
    setEditCoverPreview(chapter.coverImageData || null);
    setEditCover(null);
    setIsEditing(true);
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter || !editTitle) return;

    let coverPath = editingChapter.coverImage;
    if (editCover) {
      const savedPath = await window.electronAPI.chapters.uploadImage(editCover);
      if (savedPath) coverPath = savedPath;
    }

    await window.electronAPI.chapters.update(editingChapter.id, {
      title: editTitle,
      icon: editIcon,
      coverImage: coverPath
    });

    setIsEditing(false);
    setEditingChapter(null);
    setEditTitle("");
    setEditIcon("📌");
    setEditCover(null);
    setEditCoverPreview(null);
    loadChapters();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
         if (e.target?.result) {
            setNewCoverPreview(e.target.result as string);
         }
      };
      const bufferReader = new FileReader();
      bufferReader.onload = (ev) => {
        if (ev.target?.result) {
           const u8 = new Uint8Array(ev.target.result as ArrayBuffer);
           setNewCover({ name: file.name, data: u8 });
        }
      };
      bufferReader.readAsArrayBuffer(file);
      
      // Preview
      setNewCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const bufferReader = new FileReader();
      bufferReader.onload = (ev) => {
        if (ev.target?.result) {
           const u8 = new Uint8Array(ev.target.result as ArrayBuffer);
           setEditCover({ name: file.name, data: u8 });
        }
      };
      bufferReader.readAsArrayBuffer(file);
      setEditCoverPreview(URL.createObjectURL(file));
    }
  };

  // Drag handlers for reordering
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

    const draggedIndex = chapters.findIndex(c => c.id === draggedItem);
    const targetIndex = chapters.findIndex(c => c.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally
    const newOrder = [...chapters];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    
    setChapters(newOrder);
    setDraggedItem(null);

    // Save new order
    const orderedIds = newOrder.map(c => c.id);
    await window.electronAPI.chapters.reorder(orderedIds);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Chapters</h2>
          <div className="text-sm text-white/60">
            {chapters.length} chapters • Drag to reorder
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {chapters.map((chapter: any) => (
          <div
            key={chapter.id}
            draggable
            onDragStart={(e) => handleDragStart(e, chapter.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, chapter.id)}
            onDragEnd={handleDragEnd}
            className={`group bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-48 transition-all hover:shadow-md relative cursor-move border-2 ${
              draggedItem === chapter.id ? "opacity-50 border-blue-500" : "border-transparent"
            }`}
          >
            {/* Cover Image (Top half) */}
            <div className="h-1/2 bg-gray-100 w-full relative overflow-hidden">
               {chapter.coverImageData ? (
                 <img src={chapter.coverImageData} alt={chapter.title} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-300">
                   <ImageIcon className="w-8 h-8" />
                 </div>
               )}
            </div>

            {/* Content (Bottom half) */}
            <div className="p-3 flex-1 flex flex-col justify-between relative">
               {/* Icon and Title on same line */}
               <div className="flex items-start gap-2 mb-2">
                 <span className="text-xl flex-shrink-0">{chapter.icon || "📄"}</span>
                 <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
                   {chapter.title}
                 </h3>
               </div>

               {/* Clear checkbox */}
               <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => toggleClear(chapter)}>
                 <div className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${chapter.clear ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                   {chapter.clear && <CheckSquare className="w-3 h-3 text-white" />}
                 </div>
                 <span className={`text-xs ${chapter.clear ? 'text-gray-400 line-through' : 'text-gray-500'}`}>clear!</span>
               </div>
            </div>

            {/* Drag handle indicator */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/60 rounded p-1">
                <GripVertical className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Edit/Delete Overlay (on hover) */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
               <Button size="icon" variant="outline" className="h-6 w-6 bg-white" onClick={(e) => handleEdit(chapter, e)}>
                 <Edit2 className="w-3 h-3" />
               </Button>
               <Button size="icon" variant="destructive" className="h-6 w-6" onClick={(e) => handleDelete(chapter.id, e)}>
                 <Trash2 className="w-3 h-3" />
               </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">New Chapter</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="h-8 w-8 text-gray-500">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
               {/* Cover Image Input */}
               <div className="relative h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden group">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={handleImageSelect} />
                  {newCoverPreview ? (
                    <img src={newCoverPreview} className="w-full h-full object-cover" alt="Cover preview" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-2 group-hover:text-gray-500" />
                      <span className="text-xs text-gray-500">Add Cover Image</span>
                    </>
                  )}
               </div>

               <div className="flex gap-3">
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button variant="outline" className="w-12 h-10 p-0 text-xl border-gray-300">
                       {newIcon}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-80 p-2 bg-white border border-gray-200 shadow-xl" align="start">
                     <div className="h-60 overflow-y-auto">
                        {EMOJI_CATEGORIES.map(category => (
                          <div key={category.name} className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 px-1 uppercase tracking-wider">{category.name}</h4>
                            <div className="grid grid-cols-6 gap-1">
                              {category.emojis.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => { setNewIcon(emoji); }} 
                                  className="h-8 w-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded cursor-pointer transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                     </div>
                   </PopoverContent>
                 </Popover>

                 <Input 
                   value={newTitle} 
                   onChange={e => setNewTitle(e.target.value)} 
                   placeholder="Chapter Title" 
                   className="flex-1"
                   autoFocus
                 />
               </div>
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle}>Create Chapter</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && editingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Edit Chapter</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="h-8 w-8 text-gray-500">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
               {/* Cover Image Input */}
               <div className="relative h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden group">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={handleEditImageSelect} />
                  {editCoverPreview ? (
                    <img src={editCoverPreview} className="w-full h-full object-cover" alt="Cover preview" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-2 group-hover:text-gray-500" />
                      <span className="text-xs text-gray-500">Change Cover Image</span>
                    </>
                  )}
               </div>

               <div className="flex gap-3">
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button variant="outline" className="w-12 h-10 p-0 text-xl border-gray-300">
                       {editIcon}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-80 p-2 bg-white border border-gray-200 shadow-xl" align="start">
                     <div className="h-60 overflow-y-auto">
                        {EMOJI_CATEGORIES.map(category => (
                          <div key={category.name} className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 px-1 uppercase tracking-wider">{category.name}</h4>
                            <div className="grid grid-cols-6 gap-1">
                              {category.emojis.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => { setEditIcon(emoji); }} 
                                  className="h-8 w-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded cursor-pointer transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                     </div>
                   </PopoverContent>
                 </Popover>

                 <Input 
                   value={editTitle} 
                   onChange={e => setEditTitle(e.target.value)} 
                   placeholder="Chapter Title" 
                   className="flex-1"
                   autoFocus
                 />
               </div>
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleUpdateChapter} disabled={!editTitle}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
