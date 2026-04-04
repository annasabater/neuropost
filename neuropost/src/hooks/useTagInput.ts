import type { KeyboardEvent } from 'react';

export function useTagInput() {
  function addTag(list: string[], setter: (t: string[]) => void, val: string) {
    const trimmed = val.trim().replace(/^[,\s]+|[,\s]+$/g, '');
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
  }

  function removeTag(list: string[], setter: (t: string[]) => void, val: string) {
    setter(list.filter((t) => t !== val));
  }

  function handleTagKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    list: string[],
    setter: (t: string[]) => void,
    input: string,
    setInput: (v: string) => void,
  ) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(list, setter, input);
      setInput('');
    }
    if (e.key === 'Backspace' && !input && list.length) setter(list.slice(0, -1));
  }

  return { addTag, removeTag, handleTagKeyDown };
}