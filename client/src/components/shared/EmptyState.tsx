interface EmptyStateProps {
  title: string
  body: string
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">{body}</p>
    </div>
  )
}
