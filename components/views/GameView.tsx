import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { 
  Heart, Zap, Swords, Skull, CheckCircle2, 
  Plus, Trash2, Activity, Trophy
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface GameSkill {
  id: string;
  name: string;
  icon: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
}

interface GameQuest {
  id: string;
  name: string;
  icon: string;
  skillId?: string;
  xpReward: number;
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
}

interface GameHabit {
  id: string;
  name: string;
  icon: string;
  type: "good" | "bad";
  skillId?: string;
  xpReward?: number;
  hpDamage?: number;
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
}

interface GameCharacter {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  coins: number;
  avatar?: string;
}

export default function GameView() {
  const [character, setCharacter] = useState<GameCharacter>({
    hp: 100, maxHp: 100, xp: 0, level: 1, coins: 0
  });
  const [skills, setSkills] = useState<GameSkill[]>([]);
  const [quests, setQuests] = useState<GameQuest[]>([]);
  const [habits, setHabits] = useState<GameHabit[]>([]);

  // Forms
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  
  const [isAddingQuest, setIsAddingQuest] = useState(false);
  const [newQuestName, setNewQuestName] = useState("");
  const [newQuestSkillId, setNewQuestSkillId] = useState("");
  const [newQuestXp, setNewQuestXp] = useState(5); // Default 5
  const [newQuestFrequency, setNewQuestFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitType, setNewHabitType] = useState<"good" | "bad">("good");
  const [newHabitSkillId, setNewHabitSkillId] = useState("");
  const [newHabitVal, setNewHabitVal] = useState(0); // Will set defaults in render
  const [newHabitFrequency, setNewHabitFrequency] = useState<"daily" | "weekly" | "monthly">("daily");

  const loadData = async () => {
    try {
      console.log("[GameView] calling getData...");
      const data = await window.electronAPI.game.getData();
      console.log("[GameView] received data:", data);
      if (data) {
        setCharacter(data.character);
        setSkills(data.skills || []);
        setQuests(data.quests || []);
        setHabits(data.habits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      // Done
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Actions
  const handleAddSkill = async () => {
    if (!newSkillName) return;
    await window.electronAPI.game.addSkill({
      name: newSkillName,
      icon: "⚡",
      level: 1,
      xp: 0,
      xpToNextLevel: 100
    });
    setNewSkillName("");
    setIsAddingSkill(false);
    loadData();
  };

  const handleAddQuest = async () => {
    if (!newQuestName) return;
    await window.electronAPI.game.addQuest({
      name: newQuestName,
      icon: "📜",
      skillId: newQuestSkillId,
      xpReward: newQuestXp,
      frequency: newQuestFrequency
    });
    setNewQuestName("");
    setNewQuestSkillId("");
    setIsAddingQuest(false);
    loadData();
  };

  const handleAddHabit = async () => {
    if (!newHabitName) return;
    await window.electronAPI.game.addHabit({
      name: newHabitName,
      icon: newHabitType === "good" ? "✨" : "💀",
      type: newHabitType,
      skillId: newHabitType === "good" ? newHabitSkillId : undefined,
      xpReward: newHabitType === "good" ? 3 : 0, // Fixed 3
      hpDamage: newHabitType === "bad" ? 5 : 0,  // Fixed 5
      frequency: newHabitFrequency
    });
    setNewHabitName("");
    setIsAddingHabit(false);
    loadData();
  };

  const handleCompleteQuest = async (id: string, completed: boolean) => {
    if (completed) return; // Already done (though daily reset handles generic unchecking)
    const result = await window.electronAPI.game.completeQuest(id);
    if (result.success) {
      loadData();
      if (result.skillLevelUp) {
        window.electronAPI.playSound("achievement"); // Optional: if sound API exists
        // Could show toast
      }
    }
  };

  const handleCompleteHabit = async (id: string, type: "good" | "bad") => {
    // type is used for UI context if needed, but not IPC
    const result = await window.electronAPI.game.completeHabit(id);
    if (result.success) {
      loadData();
      if (result.gameOver) {
        alert("GAME OVER! Your progress has been reset.");
      }
    }
  };

  const handleDelete = async (type: "skill" | "quest" | "habit", id: string) => {
    if (type === "skill") await window.electronAPI.game.deleteSkill(id);
    if (type === "quest") await window.electronAPI.game.deleteQuest(id);
    if (type === "habit") await window.electronAPI.game.deleteHabit(id);
    loadData();
  };

  // UI Components


  return (
    <div className="w-full h-full p-4 overflow-y-auto text-white space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-6 h-6 text-white" />
        <h1 className="text-2xl font-bold text-white">Habits</h1>
      </div>
      {/* Top Section: Character & Skills - always in same row */}
      {/* Top Section: Skills (Full Width) */}
      <div className="glass-card border border-glass-border rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
             <Zap className="w-5 h-5 text-white" /> Skills
           </h2>
           <Popover open={isAddingSkill} onOpenChange={setIsAddingSkill}>
             <PopoverTrigger asChild>
               <Button size="sm" variant="secondary" className="text-white bg-white/10 border border-white/10 hover:bg-white/20 transition-colors">
                 <Plus className="w-4 h-4 mr-2" /> New Skill
               </Button>
               </PopoverTrigger>
               <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
                 <div className="space-y-4">
                   <h4 className="font-medium">Add New Skill</h4>
                   <Input 
                     placeholder="Skill Name (e.g. Coding)" 
                     value={newSkillName}
                     onChange={(e) => setNewSkillName(e.target.value)}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <Button onClick={handleAddSkill} className="w-full bg-white text-black hover:bg-gray-200">Add Skill</Button>
                 </div>
               </PopoverContent>
             </Popover>
          </div>

          <div className="flex-1 overflow-auto">
            {skills.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
                <Activity className="w-12 h-12 mb-2" />
                <p>No skills yet. Add one to start growing!</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 border-white/10 hover:bg-white/5">
                      <TableHead className="text-white font-medium">Level</TableHead>
                      <TableHead className="text-white font-medium">Name</TableHead>
                      <TableHead className="text-white font-medium w-full">Progress</TableHead>
                      <TableHead className="text-white font-medium text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skills.map(skill => (
                      <TableRow key={skill.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                        <TableCell className="font-mono text-white font-bold">{skill.level}</TableCell>
                        <TableCell className="font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{skill.icon}</span> {skill.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                             <Progress 
                               value={(skill.xp / skill.xpToNextLevel) * 100} 
                               className="h-2 bg-white/10" 
                               indicatorClassName="bg-white" 
                             />
                             <span className="text-xs text-gray-400 whitespace-nowrap w-24 text-right font-mono">
                               {skill.xp} / {skill.xpToNextLevel}
                             </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDelete("skill", skill.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>


      {/* Middle: Active Quests - glass-card style */}
      <div className="glass-card border border-glass-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
             <Swords className="w-5 h-5 text-white" /> Active Quests
           </h2>
           <Popover open={isAddingQuest} onOpenChange={setIsAddingQuest}>
             <PopoverTrigger asChild>
               <Button size="sm" variant="secondary" className="text-white bg-white/10 border border-white/10 hover:bg-white/20 transition-colors">
                 <Plus className="w-4 h-4 mr-2" /> New Quest
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
               <div className="space-y-4">
                 <h4 className="font-medium">Add Daily Quest</h4>
                 <div className="space-y-2">
                   <Input 
                     placeholder="Quest Name" 
                     value={newQuestName}
                     onChange={(e) => setNewQuestName(e.target.value)}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <select 
                     className="w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm"
                     value={newQuestSkillId}
                     onChange={(e) => setNewQuestSkillId(e.target.value)}
                   >
                     <option value="">Select Related Skill (Optional)</option>
                     {skills.map(s => <option key={s.id} value={s.id}>{s.name} (Lvl {s.level})</option>)}
                   </select>
                   <select 
                     className="w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm"
                     value={newQuestFrequency}
                     onChange={(e) => setNewQuestFrequency(e.target.value as any)}
                   >
                     <option value="daily">Daily</option>
                     <option value="weekly">Weekly</option>
                     <option value="monthly">Monthly</option>
                   </select>
                   <div className="flex gap-2">
                      <Input 
                        type="number"
                        placeholder="XP Reward" 
                        value={newQuestXp}
                        onChange={(e) => setNewQuestXp(Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white flex-1"
                      />
                      <div className="text-xs text-gray-500 self-center">Default: 5</div>
                   </div>
                 </div>
                  <Button onClick={handleAddQuest} className="w-full bg-white text-black hover:bg-gray-200">Add Quest</Button>
               </div>
             </PopoverContent>
           </Popover>
        </div>

        <div className="space-y-2">
          {quests.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              No active quests. Add some tasks to gain XP!
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/5 border-white/10 hover:bg-white/5">
                    <TableHead className="text-white font-medium w-1/12">Status</TableHead>
                    <TableHead className="text-white font-medium w-full">Quest</TableHead>
                    <TableHead className="text-white font-medium text-right w-1/12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quests.map(quest => {
                    const skill = skills.find(s => s.id === quest.skillId);
                    return (
                      <TableRow
                        key={quest.id}
                        className={`border-white/5 hover:bg-white/5 transition-colors group ${
                          quest.completed
                            ? "bg-white/10 border-white/20 opacity-60"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <TableCell className="p-3">
                          <button 
                            onClick={() => handleCompleteQuest(quest.id, quest.completed)}
                            disabled={quest.completed}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              quest.completed ? "bg-white border-white" : "border-gray-500 hover:border-white"
                            }`}
                          >
                            {quest.completed && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                          </button>
                        </TableCell>
                        <TableCell className="p-3 w-full">
                          <div>
                            <div className={`font-medium ${quest.completed ? "line-through text-gray-500" : "text-white"}`}>
                              {quest.name}
                            </div>
                            {skill && (
                              <div className="text-xs text-gray-300 flex items-center gap-1 mt-0.5">
                                <Zap className="w-3 h-3" /> {skill.name} +{quest.xpReward} XP
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-3 text-right">
                           <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete("quest", quest.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Habits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Good Habits - glass-card style */}
        <div className="glass-card border border-glass-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-white" /> Good Habits
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" className="text-white bg-white/10 border border-white/10 hover:bg-white/20 transition-colors" onClick={() => { setIsAddingHabit(true); setNewHabitType("good"); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
                 <div className="space-y-4">
                   <h4 className="font-medium">Add Good Habit</h4>
                   <Input 
                     placeholder="Habit Name (e.g. Read 10 pages)" 
                     value={newHabitName}
                     onChange={(e) => setNewHabitName(e.target.value)}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <select 
                     className="w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm"
                     value={newHabitSkillId}
                     onChange={(e) => setNewHabitSkillId(e.target.value)}
                   >
                     <option value="">Linked Skill (Optional)</option>
                     {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <select 
                     className="w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm"
                     value={newHabitFrequency}
                     onChange={(e) => setNewHabitFrequency(e.target.value as any)}
                   >
                     <option value="daily">Daily</option>
                     <option value="weekly">Weekly</option>
                     <option value="monthly">Monthly</option>
                   </select>
                    <div className="text-xs text-gray-400">Rewards: +3 Skill XP, +1 HP, +{newHabitVal || 5} Coins</div>
                    <Button onClick={handleAddHabit} className="w-full bg-white text-black hover:bg-gray-200">Add Habit</Button>
                 </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2 rounded-xl border border-white/10 overflow-hidden bg-white/5 p-2">
            {habits
              .filter(h => h.type === "good")
              .sort((a, b) => Number(a.completed) - Number(b.completed))
              .map(habit => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Button 
                      size="sm" 
                      className={`h-8 px-3 text-xs font-semibold ${habit.completed ? 'bg-green-900/30 text-green-400 hover:bg-green-900/40' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                      onClick={() => handleCompleteHabit(habit.id, "good")}
                      disabled={habit.completed}
                    >
                      {habit.completed ? "DONE" : "DO IT"}
                    </Button>
                    <span className={`font-medium ${habit.completed ? "text-gray-500 line-through" : "text-white"}`}>{habit.name}</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-white" onClick={() => handleDelete("habit", habit.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Bad Habits - glass-card style */}
        <div className="glass-card border border-glass-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
              <Skull className="w-5 h-5 text-white" /> Bad Habits
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" className="text-white bg-white/10 border border-white/10 hover:bg-white/20 transition-colors" onClick={() => { setIsAddingHabit(true); setNewHabitType("bad"); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
                  <div className="space-y-4">
                    <h4 className="font-medium">Add Bad Habit</h4>
                    <Input  
                     placeholder="Habit Name (e.g. Skipped Workout)" 
                     value={newHabitName}
                     onChange={(e) => setNewHabitName(e.target.value)}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <select 
                     className="w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm"
                     value={newHabitFrequency}
                     onChange={(e) => setNewHabitFrequency(e.target.value as any)}
                   >
                     <option value="daily">Daily</option>
                     <option value="weekly">Weekly</option>
                     <option value="monthly">Monthly</option>
                   </select>
                    <div className="text-xs text-gray-400">Penalty: -5 HP</div>
                    <Button onClick={handleAddHabit} className="w-full bg-white text-black hover:bg-gray-200">Add Habit</Button>
                 </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 overflow-hidden bg-white/5 p-2">
            {habits
              .filter(h => h.type === "bad")
              .sort((a, b) => Number(a.completed) - Number(b.completed))
              .map(habit => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Button 
                      size="sm" 
                      className={`h-8 px-3 text-xs font-semibold ${habit.completed ? 'bg-red-900/30 text-red-400' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                      onClick={() => handleCompleteHabit(habit.id, "bad")}
                      disabled={habit.completed}
                    >
                      {habit.completed ? "LOST" : "LOST IT"}
                    </Button>
                    <span className={`font-medium ${habit.completed ? "text-gray-500 line-through" : "text-white"}`}>{habit.name}</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-white" onClick={() => handleDelete("habit", habit.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
