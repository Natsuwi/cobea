import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import iro from '@jaames/iro';
import type { IroColorPicker } from '@jaames/iro/dist/ColorPicker';

export const COLOR_SLOT_COUNT = 5;

interface ColorWheelPickerProps {
  isOpen: boolean;
  color: string;
  slots: (string | null)[];
  onChange: (color: string) => void;
  onSaveSlot: (index: number) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  isOpen,
  color,
  slots,
  onChange,
  onSaveSlot,
  onClose,
  anchorRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<IroColorPicker | null>(null);
  const onChangeRef = useRef(onChange);
  const onCloseRef = useRef(onClose);
  const isInternalChangeRef = useRef(false);

  onChangeRef.current = onChange;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };

    // Capture so it runs before canvas/drawing handlers
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;

    const container = mountRef.current;
    if (!container) return;

    // React StrictMode runs effects twice — always clear before init
    container.replaceChildren();

    const isDark = document.documentElement.classList.contains('dark');

    const picker = iro.ColorPicker(container, {
      width: 180,
      color,
      layout: [
        { component: iro.ui.Wheel },
        { component: iro.ui.Slider, options: { sliderType: 'value' } },
      ],
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
      handleRadius: 9,
      padding: 6,
      wheelLightness: false,
    });

    pickerRef.current = picker;

    const onColorChange = (c: iro.Color) => {
      isInternalChangeRef.current = true;
      onChangeRef.current(c.hexString);
      requestAnimationFrame(() => {
        isInternalChangeRef.current = false;
      });
    };

    picker.on('color:change', onColorChange);

    return () => {
      picker.off('color:change', onColorChange);
      container.replaceChildren();
      pickerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per open
  }, [isOpen]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker || isInternalChangeRef.current) return;
    if (picker.color.hexString.toLowerCase() !== color.toLowerCase()) {
      picker.color.hexString = color;
    }
  }, [color]);

  if (!isOpen) return null;

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      className="iro-color-picker-panel absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-[80] p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl"
    >
      <div className="flex items-stretch gap-3">
        <div className="min-w-0">
          <div ref={mountRef} className="iro-mount" />
          <div className="mt-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wide">
              {color}
            </span>
            <span
              className="w-6 h-6 rounded-full border border-black/10 dark:border-white/10 shrink-0"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 py-1 pl-3 border-l border-black/5 dark:border-white/5">
          {slots.map((slot, index) => {
            const filled = !!slot;
            const active =
              filled && slot.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={index}
                type="button"
                title={
                  filled
                    ? 'Utiliser cette couleur · Maj+clic pour enregistrer'
                    : 'Enregistrer la couleur de la roue'
                }
                onClick={(e) => {
                  if (!slot || e.shiftKey) {
                    onSaveSlot(index);
                    return;
                  }
                  onChange(slot);
                }}
                className={`w-7 h-7 rounded-full shrink-0 transition-transform hover:scale-110 ${
                  filled
                    ? `border border-black/10 dark:border-white/15 ${
                        active ? 'ring-2 ring-zinc-900/20 dark:ring-white/25' : ''
                      }`
                    : 'border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-transparent hover:border-zinc-400 dark:hover:border-zinc-400'
                }`}
                style={filled ? { backgroundColor: slot } : undefined}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
