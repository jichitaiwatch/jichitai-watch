"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * 経年グラフの横スクロール枠を、はみ出しているときだけキーボードで操作できるようにする（C-7・WCAG 2.1.1）。
 * グラフ本体（Recharts）の Tab 停止は accessibilityLayer={false} で外しているため、
 * 枠がはみ出す（スマホ幅等）ときはこの枠自体を名前付きでフォーカス可能にし、矢印キーでスクロールできるようにする。
 * はみ出さない（PC幅）ときは Tab で止まらない。値の読み上げは SrOnlyDataTable が担う。
 */
export function useScrollRegion(ref: RefObject<HTMLDivElement | null>, label: string) {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return overflowing
    ? ({
        tabIndex: 0,
        role: "region",
        "aria-label": `${label}（左右の矢印キーでスクロール）`,
      } as const)
    : {};
}

/** スクロール枠のフォーカスリング（はみ出し時のみフォーカス可能になる） */
export const SCROLL_REGION_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--identity)]";
