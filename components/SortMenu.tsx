import React from "react";
import { ArrowUpNarrowWide, ArrowDownNarrowWide, Check } from "lucide-react";
import { SortConfig, SortField, SortOrder } from "../types";
import { t } from "../constants";

interface SortMenuProps {
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  lang: string;
  onSortChange: (field: SortField, order: SortOrder) => void;
}

export const SortMenu: React.FC<SortMenuProps> = ({
  sortConfig,
  setSortConfig,
  isOpen,
  setIsOpen,
  lang,
  onSortChange,
}) => {
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-telegram-600 dark:hover:text-telegram-400 hover:border-telegram-200 dark:hover:border-telegram-700 rounded-lg text-sm font-medium transition-all shadow-sm"
      >
        {sortConfig.order === "asc" ? (
          <ArrowUpNarrowWide className="w-4 h-4" />
        ) : (
          <ArrowDownNarrowWide className="w-4 h-4" />
        )}
        <span className="hidden min-[480px]:inline">{t(lang, "sort")}</span>
      </button>

      {isOpen && (
        <div
          className="absolute min-[480px]:right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t(lang, "sort_by")}
          </div>

          {(["name", "date", "size"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => onSortChange(field, sortConfig.order)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between capitalize"
            >
              {t(lang, field)}
              {sortConfig.field === field && (
                <Check className="w-4 h-4 text-telegram-500" />
              )}
            </button>
          ))}

          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t(lang, "order")}
          </div>

          <button
            onClick={() => onSortChange(sortConfig.field, "asc")}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
          >
            {t(lang, "asc")}
            {sortConfig.order === "asc" && (
              <Check className="w-4 h-4 text-telegram-500" />
            )}
          </button>
          <button
            onClick={() => onSortChange(sortConfig.field, "desc")}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
          >
            {t(lang, "desc")}
            {sortConfig.order === "desc" && (
              <Check className="w-4 h-4 text-telegram-500" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
