import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotes } from '../hooks/useNotes';

function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

export default function NotesView() {
  const { notes, isLoading, addNote, updateNote, deleteNote } = useNotes();
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [openPickerFor, setOpenPickerFor] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Set first note as active on load
  useEffect(() => {
    if (notes.length > 0 && (!activeNoteId || !notes.find(n => n.id === activeNoteId))) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  // Create default note if none exist
  useEffect(() => {
    if (!isLoading && notes.length === 0) {
      addNote('My First Note', '', '#fef08a');
    }
  }, [isLoading, notes.length]);

  // Close color picker on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setOpenPickerFor(null);
      }
    }
    if (openPickerFor !== null) {
      document.addEventListener('mousedown', onMouseDown);
      return () => document.removeEventListener('mousedown', onMouseDown);
    }
  }, [openPickerFor]);

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  const debouncedUpdateContent = useDebounce((id: number, content: string) => {
    updateNote(id, { content });
  }, 500);

  const debouncedUpdateTitle = useDebounce((id: number, title: string) => {
    updateNote(id, { title });
  }, 500);

  const updateContent = (id: number, content: string) => {
    // Update local state optimistically handled by parent via refetch on next calls
    debouncedUpdateContent(id, content);
  };

  const updateTitle = (id: number, title: string) => {
    debouncedUpdateTitle(id, title);
  };

  const persistColor = (id: number, color: string) => {
    updateNote(id, { color });
  };

  const handleAddDirect = async () => {
    const title = newTitle.trim() || 'New Note';
    await addNote(title, '', '#fef08a');
    setNewTitle('');
  };

  return (
    <div className="w-full h-full flex justify-center p-2">
      <div className="w-full max-w-[1100px] h-full flex gap-4">
        {/* LEFT — Note list */}
        <div className="w-1/3 flex flex-col">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-2xl font-bold text-white">Notes</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {notes.map(note => (
              <div
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className="rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all duration-150"
                style={{ backgroundColor: note.color || '#fef08a' }}
              >
                <span className="font-semibold text-gray-900 truncate" style={{ maxWidth: '12rem' }}>
                  {note.title || 'Untitled'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:text-red-500 hover:bg-red-50 ml-2 flex-shrink-0"
                  onClick={e => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add note bar */}
          <div className="mt-3 input-glass-compact">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-800 hover:bg-gray-800/20" onClick={handleAddDirect}>
                <Plus className="h-4 w-4 stroke-2" />
              </Button>
              <Input
                type="text"
                placeholder="Add a note"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDirect()}
                className="w-full bg-transparent text-white placeholder:text-white/80 text-base focus:outline-none focus:ring-0 border-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Editor */}
        <div className="flex-1 flex flex-col glass">
          <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
            <div className="flex flex-col gap-4 h-full">
              {/* Title bar */}
              <div className="bg-gray-700 rounded-xl px-4 py-4 flex items-center justify-between border border-gray-800">
                <input
                  value={activeNote?.title || ''}
                  onChange={e => activeNote && updateTitle(activeNote.id, e.target.value)}
                  className="w-full bg-transparent outline-none text-2xl font-bold text-white"
                  style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}
                  placeholder="Note title"
                  disabled={!activeNote}
                />
                <div className="relative ml-4">
                  <button
                    onClick={() => {
                      if (!activeNote) return;
                      setOpenPickerFor(prev => prev === activeNote.id ? null : activeNote.id);
                    }}
                    title="Change note color"
                    className="h-8 w-8 rounded-md border border-gray-700 flex items-center justify-center focus:outline-none"
                    style={{ backgroundColor: activeNote?.color || '#fef08a' }}
                    disabled={!activeNote}
                  />
                  {openPickerFor === activeNote?.id && (
                    <div
                      ref={pickerRef}
                      onClick={e => e.stopPropagation()}
                      className="absolute right-0 mt-3 w-40 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={activeNote?.color || '#fef08a'}
                          onChange={e => activeNote && persistColor(activeNote.id, e.target.value)}
                          className="h-10 w-10 p-0 border-0 bg-transparent"
                        />
                        <Button size="sm" onClick={() => setOpenPickerFor(null)}>Done</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="bg-gray-700 rounded-xl p-3 flex-1 min-h-0 border border-gray-800">
                {activeNote ? (
                  <textarea
                    value={activeNote.content}
                    onChange={e => updateContent(activeNote.id, e.target.value)}
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
