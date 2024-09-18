import React, { useState, useCallback, useMemo } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';//@ts-ignore
import { Button } from "@/components/ui/button";//@ts-ignore
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,//@ts-ignore
} from "@/components/ui/dialog";
import { SmilePlusIcon } from 'lucide-react';
import emojiList from '../../emojis.json';

const GRID_SIZE = 1000;
const CELL_SIZE = 44;
const OVERSCAN = 5;

const EmojiPicker = React.memo(({ onSelect, selected, emoji }: { onSelect: () => void, selected: boolean, emoji: string }) => {
  if (selected && emoji) {
    return (
      <div className="w-10 h-10 flex items-center justify-center text-2xl border border-transparent animate-fade-in">
        {emoji}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-10 h-10 p-0 flex items-center justify-center"
      onClick={onSelect}
    >
      <SmilePlusIcon className="h-6 w-6" />
    </Button>
  );
});

const Cell = React.memo(({ columnIndex, rowIndex, style, data }: { columnIndex: number; rowIndex: number; style: React.CSSProperties; data: any }) => {
  const { selectedEmojis, openModal } = data;
  const index = `${rowIndex}-${columnIndex}`;
  let emoji = selectedEmojis.get(index) || null;
  if (data.intArray && data.intArray[rowIndex*GRID_SIZE + columnIndex] > 0) {
    emoji = data.emojiMap.get(data.intArray[rowIndex*GRID_SIZE + columnIndex]);
  }

  return (
    <div style={style}>
      <EmojiPicker
        onSelect={() => openModal(index)}
        selected={emoji !== null}
        emoji={emoji}
      />
    </div>
  );
});

export default function VirtualEmojiPickerGrid({ intArray, sendUpdate }: { intArray: Array<number> | null, sendUpdate: (row: number, column: number, value: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmojis, setSelectedEmojis] = useState<Map<string, string>>(new Map());
  const [activePickerIndex, setActivePickerIndex] = useState<string | null>(null);

  const emojiMap = useMemo(() => {
    return new Map(
      emojiList.map(obj => [parseInt(obj.id), obj.emoji])
    );
  }, []);

  const filteredEmojis = useMemo(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return emojiList.filter(emoji =>
      emoji.tags.some(tag => tag.toLowerCase().includes(lowercasedSearchTerm))
    );
  }, [searchTerm]);

  const handleEmojiSelect = useCallback((emoji: {
    id: string;
    emoji: string;
    tags: string[];
  }) => {
    if (activePickerIndex !== null) {
      const [row, col] = activePickerIndex.split('-').map(str => parseInt(str));
      sendUpdate(row, col, parseInt(emoji.id));
      setSelectedEmojis(prevSelected => {
        const newSelected = new Map(prevSelected);
        newSelected.set(activePickerIndex, emoji.emoji);
        return newSelected;
      });
      setIsOpen(false);
      setActivePickerIndex(null);
      setSearchTerm("");
    }
  }, [activePickerIndex, sendUpdate]);

  const openModal = useCallback((index: string) => {
    if (!selectedEmojis.has(index)) {
      setActivePickerIndex(index);
      setIsOpen(true);
    }
  }, [selectedEmojis]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const cellData = useMemo(() => ({
    selectedEmojis,
    openModal,
    intArray,
    emojiMap
  }), [selectedEmojis, openModal, intArray, emojiMap]);

  return (
    <div className="p-0 h-[calc(100vh-4rem)]">
      <AutoSizer>
        {({ height, width }) => (
          <Grid
            className="border border-gray-200 rounded"
            columnCount={GRID_SIZE}
            columnWidth={() => CELL_SIZE}
            height={height}
            rowCount={GRID_SIZE}
            rowHeight={() => CELL_SIZE}
            width={width}
            overscanRowCount={OVERSCAN}
            overscanColumnCount={OVERSCAN}
            itemData={{ ...cellData }}
          >
            {Cell}
          </Grid>
        )}
      </AutoSizer>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select an Emoji</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Search emojis..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <div className="grid grid-cols-8 gap-2 max-h-[50vh] overflow-y-auto">
              {filteredEmojis.map((emojiObj) => (
                <Button
                  key={emojiObj.id}
                  variant="ghost"
                  className="text-2xl p-2"
                  onClick={() => handleEmojiSelect(emojiObj)}
                >
                  {emojiObj.emoji}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}