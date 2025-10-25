// src/main/index.ts
import { app } from "electron";
import { runMigrations as runStoreMigrations, getDataVersion, setDataVersion } from "./store";
import { localDateString } from "../timeUtils";
import { csvDb } from "./csvDb";

/**
 * Checks the data version and runs any necessary migration scripts.
 * This should be called on app startup before initDb.
 */
export function runDataMigrations() {
  const currentVersion = getDataVersion();

  // MIGRATION V1: Remove subject_id from todos
  if (currentVersion < 1) {
    console.log("Running data migration v1: Removing subject_id from todos...");
    try {
      // 1. Read all existing todos, which might have the old structure
      const oldTodos = csvDb.getTodos();

      // 2. Create a new array of todos without the subject_id and category properties
      const newTodos = oldTodos.map((todo: any) => {
        const { subject_id, category, ...rest } = todo; // Destructure to remove unwanted keys
        return rest;
      });

      // 3. Atomically write the cleaned data back to the CSV file
      // NOTE: This requires `writeCSV` to be public in your `csvDb.ts` file.
      (csvDb as any).writeCSV("todos.csv", newTodos);

      // 4. Update the data version so this migration never runs again
      setDataVersion(1);
      console.log("Data migration v1 successful.");
    } catch (error) {
      console.error("CRITICAL: Data migration v1 FAILED!", error);
      // If it fails, the version is not updated, so it will try again on the next launch.
    }
  }
}

export function initDb() {
  // ... subject logic is unchanged ...

  // 👇 CHANGE THIS LOGIC
  const allTodos = csvDb.getTodos();
  if (allTodos.length === 0) {
    // This now only runs if the todos.csv file is completely empty.
    csvDb.addTodo({
      date: localDateString(), // Assigns it to the first day it's created
      text: "Be awesome",
      done: 0,
      starred: 1,
      due_date: "",
      created_at: new Date().toISOString(),
    });
  }

  // Run electron-store migrations (for the JSON file)
  runStoreMigrations().catch((err) => console.error("store migrations failed", err));
}

// Export core modules
export * from "./crud";
export * from "./todos";
export * from "./background";
export * from "./aggregators";
export * from "./store";
export * from "./timer";
export * from "./timerDatabase";
