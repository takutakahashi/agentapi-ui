'use client';

import { useState } from 'react';
import { ACPElicitationParams, ACPElicitationProperty } from '../../types/agentapi';

interface Props {
  elicitation: ACPElicitationParams;
  onSubmit: (content: Record<string, unknown>) => void;
  onCancel: () => void;
}

function optionsFor(property: ACPElicitationProperty) {
  return property.oneOf ?? property.items?.anyOf ?? [];
}

export default function ACPElicitationModal({ elicitation, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const properties: Array<[string, ACPElicitationProperty]> = [];
  const schemaProperties = elicitation.requestedSchema?.properties ?? {};
  Object.keys(schemaProperties).forEach(key => properties.push([key, schemaProperties[key]]));

  const select = (key: string, value: string, multiple: boolean) => {
    if (!multiple) {
      setValues(current => ({ ...current, [key]: value }));
      return;
    }
    setValues(current => {
      const selected = Array.isArray(current[key]) ? current[key] as string[] : [];
      return {
        ...current,
        [key]: selected.indexOf(value) >= 0
          ? selected.filter(item => item !== value)
          : [...selected, value],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {elicitation.message || 'Agent question'}
            </h2>
            <button onClick={onCancel} aria-label="Cancel" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <span aria-hidden="true" className="text-2xl">&times;</span>
            </button>
          </div>

          <div className="space-y-6">
            {properties.map(([key, property]) => {
              const options = optionsFor(property);
              const multiple = property.type === 'array';
              const selected = values[key];

              return (
                <fieldset key={key}>
                  <legend className="mb-1 font-medium text-gray-900 dark:text-white">
                    {property.title || property.description || key}
                  </legend>
                  {property.title && property.description && (
                    <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{property.description}</p>
                  )}

                  {options.length > 0 ? (
                    <div className="space-y-2">
                      {options.map(option => {
                        const active = Array.isArray(selected)
                          ? selected.indexOf(option.const) >= 0
                          : selected === option.const;
                        return (
                          <button
                            type="button"
                            key={option.const}
                            onClick={() => select(key, option.const, multiple)}
                            className={`w-full rounded-lg border-2 p-3 text-left ${
                              active
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                            }`}
                          >
                            <span className="font-medium text-gray-900 dark:text-white">{option.title || option.const}</span>
                            {option.description && (
                              <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{option.description}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={typeof selected === 'string' ? selected : ''}
                      onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                </fieldset>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={() => onSubmit(values)} className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
              Submit answers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
