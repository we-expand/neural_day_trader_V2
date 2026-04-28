import { useState, useEffect } from 'react';
import { Suggestion, getFreshSuggestion, AI_SUGGESTIONS_POOL } from '../data/aiSuggestions';

// Utility to get random items
const getRandomSuggestions = (count: number, excludeIds: Set<string>): Suggestion[] => {
  const result: Suggestion[] = [];
  const currentExcluded = new Set(excludeIds);

  for (let i = 0; i < count; i++) {
    const suggestion = getFreshSuggestion(currentExcluded);
    result.push(suggestion);
    currentExcluded.add(suggestion.id);
  }
  
  return result;
};

export function useLabIntelligenceStore() {
  const [activeSuggestions, setActiveSuggestions] = useState<Suggestion[]>([]);
  const [completedSuggestions, setCompletedSuggestions] = useState<Suggestion[]>([]);
  const [trashSuggestions, setTrashSuggestions] = useState<Suggestion[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Data
  useEffect(() => {
    const loadState = () => {
      const savedActive = localStorage.getItem('lab_intelligence_active');
      const savedCompleted = localStorage.getItem('lab_intelligence_completed');
      const savedTrash = localStorage.getItem('lab_intelligence_trash');

      let active: Suggestion[] = savedActive ? JSON.parse(savedActive) : [];
      let completed: Suggestion[] = savedCompleted ? JSON.parse(savedCompleted) : [];
      let trash: Suggestion[] = savedTrash ? JSON.parse(savedTrash) : [];

      if (!savedActive && !savedCompleted && !savedTrash) {
        // First boot: Load ALL static suggestions
        active = [...AI_SUGGESTIONS_POOL];
      } else {
        // Migration: Merge new pool items that might be missing from old saves
        // This ensures the user sees all 120 items (20 per category) even if they had a previous session
        const knownIds = new Set([
            ...active.map(s => s.id),
            ...completed.map(s => s.id),
            ...trash.map(s => s.id)
        ]);

        const missingItems = AI_SUGGESTIONS_POOL.filter(s => !knownIds.has(s.id));
        if (missingItems.length > 0) {
            console.log(`[LabIntelligence] Migrating ${missingItems.length} new suggestions to active list.`);
            active = [...active, ...missingItems];
            
            // Optional: We could save here to persist the migration immediately
            localStorage.setItem('lab_intelligence_active', JSON.stringify(active));
        }
      }

      setActiveSuggestions(active);
      setCompletedSuggestions(completed);
      setTrashSuggestions(trash);
      setIsInitialized(true);
    };
    
    loadState();
    
    const handleStorageChange = () => {
       loadState();
    };
    
    window.addEventListener('lab_intelligence_update', handleStorageChange);
    return () => window.removeEventListener('lab_intelligence_update', handleStorageChange);
  }, []);

  // Persist Data & Notify
  const save = (active: Suggestion[], completed: Suggestion[], trash: Suggestion[]) => {
    localStorage.setItem('lab_intelligence_active', JSON.stringify(active));
    localStorage.setItem('lab_intelligence_completed', JSON.stringify(completed));
    localStorage.setItem('lab_intelligence_trash', JSON.stringify(trash));
    
    // Dispatch event so other instances update
    window.dispatchEvent(new Event('lab_intelligence_update'));
  };

  const markAsCompleted = (suggestion: Suggestion) => {
    const newCompleted = [suggestion, ...completedSuggestions];
    const newActive = activeSuggestions.filter(s => s.id !== suggestion.id);
    
    // Replenish
    const allUsedIds = new Set([
      ...newActive.map(s => s.id),
      ...newCompleted.map(s => s.id),
      ...trashSuggestions.map(s => s.id),
      suggestion.id
    ]);
    
    const [newSuggestion] = getRandomSuggestions(1, allUsedIds);
    const finalActive = newSuggestion ? [...newActive, newSuggestion] : newActive;

    setActiveSuggestions(finalActive);
    setCompletedSuggestions(newCompleted);
    
    save(finalActive, newCompleted, trashSuggestions);
    return newSuggestion;
  };

  const markAsTrash = (suggestion: Suggestion) => {
    const newTrash = [suggestion, ...trashSuggestions];
    const newActive = activeSuggestions.filter(s => s.id !== suggestion.id);
    
    setTrashSuggestions(newTrash);
    setActiveSuggestions(newActive);
    save(newActive, completedSuggestions, newTrash);
  };

  const restoreFromTrash = (suggestion: Suggestion) => {
    const newActive = [suggestion, ...activeSuggestions];
    const newTrash = trashSuggestions.filter(s => s.id !== suggestion.id);
    
    setActiveSuggestions(newActive);
    setTrashSuggestions(newTrash);
    save(newActive, completedSuggestions, newTrash);
  };

  const permanentDelete = (id: string) => {
    const newTrash = trashSuggestions.filter(s => s.id !== id);
    setTrashSuggestions(newTrash);
    save(activeSuggestions, completedSuggestions, newTrash);
  };

  return {
    activeSuggestions,
    completedSuggestions,
    trashSuggestions,
    isInitialized,
    markAsCompleted,
    markAsTrash,
    restoreFromTrash,
    permanentDelete
  };
}
