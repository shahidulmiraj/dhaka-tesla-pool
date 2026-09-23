export function SeatMeter({
  taken,
  capacity,
  vehicle,
}: {
  taken: number;
  capacity: number;
  vehicle: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        <span className="text-lg font-semibold">
          {taken} / {capacity}
        </span>{' '}
        seats {taken >= capacity && <span className="font-medium text-primary">— {vehicle} is full</span>}
      </p>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: capacity }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < taken ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
    </div>
  );
}
