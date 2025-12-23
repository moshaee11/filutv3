
import React from 'react';
import { Delete, ArrowRight, Check } from 'lucide-react';

interface KeypadProps {
  onInput: (val: string) => void;
  onDelete: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSubmit: () => void;
  submitLabel?: string;
}

const Keypad: React.FC<KeypadProps> = ({ onInput, onDelete, onNext, onPrev, onSubmit, submitLabel = "提交" }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="bg-[#2D3142] p-4 grid grid-cols-4 gap-2 select-none shadow-[0_-10px_40px_rgba(0,0,0,0.3)] safe-bottom shrink-0">
      <div className="col-span-3 grid grid-cols-3 gap-2">
        {keys.map(key => (
          <button
            key={key}
            onClick={() => onInput(key)}
            className="h-16 bg-[#4A5064] text-white text-2xl font-black rounded-2xl active:scale-95 active:bg-[#5a627a] transition-all flex items-center justify-center shadow-lg"
          >
            {key}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="h-16 bg-[#4A5064] text-white rounded-2xl active:scale-95 active:bg-[#5a627a] transition-all flex items-center justify-center shadow-lg"
        >
          <Delete size={28} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onPrev}
          className="h-16 bg-white/5 text-[#FFB15E] text-xs font-black rounded-2xl border border-white/10 active:scale-95 flex items-center justify-center"
        >
          上一个
        </button>
        <button
          onClick={onNext}
          className="h-16 bg-white/5 text-[#FFB15E] text-xs font-black rounded-2xl border border-white/10 active:scale-95 flex items-center justify-center"
        >
          下一个
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 bg-emerald-500 text-white text-sm font-black rounded-3xl active:scale-95 active:bg-emerald-600 flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-900/40"
        >
          {submitLabel === "提交" ? <Check size={24} strokeWidth={3} /> : null}
          <span className="tracking-tight">{submitLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default Keypad;
