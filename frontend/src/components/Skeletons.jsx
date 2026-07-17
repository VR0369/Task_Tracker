export function CardSkeleton() {
  return <div className="skeleton h-32 w-full rounded-2xl" />
}

export function RowSkeleton() {
  return <div className="skeleton h-16 w-full rounded-xl" />
}

export function SkeletonList({ count = 4, Item = RowSkeleton }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
