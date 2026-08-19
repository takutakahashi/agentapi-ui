interface SettingsAccordionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  sectionId?: string
  displayOrder?: number
  children: React.ReactNode
}

/**
 * A flat, always-visible settings section.
 *
 * The historical component name is kept to avoid a broad migration of every
 * settings form, but the disclosure interaction has intentionally been
 * removed. Settings should be scannable and searchable without opening cards.
 */
export function SettingsAccordion({
  title,
  description,
  sectionId,
  displayOrder,
  children,
}: SettingsAccordionProps) {
  return (
    <section
      id={sectionId}
      style={displayOrder === undefined ? undefined : { order: displayOrder }}
      className="scroll-mt-28 border-b border-gray-200 bg-white py-6 last:border-b-0 dark:border-gray-700 dark:bg-gray-900 md:grid md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] md:gap-8"
    >
      <div className="mb-4 md:mb-0">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
