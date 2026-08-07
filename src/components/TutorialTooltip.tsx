import React from 'react';
import type { TooltipRenderProps } from 'react-joyride';

export const TutorialTooltip: React.FC<TooltipRenderProps> = ({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
}) => {
  return (
    <div
      {...tooltipProps}
      className="bg-white rounded-xl shadow-2xl border border-indigo-100 p-3 sm:p-4 w-[280px] sm:w-[320px] font-sans animate-in zoom-in-95 duration-200"
    >
      <div className="flex justify-between items-center mb-2">
        {step.title && (
          <h3 className="text-base font-bold text-indigo-900 tracking-tight leading-tight">
            {step.title}
          </h3>
        )}
        <button
          {...closeProps}
          className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-1 transition-colors cursor-pointer shrink-0 ml-2"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="text-[13px] text-slate-600 mb-4 leading-snug">
        {step.content}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex space-x-1">
          {!isLastStep && (
            <button
              {...skipProps}
              className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-1.5">
          {index > 0 && (
            <button
              {...backProps}
              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
          <button
            {...primaryProps}
            className="px-3 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 rounded-md transition-all active:scale-95 cursor-pointer"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
