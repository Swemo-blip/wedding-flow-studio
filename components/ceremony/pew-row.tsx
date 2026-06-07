type PewRowProps = {
  filledLeft: number;
  filledRight: number;
  isReserved: boolean;
  rowNumber: number;
  seatsPerSide: number;
};

export function PewRow({ filledLeft, filledRight, isReserved, rowNumber, seatsPerSide }: PewRowProps) {
  return (
    <div className="pew-row" data-reserved={isReserved}>
      <div className="pew-side" aria-label={`Row ${rowNumber} left side`}>
        {Array.from({ length: seatsPerSide }).map((_, index) => (
          <span className="seat-dot" data-filled={index < filledLeft} key={`left-${index}`} />
        ))}
      </div>
      <div className="aisle" aria-hidden="true" />
      <div className="pew-side" aria-label={`Row ${rowNumber} right side`}>
        {Array.from({ length: seatsPerSide }).map((_, index) => (
          <span className="seat-dot" data-filled={index < filledRight} key={`right-${index}`} />
        ))}
      </div>
    </div>
  );
}
