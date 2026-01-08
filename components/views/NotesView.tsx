"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Simple debounce hook
function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  return debouncedCallback;
}

interface Note {
  id: string; // IPC sends number, converted to string for React
  title: string;
  content: string;
  color: string;
}

export default function NotesSection() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const allNotes = await window.electronAPI.query("notes");
      setNotes(allNotes.map((n: any) => ({
        id: String(n.id),
        title: n.title,
        content: n.content,
        color: n.color,
      })));
      
      // We can't synchronously check notes here since state update is async, 
      // but we can check the fetched array.
      if (allNotes.length > 0 && (!activeNoteId || !allNotes.some((n: any) => String(n.id) === activeNoteId))) {
        setActiveNoteId(String(allNotes[0].id));
      }
    } catch (err) {
      console.error("Failed to load notes", err);
    }
  }, [activeNoteId]);

  useEffect(() => {
    loadNotes();
    
    // Create default note if none exist (checked async)
    window.electronAPI.query("notes").then(async (allNotes: any[]) => {
      if (allNotes.length === 0) {
        const newNote = await window.electronAPI.insert("notes", { 
          title: "My First Note", 
          content: "", 
          color: "#fef08a" 
        });
        if (newNote) {
          setActiveNoteId(String(newNote.id));
          loadNotes();
        }
      }
    });
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setOpenPickerFor(null);
      }
    }
    if (openPickerFor !== null) {
      document.addEventListener("mousedown", onDocMouseDown);
    }
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [openPickerFor]);

  const addNote = async () => {
    const title = newNoteTitle.trim();
    if (!title) return;
    
    try {
      const newNote = await window.electronAPI.insert("notes", { 
        title, 
        content: "", 
        color: "#fef08a" 
      });
      
      if (newNote) {
        // Optimistic update or reload? Reload is safer for ID sync.
        await loadNotes();
        setActiveNoteId(String(newNote.id));
        setNewNoteTitle("");
      }
    } catch (err) {
      console.error("Failed to add note", err);
    }
  };

  const deleteNote = async (idStr: string) => {
    const id = Number(idStr);
    const originalNotes = notes;
    const nextNotes = notes.filter(n => n.id !== idStr);
    setNotes(nextNotes);

    if (activeNoteId === idStr) {
      setActiveNoteId(nextNotes[0]?.id || null);
    }

    try {
      const success = await window.electronAPI.remove("notes", id);
      if (!success) {
        setNotes(originalNotes);
      }
    } catch (err) {
      setNotes(originalNotes);
      console.error("Failed to delete note", err);
    }
  };

  // Debounced save for content
  const debouncedUpdateContent = useDebounce((idStr: string, content: string) => {
    const id = Number(idStr);
    window.electronAPI.update("notes", id, { content });
  }, 500);

  const updateNoteContent = (id: string, content: string) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, content } : n)));
    debouncedUpdateContent(id, content);
  };

  // Debounced save for title
  const debouncedUpdateTitle = useDebounce((idStr: string, title: string) => {
    const id = Number(idStr);
    window.electronAPI.update("notes", id, { title });
  }, 500);

  const updateNoteTitle = (id: string, title: string) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, title } : n)));
    debouncedUpdateTitle(id, title);
  };

  const persistNoteColor = (idStr: string, color: string) => {
    const id = Number(idStr);
    setNotes(prev => prev.map(n => (n.id === idStr ? { ...n, color } : n)));
    window.electronAPI.update("notes", id, { color });
  };

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  return (
    <div className="w-full h-full flex justify-center p-2">
      <div className="w-full max-w-[1100px] h-full flex gap-4">
        {/* LEFT PANEL - Notes List */}
        <div className="w-1/3 flex flex-col">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-2xl font-bold text-white">Notes</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {notes.map((note) => (
              <div 
                key={note.id} 
                onClick={() => setActiveNoteId(note.id)} 
                className="rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all duration-150" 
                style={{ backgroundColor: note.color || "#fef08a" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-gray-900 truncate" style={{ maxWidth: "12rem" }}>
                    {note.title || "Untitled"}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-red-500 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-gray-400 p-3">No notes yet — add one below.</div>}
          </div>
          <div className="mt-3 input-glass-compact transition-all duration-200">
            <div className="flex items-center gap-3 h-full">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-800 hover:bg-gray-800/20 transition-colors" onClick={addNote}>
                <Plus className="h-4 w-4 stroke-2" />
              </Button>
              <div className="flex-1 h-full">
                <Input
                  type="text"
                  placeholder="Add a note"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addNote()}
                  className="w-full h-full bg-transparent text-white placeholder:text-white/80 text-base focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Note Editor */}
        <div className="flex-1 flex flex-col glass">
          <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
            <div className="flex flex-col gap-4 h-full">
              <div className="bg-gray-700 rounded-xl px-4 py-4 flex items-center justify-between border border-gray-800">
                <input
                  value={activeNote ? activeNote.title : ""}
                  onChange={(e) => activeNote && updateNoteTitle(activeNote.id, e.target.value)}
                  className="w-full bg-transparent outline-none text-2xl font-bold text-white"
                  placeholder="Note title"
                  style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}
                  disabled={!activeNote}
                />
                <div className="relative ml-4">
                  <button
                    onClick={() => {
                      if (!activeNote) return;
                      setOpenPickerFor(prev => (prev === activeNote.id ? null : activeNote.id));
                    }}
                    title="Change note color"
                    className="h-8 w-8 rounded-md border border-gray-700 flex items-center justify-center focus:outline-none"
                    style={{ backgroundColor: activeNote?.color || "#fef08a" }}
                    disabled={!activeNote}
                  />
                  {openPickerFor === activeNote?.id && (
                    <div ref={pickerRef} onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-3 w-33 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                      <div className="flex flex-col-2 items-center justify-center">
                        <div className="flex items-center gap-3">
                          <input 
                            type="color" 
                            value={activeNote?.color || "#fef08a"} 
                            onChange={(e) => activeNote && persistNoteColor(activeNote.id, e.target.value)} 
                            className="h-10 w-10 p-0 border-0 bg-transparent" 
                            aria-label="Pick color" 
                          />
                        </div>
                        <div className="mt-1 ml-2 flex">
                          <Button size="sm" onClick={() => setOpenPickerFor(null)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-700 rounded-xl p-3 flex-1 min-h-0 border border-gray-800">
                {activeNote ? (
                  <textarea
                    value={activeNote.content}
                    onChange={(e) => updateNoteContent(activeNote.id, e.target.value)}
                    placeholder="Write your note..."
                    className="w-full h-full resize-none text-white text-base outline-none bg-transparent min-h-0 whitespace-pre-wrap break-words"
                  />
                ) : (
                  <div className="text-gray-500 m-auto">Select or create a note</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
