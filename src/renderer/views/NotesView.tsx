import { useState } from 'react';
import { useNotes } from '../hooks/useNotes';
import { StickyNote, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const NOTE_COLORS = [
  '#ffffff', '#fcff42', '#8377df', '#ff6b6b', '#51cf66',
  '#339af0', '#f06595', '#ff922b',
];

export default function NotesView() {
  const { notes, isLoading, addNote, deleteNote } = useNotes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('#ffffff');

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addNote(title, newContent, newColor);
    setNewTitle('');
    setNewContent('');
    setNewColor('#ffffff');
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-white text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading notes...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StickyNote className="w-6 h-6 text-white" />
          <h2 className="text-2xl font-bold text-white">Notes</h2>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#2a1636] hover:bg-[#3a2050] text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Note
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500 col-span-full text-center py-8">No notes yet</p>
        ) : (
          notes.map(note => (
            <Card
              key={note.id}
              className="glass-card border-gray-700/30 group relative"
              style={{ backgroundColor: `${note.color}10` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium text-sm">{note.title}</h3>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {note.content && (
                  <p className="text-gray-400 text-xs whitespace-pre-wrap line-clamp-6">{note.content}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* New Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0a0810] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="bg-white/5 border-gray-600 text-white"
              autoFocus
            />
            <textarea
              placeholder="Content..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-gray-600 rounded-md p-2 text-white text-sm resize-none"
            />
            <div className="flex gap-2">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    newColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-white">
              Cancel
            </Button>
            <Button onClick={handleAdd} className="bg-[#2a1636] hover:bg-[#3a2050] text-white">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
