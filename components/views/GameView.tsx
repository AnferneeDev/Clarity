import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { 
  Heart, Zap, Shield, Swords, Skull, CheckCircle2, 
  Plus, Trash2, Activity, Trophy
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

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
  skillId: string;
  xpReward: number;
  completed: boolean;
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
  const [newQuestXp, setNewQuestXp] = useState(10);
  
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitType, setNewHabitType] = useState<"good" | "bad">("good");
  const [newHabitSkillId, setNewHabitSkillId] = useState("");
  const [newHabitVal, setNewHabitVal] = useState(10); // XP or DMG

  const loadData = async () => {
    try {
      const data = await window.electronAPI.game.getData();
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
      xpReward: newQuestXp
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
      xpReward: newHabitType === "good" ? newHabitVal : 0,
      hpDamage: newHabitType === "bad" ? newHabitVal : 0
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
  const Hearts = ({ hp, maxHp }: { hp: number, maxHp: number }) => {
    const hearts = [];
    const count = Math.ceil(maxHp / 10);
    const filled = Math.ceil(hp / 10);
    
    for (let i = 0; i < count; i++) {
      hearts.push(
        <Heart 
          key={i} 
          className={`w-5 h-5 ${i < filled ? "fill-red-500 text-red-500" : "text-gray-600"}`} 
        />
      );
    }
    return <div className="flex flex-wrap gap-1">{hearts}</div>;
  };

  return (
    <div className="w-full h-full p-6 overflow-y-auto text-white space-y-8">
      {/* Top Section: Character & Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Character Card */}
        <div className="lg:col-span-1 bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-500" /> Character
            </h2>
            <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-sm font-medium border border-yellow-500/20">
              Lvl {character.level}
            </div>
          </div>

          {/* Avatar Placeholder */}
          <div className="aspect-square bg-black/40 rounded-lg border-2 border-white/10 flex items-center justify-center relative overflow-hidden group">
             {/* Use generic avatar if none */}
             <img 
               src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix" 
               alt="Avatar" 
               className="w-full h-full object-cover opacity-80"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
             <div className="absolute bottom-4 left-4 right-4 text-center">
               <div className="text-xl font-bold">Player One</div>
               <div className="text-sm text-gray-400">{character.coins} 🪙 coins</div>
             </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400 font-medium">HP</span>
                <span className="text-gray-400">{character.hp} / {character.maxHp}</span>
              </div>
              <Hearts hp={character.hp} maxHp={character.maxHp} />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-blue-400 font-medium">XP</span>
                <span className="text-gray-400">{character.xp} / {character.level * 100}</span>
              </div>
              <Progress value={(character.xp / (character.level * 100)) * 100} className="h-2 bg-gray-800" indicatorClassName="bg-blue-500" />
            </div>
          </div>
        </div>

        {/* Skills Table */}
        <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Zap className="w-5 h-5 text-blue-400" /> Skills
             </h2>
             <Popover open={isAddingSkill} onOpenChange={setIsAddingSkill}>
               <PopoverTrigger asChild>
                 <Button size="sm" variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-0">
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
                   <Button onClick={handleAddSkill} className="w-full bg-blue-600 hover:bg-blue-500">Add Skill</Button>
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-sm border-b border-white/10">
                    <th className="p-3 font-medium">Level</th>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium w-full">Progress</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map(skill => (
                    <tr key={skill.id} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono text-blue-400">{skill.level}</td>
                      <td className="p-3 font-medium flex items-center gap-2">
                        <span>{skill.icon}</span> {skill.name}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                           <Progress 
                             value={(skill.xp / skill.xpToNextLevel) * 100} 
                             className="h-1.5 bg-gray-800" 
                             indicatorClassName="bg-blue-500" 
                           />
                           <span className="text-xs text-gray-500 whitespace-nowrap w-20 text-right">
                             {skill.xp} / {skill.xpToNextLevel}
                           </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete("skill", skill.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Active Quests */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-xl font-bold flex items-center gap-2">
             <Swords className="w-5 h-5 text-orange-400" /> Active Quests
           </h2>
           <Popover open={isAddingQuest} onOpenChange={setIsAddingQuest}>
             <PopoverTrigger asChild>
               <Button size="sm" variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-0">
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
                   <Input 
                     type="number"
                     placeholder="XP Reward" 
                     value={newQuestXp}
                     onChange={(e) => setNewQuestXp(Number(e.target.value))}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                 </div>
                 <Button onClick={handleAddQuest} className="w-full bg-orange-600 hover:bg-orange-500">Add Quest</Button>
               </div>
             </PopoverContent>
           </Popover>
        </div>

        <div className="space-y-2">
          {quests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active quests. Add some tasks to gain XP!
            </div>
          ) : (
             quests.map(quest => {
               const skill = skills.find(s => s.id === quest.skillId);
               return (
                 <div 
                   key={quest.id} 
                   className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                     quest.completed 
                       ? "bg-green-500/10 border-green-500/30 opacity-60" 
                       : "bg-gray-800/50 border-white/5 hover:bg-gray-800"
                   }`}
                 >
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleCompleteQuest(quest.id, quest.completed)}
                        disabled={quest.completed}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          quest.completed ? "bg-green-500 border-green-500" : "border-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {quest.completed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <div>
                        <div className={`font-medium ${quest.completed ? "line-through text-gray-400" : "text-gray-200"}`}>
                          {quest.name}
                        </div>
                        {skill && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Zap className="w-3 h-3" /> {skill.name} +{quest.xpReward} XP
                          </div>
                        )}
                      </div>
                   </div>
                   <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-gray-500 hover:text-red-400"
                      onClick={() => handleDelete("quest", quest.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                 </div>
               );
             })
          )}
        </div>
      </div>

      {/* Bottom: Habits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Good Habits */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-400" /> Good Habits
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-0" onClick={() => { setIsAddingHabit(true); setNewHabitType("good"); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
                 <div className="space-y-4">
                   <h4 className="font-medium text-green-400">Add Good Habit</h4>
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
                   <div className="text-xs text-gray-400">XP Reward</div>
                   <Input 
                     type="number"
                     value={newHabitVal}
                     onChange={(e) => setNewHabitVal(Number(e.target.value))}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <Button onClick={handleAddHabit} className="w-full bg-green-600 hover:bg-green-500">Add Habit</Button>
                 </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            {habits.filter(h => h.type === "good").map(habit => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-white/5 hover:bg-gray-800/60 transition-colors">
                 <div className="flex items-center gap-3">
                   <Button 
                     size="sm" 
                     className={`h-8 px-3 text-xs font-semibold ${habit.completed ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                     onClick={() => handleCompleteHabit(habit.id, "good")}
                     disabled={habit.completed}
                   >
                     {habit.completed ? "DONE" : "DO IT"}
                   </Button>
                   <span className="font-medium text-gray-200">{habit.name}</span>
                 </div>
                 <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => handleDelete("habit", habit.id)}>
                   <Trash2 className="w-3 h-3" />
                 </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Bad Habits */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Skull className="w-5 h-5 text-red-400" /> Bad Habits
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-0" onClick={() => { setIsAddingHabit(true); setNewHabitType("bad"); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-4">
                 <div className="space-y-4">
                   <h4 className="font-medium text-red-400">Add Bad Habit</h4>
                   <Input 
                     placeholder="Habit Name (e.g. Skipped Workout)" 
                     value={newHabitName}
                     onChange={(e) => setNewHabitName(e.target.value)}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <div className="text-xs text-gray-400">HP Damage</div>
                   <Input 
                     type="number"
                     value={newHabitVal}
                     onChange={(e) => setNewHabitVal(Number(e.target.value))}
                     className="bg-gray-800 border-gray-700 text-white"
                   />
                   <Button onClick={handleAddHabit} className="w-full bg-red-600 hover:bg-red-500">Add Habit</Button>
                 </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            {habits.filter(h => h.type === "bad").map(habit => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-white/5 hover:bg-gray-800/60 transition-colors">
                 <div className="flex items-center gap-3">
                   <Button 
                     size="sm" 
                     className={`h-8 px-3 text-xs font-semibold ${habit.completed ? 'bg-red-600/20 text-red-400' : 'bg-gray-700 hover:bg-red-900/50 text-white'}`}
                     onClick={() => handleCompleteHabit(habit.id, "bad")}
                     disabled={habit.completed}
                   >
                     {habit.completed ? "LOST" : "LOST IT"}
                   </Button>
                   <span className="font-medium text-gray-200">{habit.name}</span>
                 </div>
                 <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => handleDelete("habit", habit.id)}>
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
