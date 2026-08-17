"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FILTER_GROUP = "vacancy-toolbar-filter";
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatSelectedDate(value: string) {
  const parsed = parseDateKey(value);
  if (!parsed) return "Date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function CalendarIcon() {
  return <svg className="vacancy-calendar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M16 3v4M8 3v4M3 10h18"/>
  </svg>;
}

function nativeDateInput(toolbar: HTMLElement | null) {
  return toolbar?.querySelector<HTMLInputElement>(".vacancy-date-filter input[type='date']") ?? null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function closeFilterPopovers(except?: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>(`details[name='${FILTER_GROUP}'][open]`).forEach((details) => {
    if (details !== except) details.open = false;
  });
}

function DateFilterPopover({ toolbar }: { toolbar: HTMLElement }) {
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const [selectedDate, setSelectedDate] = useState(() => nativeDateInput(toolbar)?.value ?? "");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const selected = parseDateKey(nativeDateInput(toolbar)?.value ?? "");
    return monthStart(selected ?? today);
  });

  useEffect(() => {
    const syncFromNative = () => {
      const value = nativeDateInput(toolbar)?.value ?? "";
      setSelectedDate(value);
      const parsed = parseDateKey(value);
      if (parsed) setCalendarMonth(monthStart(parsed));
    };
    const onClear = () => {
      setSelectedDate("");
      setCalendarMonth(monthStart(today));
    };

    syncFromNative();
    const clearButton = toolbar.querySelector<HTMLButtonElement>(".vacancy-clear-filters");
    clearButton?.addEventListener("click", onClear);
    return () => clearButton?.removeEventListener("click", onClear);
  }, [toolbar, today]);

  const setDate = (value: string) => {
    const input = nativeDateInput(toolbar);
    if (!input) return;
    setReactInputValue(input, value);
    setSelectedDate(value);
  };

  const firstWeekday = (calendarMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const canGoNext = !sameMonth(calendarMonth, monthStart(today));

  return <div className="vacancy-enhanced-date-filter">
    <details
      className="vacancy-date-popover"
      name={FILTER_GROUP}
      onToggle={(event) => {
        const details = event.currentTarget;
        if (!details.open) return;
        closeFilterPopovers(details);
        const value = nativeDateInput(toolbar)?.value ?? "";
        setSelectedDate(value);
        const parsed = parseDateKey(value);
        setCalendarMonth(monthStart(parsed ?? today));
      }}
    >
      <summary aria-label={`Date filter: ${selectedDate ? formatSelectedDate(selectedDate) : "all dates"}`}>
        <CalendarIcon/>
        <span>{selectedDate ? formatSelectedDate(selectedDate) : "Date"}</span>
        <i className="vacancy-filter-chevron" aria-hidden="true">⌄</i>
      </summary>
      <div className="vacancy-calendar-menu" role="dialog" aria-label="Choose posted date">
        <div className="vacancy-calendar-head">
          <button type="button" onClick={() => setCalendarMonth((month) => addMonths(month, -1))} aria-label="Previous month">‹</button>
          <strong>{formatMonth(calendarMonth)}</strong>
          <button type="button" disabled={!canGoNext} onClick={() => setCalendarMonth((month) => addMonths(month, 1))} aria-label="Next month">›</button>
        </div>
        <div className="vacancy-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="vacancy-calendar-grid">
          {Array.from({ length: firstWeekday }, (_, index) => <span className="vacancy-calendar-empty" key={`empty-${index}`}/>) }
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
            const key = dateKey(date);
            const future = key > todayKey;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            return <button
              type="button"
              className={`vacancy-calendar-day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
              disabled={future}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              key={key}
              onClick={(event) => {
                setDate(key);
                const details = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                if (details) details.open = false;
              }}
            >{day}</button>;
          })}
        </div>
        <div className="vacancy-calendar-footer">
          <button type="button" className="vacancy-calendar-today" onClick={(event) => {
            setDate(todayKey);
            setCalendarMonth(monthStart(today));
            const details = event.currentTarget.closest("details") as HTMLDetailsElement | null;
            if (details) details.open = false;
          }}>Today</button>
          <button type="button" className="vacancy-calendar-clear" disabled={!selectedDate} onClick={() => setDate("")}>Clear date</button>
        </div>
      </div>
    </details>
  </div>;
}

export function VacancyFilterEnhancer() {
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const todayKey = dateKey(new Date());

  useEffect(() => {
    const bindToolbar = () => {
      const nextToolbar = document.querySelector<HTMLElement>(".vacancy-feed-tools");
      if (toolbarRef.current !== nextToolbar) {
        toolbarRef.current = nextToolbar;
        setToolbar(nextToolbar);
      }
      if (!nextToolbar) return;

      const input = nativeDateInput(nextToolbar);
      if (input) input.max = todayKey;
      nextToolbar.querySelectorAll<HTMLDetailsElement>(".vacancy-multifilter details").forEach((details) => {
        details.name = FILTER_GROUP;
      });
    };

    bindToolbar();
    const observer = new MutationObserver(bindToolbar);
    observer.observe(document.body, { childList: true, subtree: true });

    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || details.name !== FILTER_GROUP || !details.open) return;
      closeFilterPopovers(details);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`details[name='${FILTER_GROUP}']`)) return;
      closeFilterPopovers();
    };

    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      observer.disconnect();
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [todayKey]);

  return toolbar ? createPortal(<DateFilterPopover toolbar={toolbar}/>, toolbar) : null;
}
