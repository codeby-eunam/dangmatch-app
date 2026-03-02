import React, { createContext, useCallback, useContext, useState } from 'react';

export interface Place {
  id: string;
  name: string;
  category: '식당' | '카페';
  categoryName: string;
  address: string;
  image: string;
  placeUrl: string;
}

export interface ListItem {
  id: string;
  title: string;
  count: number;
  type: '식당' | '카페';
  icon: string;
  images: string[];
  places: Place[];
  isPublic: boolean;
}

interface LibraryContextValue {
  lists: ListItem[];
  addList: (list: ListItem) => void;
  addPlacesToList: (listId: string, places: Place[]) => void;
  deleteList: (listId: string) => void;
  renameList: (listId: string, title: string) => void;
  togglePublic: (listId: string) => void;
  removePlaceFromList: (listId: string, placeId: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function rebuildImages(places: Place[]): string[] {
  const raw = places.slice(0, 4).map((p) => p.image);
  const fallback = raw[0] ?? 'https://picsum.photos/seed/default/200/200';
  const imgs = [...raw];
  while (imgs.length < 4) imgs.push(fallback);
  return imgs;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<ListItem[]>([]);

  const addList = useCallback((list: ListItem) => {
    setLists((prev) => [{ ...list, isPublic: list.isPublic ?? false }, ...prev]);
  }, []);

  const addPlacesToList = useCallback((listId: string, places: Place[]) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        const existingIds = new Set(list.places.map((p) => p.id));
        const merged = [...list.places, ...places.filter((p) => !existingIds.has(p.id))];
        return { ...list, places: merged, count: merged.length, images: rebuildImages(merged) };
      })
    );
  }, []);

  const deleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }, []);

  const renameList = useCallback((listId: string, title: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, title } : l))
    );
  }, []);

  const togglePublic = useCallback((listId: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, isPublic: !l.isPublic } : l))
    );
  }, []);

  const removePlaceFromList = useCallback((listId: string, placeId: string) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        const places = list.places.filter((p) => p.id !== placeId);
        return { ...list, places, count: places.length, images: rebuildImages(places) };
      })
    );
  }, []);

  return (
    <LibraryContext.Provider
      value={{ lists, addList, addPlacesToList, deleteList, renameList, togglePublic, removePlaceFromList }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
